// src/keyboard/OnScreenKeyboard.jsx
// Transparent on-screen keyboard overlay.
//
// Injects keys through the same proven path as the sidebar soft-keys:
//   setSynth(true) + synthetic KeyboardEvent dispatched on window.
// The core (input.js) translates keydown/keyup into `kd,<keysym>` / `ku,<keysym>`
// WebSocket messages, so this is a pure-frontend feature.

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { getLayout, SHIFTED_CHARS, SHIFT_REVERSE } from './layouts';
import '../styles/OSK.css';

const OPACITY_TIERS = {
  transparent: 0.15,
  medium: 0.3,
  solid: 0.5,
};

// Dispatch a synthetic key event pair/press through the core's input path.
function useKeyInjector() {
  const synthRef = useRef(false);

  const setSynth = useCallback((value) => {
    if (synthRef.current !== value) {
      synthRef.current = value;
      window.postMessage({ type: 'setSynth', value }, window.location.origin);
    }
  }, []);

  const dispatch = useCallback((type, key, code, mods) => {
    window.dispatchEvent(
      new KeyboardEvent(type, {
        key,
        code,
        bubbles: true,
        cancelable: true,
        ctrlKey: !!mods.Control,
        altKey: !!mods.Alt,
        metaKey: !!mods.Meta,
        shiftKey: !!mods.Shift,
      })
    );
  }, []);

  const press = useCallback((key, code, mods) => {
    setSynth(true);
    dispatch('keydown', key, code, mods);
  }, [setSynth, dispatch]);

  const release = useCallback((key, code, mods) => {
    setSynth(true);
    dispatch('keyup', key, code, mods);
  }, [setSynth, dispatch]);

  const tap = useCallback((key, code, mods) => {
    press(key, code, mods);
    window.setTimeout(() => release(key, code, mods), 25);
  }, [press, release]);

  // Stable identity across renders: the unmount cleanup in the component
  // keys off this object; a new object per render would re-fire the cleanup.
  return useMemo(() => ({ press, release, tap, setSynth }), [press, release, tap, setSynth]);
}

export default function OnScreenKeyboard({ layoutId, fnToggles = {}, opacity = 'medium' }) {
  const layout = getLayout(layoutId, fnToggles);
  const [layer, setLayer] = useState('letters');
  const [caps, setCaps] = useState(false);
  const [shiftNext, setShiftNext] = useState(false);
  const [mods, setMods] = useState({ Control: false, Alt: false, Meta: false });
  const [pressedKey, setPressedKey] = useState(null);
  const injector = useKeyInjector();
  const repeatTimer = useRef(null);
  const repeatInterval = useRef(null);

  // Refs mirror state so pointer handlers always read fresh values,
  // even when a tap lands before the re-render from a previous toggle.
  const layerRef = useRef(layer);
  layerRef.current = layer;
  const capsRef = useRef(caps);
  capsRef.current = caps;
  const shiftNextRef = useRef(shiftNext);
  shiftNextRef.current = shiftNext;
  const modsRef = useRef(mods);
  modsRef.current = mods;

  // Release everything when the overlay unmounts.
  useEffect(() => {
    return () => {
      clearTimeout(repeatTimer.current);
      clearInterval(repeatInterval.current);
      const held = modsRef.current;
      if (held.Control) injector.release('Control', 'ControlLeft', held);
      if (held.Alt) injector.release('Alt', 'AltLeft', held);
      if (held.Meta) injector.release('Meta', 'MetaLeft', held);
      injector.setSynth(false);
    };
  }, [injector]);

  const stopRepeat = useCallback(() => {
    clearTimeout(repeatTimer.current);
    clearInterval(repeatInterval.current);
    repeatTimer.current = null;
    repeatInterval.current = null;
  }, []);

  // Resolve the character actually sent for a char key on the letters layer.
  const resolveChar = (base) => {
    if (layerRef.current === 'symbols') return base;
    const shifted = capsRef.current !== shiftNextRef.current; // XOR: caps or one-shot shift
    if (!shifted) return base;
    if (/^[a-z]$/.test(base)) return base.toUpperCase();
    return SHIFTED_CHARS[base] || base;
  };

  const sendChar = (base) => {
    const m = modsRef.current;
    if (layerRef.current === 'symbols') {
      // Symbol layer: characters that are a shifted physical key (e.g. '$') are
      // injected as Shift + base key; exotic ones (€, ×) go as direct keysyms.
      const inv = SHIFT_REVERSE[base];
      if (inv) injectShifted(base, keyToCode(inv), m);
      else injector.tap(base, '', m);
      return;
    }
    const shifted = capsRef.current !== shiftNextRef.current;
    const outCh = resolveChar(base);
    if (shifted) injectShifted(outCh, keyToCode(base), m);
    else injector.tap(outCh, keyToCode(base), m);
    if (shiftNextRef.current) setShiftNext(false);
  };

  // Emulate a physical Shift+key press: Shift_L down, char down/up, Shift_L up.
  // The server derives case/level from the actually-held X modifier state.
  const injectShifted = (ch, code, m) => {
    const ms = { ...m, Shift: true };
    injector.press('Shift', 'ShiftLeft', ms);
    injector.press(ch, code, ms);
    window.setTimeout(() => injector.release(ch, code, ms), 25);
    window.setTimeout(() => injector.release('Shift', 'ShiftLeft', ms), 45);
  };

  const keyToCode = (ch) => {
    if (/^[a-z]$/i.test(ch)) return `Key${ch.toUpperCase()}`;
    if (/^[0-9]$/.test(ch)) return `Digit${ch}`;
    return '';
  };

  const handleDown = (desc) => {
    if (desc.type === 'shift' || desc.type === 'caps' || desc.type === 'layer' || desc.type === 'mod') return;
    const id = desc.label || desc.k;
    setPressedKey(id);
    if (desc.k !== undefined) {
      sendChar(desc.k);
      return;
    }
    // action key (Enter, Backspace, arrows...)
    const m = modsRef.current;
    if (desc.repeat) injector.press(desc.key, desc.code, m);
    else injector.tap(desc.key, desc.code, m);
    if (desc.repeat) {
      repeatTimer.current = setTimeout(() => {
        repeatInterval.current = setInterval(() => {
          injector.tap(desc.key, desc.code, modsRef.current);
        }, 60);
      }, 400);
    }
  };

  const handleUp = (desc) => {
    stopRepeat();
    setPressedKey(null);
    if (desc.k !== undefined) return; // taps already released themselves
    switch (desc.type) {
      case 'shift':
        setShiftNext((v) => !v);
        return;
      case 'caps':
        setCaps((v) => !v);
        return;
      case 'layer':
        setLayer(desc.target);
        return;
      case 'mod': {
        const next = { ...modsRef.current, [desc.mod]: !modsRef.current[desc.mod] };
        if (next[desc.mod]) injector.press(desc.key, desc.code, next);
        else injector.release(desc.key, desc.code, next);
        setMods(next);
        return;
      }
      default:
        if (desc.repeat) injector.release(desc.key, desc.code, modsRef.current);
        // non-repeat action keys fire full tap on press; nothing to do here
    }
  };

  const rowKeys = layout.layers[layer];
  const alpha = OPACITY_TIERS[opacity] ?? OPACITY_TIERS.medium;

  return (
    <div
      className="osk-overlay"
      style={{ '--osk-alpha': alpha }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {rowKeys.map((rowDesc, ri) => (
        <div className="osk-row" key={ri}>
          {rowDesc.map((desc, ci) => {
            let active = false;
            if (desc.type === 'shift') active = shiftNext;
            else if (desc.type === 'caps') active = caps;
            else if (desc.type === 'mod') active = mods[desc.mod];
            else if (desc.type === 'layer') active = false;
            const down = pressedKey === (desc.label || desc.k);
            return (
              <button
                key={`${ri}-${ci}`}
                className={`osk-key${desc.type ? ` osk-key-${desc.type}` : ''}${active ? ' osk-active' : ''}${down ? ' osk-down' : ''}`}
                style={{ flexGrow: desc.w || 1, flexBasis: 0 }}
                onPointerDown={(e) => {
                  e.preventDefault();
                  try { e.target.setPointerCapture?.(e.pointerId); } catch (_) { /* synthetic or stale pointer */ }
                  handleDown(desc);
                }}
                onPointerUp={(e) => { e.preventDefault(); handleUp(desc); }}
                onPointerCancel={() => { stopRepeat(); setPressedKey(null); }}
                onContextMenu={(e) => e.preventDefault()}
              >
                {desc.k !== undefined && layer === 'letters'
                  ? resolveChar(desc.k)
                  : (desc.label || desc.k)}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
