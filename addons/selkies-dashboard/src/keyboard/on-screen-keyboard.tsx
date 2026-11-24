/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/**
 * The transparent on-screen keyboard: the frontend's own, drawn over the
 * foot of the stream while the keyboard source is set to it, so the system's
 * IME never raises and nothing hides what is typed. Keys inject through the
 * same path the soft keys use — the core's synthetic-key mode and key
 * events on `window` — with Shift emulated as a physical press so the server
 * derives the case from the modifier state it actually sees. A press of a
 * repeating key holds it and auto-repeats, as the hardware does.
 * @module
 */
import * as React from "react";
import { post, sendKeyEvent, useDashboard } from "@/state/dashboard";
import { getLayout, SHIFTED_CHARS, SHIFT_REVERSE, type KeyDesc } from "./layouts";
import "./on-screen-keyboard.css";

/** How visible the keys are against the stream, by the picked tier. */
const OPACITY_TIERS: Record<string, number> = {
  transparent: 0.15,
  medium: 0.3,
  solid: 0.5,
};

/** The modifier flags carried with every injected event. */
interface Mods { Control?: boolean; Alt?: boolean; Meta?: boolean; Shift?: boolean }

/** Injects key presses through the core's synthetic-key mode. */
function useKeyInjector() {
  const synthRef = React.useRef(false);

  const setSynth = React.useCallback((value: boolean) => {
    if (synthRef.current !== value) {
      synthRef.current = value;
      post({ type: "setSynth", value });
    }
  }, []);

  const dispatch = React.useCallback((type: "keydown" | "keyup", key: string, code: string, mods: Mods) => {
    sendKeyEvent(type, key, code, mods);
  }, []);

  const press = React.useCallback((key: string, code: string, mods: Mods) => {
    setSynth(true);
    dispatch("keydown", key, code, mods);
  }, [setSynth, dispatch]);

  const release = React.useCallback((key: string, code: string, mods: Mods) => {
    setSynth(true);
    dispatch("keyup", key, code, mods);
  }, [setSynth, dispatch]);

  const tap = React.useCallback((key: string, code: string, mods: Mods) => {
    press(key, code, mods);
    window.setTimeout(() => release(key, code, mods), 25);
  }, [press, release]);

  // Stable identity across renders: the unmount cleanup keys off this
  // object; a new object per render would re-fire the cleanup.
  return React.useMemo(() => ({ press, release, tap, setSynth }), [press, release, tap, setSynth]);
}

/** The `KeyboardEvent.code` of a bare character, where it is a key of the home rows. */
function keyToCode(ch: string): string {
  if (/^[a-z]$/i.test(ch)) return `Key${ch.toUpperCase()}`;
  if (/^[0-9]$/.test(ch)) return `Digit${ch}`;
  return "";
}

/** The keyboard itself: layers, shift state, held modifiers, and repeat. */
function KeyboardOverlay({ layoutId, special, fnRow, opacity }: { layoutId: string; special: boolean; fnRow: boolean; opacity: string }) {
  const layout = getLayout(layoutId, { special, f12: fnRow });
  const [layer, setLayer] = React.useState<"letters" | "symbols">("letters");
  const [caps, setCaps] = React.useState(false);
  const [shiftNext, setShiftNext] = React.useState(false);
  const [mods, setMods] = React.useState<Mods>({});
  const [pressedKey, setPressedKey] = React.useState<string | null>(null);
  const injector = useKeyInjector();
  const repeatTimer = React.useRef<number>(0);
  const repeatInterval = React.useRef<number>(0);

  // Refs mirror the state so a pointer handler always reads fresh values,
  // even when a tap lands before the re-render from a previous toggle.
  const layerRef = React.useRef(layer);
  const capsRef = React.useRef(caps);
  const shiftNextRef = React.useRef(shiftNext);
  const modsRef = React.useRef(mods);
  React.useEffect(() => {
    layerRef.current = layer;
    capsRef.current = caps;
    shiftNextRef.current = shiftNext;
    modsRef.current = mods;
  }, [layer, caps, shiftNext, mods]);

  // Release everything when the keyboard closes.
  React.useEffect(() => () => {
    window.clearTimeout(repeatTimer.current);
    window.clearInterval(repeatInterval.current);
    const held = modsRef.current;
    if (held.Control) injector.release("Control", "ControlLeft", held);
    if (held.Alt) injector.release("Alt", "AltLeft", held);
    if (held.Meta) injector.release("Meta", "MetaLeft", held);
    injector.setSynth(false);
  }, [injector]);

  const stopRepeat = React.useCallback(() => {
    window.clearTimeout(repeatTimer.current);
    window.clearInterval(repeatInterval.current);
    repeatTimer.current = 0;
    repeatInterval.current = 0;
  }, []);

  /** The character a letter key yields, given explicit layer and shift states. */
  const resolveWith = (lyr: "letters" | "symbols", capsOn: boolean, shiftOn: boolean, base: string): string => {
    if (lyr === "symbols") return base;
    if (!(capsOn !== shiftOn)) return base; // XOR: caps or one-shot shift
    if (/^[a-z]$/.test(base)) return base.toUpperCase();
    return SHIFTED_CHARS[base] || base;
  };

  /** Emulates a physical Shift+key press: Shift down, char down/up, Shift up. */
  const injectShifted = (ch: string, code: string, m: Mods) => {
    const ms = { ...m, Shift: true };
    injector.press("Shift", "ShiftLeft", ms);
    injector.press(ch, code, ms);
    window.setTimeout(() => injector.release(ch, code, ms), 25);
    window.setTimeout(() => injector.release("Shift", "ShiftLeft", ms), 45);
  };

  const sendChar = (base: string) => {
    const m = modsRef.current;
    if (layerRef.current === "symbols") {
      // On the symbol layer, a character that is a shifted physical key (a
      // '$') injects as Shift plus that key; exotic ones (€, ×) go as direct
      // keysyms the server maps without a physical key.
      const inv = SHIFT_REVERSE[base];
      if (inv) injectShifted(base, keyToCode(inv), m);
      else injector.tap(base, "", m);
      return;
    }
    const shifted = capsRef.current !== shiftNextRef.current;
    const outCh = resolveWith(layerRef.current, capsRef.current, shiftNextRef.current, base);
    if (shifted) injectShifted(outCh, keyToCode(base), m);
    else injector.tap(outCh, keyToCode(base), m);
    if (shiftNextRef.current) setShiftNext(false);
  };

  const handleDown = (desc: KeyDesc) => {
    if (desc.type === "shift" || desc.type === "caps" || desc.type === "layer" || desc.type === "mod") return;
    setPressedKey(desc.label || desc.k || "");
    if (desc.k !== undefined) {
      sendChar(desc.k);
      return;
    }
    // An action key (Enter, Backspace, arrows...): tapped once, or held and
    // repeated while it stays down.
    const m = modsRef.current;
    if (desc.repeat) injector.press(desc.key!, desc.code!, m);
    else injector.tap(desc.key!, desc.code!, m);
    if (desc.repeat) {
      repeatTimer.current = window.setTimeout(() => {
        repeatInterval.current = window.setInterval(() => {
          injector.tap(desc.key!, desc.code!, modsRef.current);
        }, 60);
      }, 400);
    }
  };

  const handleUp = (desc: KeyDesc) => {
    stopRepeat();
    setPressedKey(null);
    if (desc.k !== undefined) return; // character taps already released themselves
    switch (desc.type) {
      case "shift":
        setShiftNext((v) => !v);
        return;
      case "caps":
        setCaps((v) => !v);
        return;
      case "layer":
        setLayer(desc.target!);
        return;
      case "mod": {
        const next = { ...modsRef.current, [desc.mod!]: !modsRef.current[desc.mod!] };
        if (next[desc.mod!]) injector.press(desc.key!, desc.code!, next);
        else injector.release(desc.key!, desc.code!, next);
        setMods(next);
        return;
      }
      default:
        // A repeatable action key went down on press; lift it now.
        if (desc.repeat) injector.release(desc.key!, desc.code!, modsRef.current);
    }
  };

  const rows = layout.layers[layer];
  const alpha = OPACITY_TIERS[opacity] ?? OPACITY_TIERS.medium;

  return (
    <div className="osk-overlay" style={{ "--osk-alpha": alpha } as React.CSSProperties} onContextMenu={(e) => e.preventDefault()}>
      {rows.map((rowDesc, ri) => (
        <div className="osk-row" key={ri}>
          {rowDesc.map((desc, ci) => {
            let active = false;
            if (desc.type === "shift") active = shiftNext;
            else if (desc.type === "caps") active = caps;
            else if (desc.type === "mod") active = !!mods[desc.mod!];
            const down = pressedKey === (desc.label || desc.k);
            return (
              <button
                key={`${ri}-${ci}`}
                type="button"
                className={`osk-key${desc.type ? ` osk-key-${desc.type}` : ""}${active ? " osk-active" : ""}${down ? " osk-down" : ""}`}
                style={{ flexGrow: desc.w || 1, flexBasis: 0 }}
                onPointerDown={(e) => {
                  e.preventDefault();
                  try { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); } catch { /* synthetic or stale pointer */ }
                  handleDown(desc);
                }}
                onPointerUp={(e) => { e.preventDefault(); handleUp(desc); }}
                onPointerCancel={() => { stopRepeat(); setPressedKey(null); }}
                onContextMenu={(e) => e.preventDefault()}
              >
                {desc.k !== undefined && layer === "letters" ? resolveWith(layer, caps, shiftNext, desc.k) : (desc.label || desc.k)}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** The overlay the chrome mounts: drawn while the keyboard is open. */
export function OnScreenKeyboard() {
  const d = useDashboard();
  if (!d.oskVisible) return null;
  return <KeyboardOverlay layoutId={d.oskLayoutId} special={d.oskSpecialRow} fnRow={d.oskFnRow} opacity={d.oskOpacity} />;
}
