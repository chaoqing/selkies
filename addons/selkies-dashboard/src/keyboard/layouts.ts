/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/**
 * On-screen keyboard layout registry.
 *
 * Layouts are pure data so new configurations (compact rows, numeric pad,
 * game-key profiles...) can be added here without touching the component.
 *
 * Key descriptor schema:
 *   { k: 'a' }                         character key; shifted variant derived
 *   { label, key, code }               action key (Enter, Tab, arrows...)
 *   { type:'shift'|'caps'|'layer'|'mod', ... } state-toggling keys
 *   w: number                          flex width units (default 1)
 *   repeat: true                       auto-repeat while held (backspace, arrows)
 * @module
 */

/** A single key of a layout: a typed character, or an action and its code. */
export interface KeyDesc {
  /** Character of a text key, sent through the core's synthetic-key mode. */
  k?: string;
  /** Text drawn on the key, for an action key. */
  label?: string;
  /** KeyboardEvent.key of an action key. */
  key?: string;
  /** KeyboardEvent.code of an action key. */
  code?: string;
  /** A toggle key: shift is a one-shot, caps latches, layer switches rows, mod latches a hardware modifier. */
  type?: "shift" | "caps" | "layer" | "mod";
  /** The layer a `layer` key switches to. */
  target?: "letters" | "symbols";
  /** The modifier a `mod` key holds: Control, Alt, or Meta. */
  mod?: "Control" | "Alt" | "Meta";
  /** Width in flex units (default 1). */
  w?: number;
  /** A press-and-hold key that auto-repeats, like the hardware does. */
  repeat?: boolean;
}

/** The built rows of a layout: the letters layer and the symbols layer. */
export interface LayoutLayers {
  letters: KeyDesc[][];
  symbols: KeyDesc[][];
}

/** Shifted characters for the letters layer (Android-style digit row). */
export const SHIFTED_CHARS: Record<string, string> = {
  "`": "~", "1": "!", "2": "@", "3": "#", "4": "$", "5": "%", "6": "^",
  "7": "&", "8": "*", "9": "(", "0": ")", "-": "_", "=": "+", "[": "{",
  "]": "}", "\\": "|", ";": ":", "'": "\"", ",": "<", ".": ">", "/": "?",
};

/** Reverse map: shifted char -> physical base key (e.g. '$' -> '4'). */
export const SHIFT_REVERSE: Record<string, string> = Object.fromEntries(
  Object.entries(SHIFTED_CHARS).map(([k, v]) => [v, k])
);

const backspace: KeyDesc = { label: "⌫", key: "Backspace", code: "Backspace", w: 1.4, repeat: true };
const enter: KeyDesc = { label: "⏎", key: "Enter", code: "Enter", w: 1.4 };
const tab: KeyDesc = { label: "Tab", key: "Tab", code: "Tab", w: 1.4 };
const row = (chars: string[]): KeyDesc[] => chars.map((c) => ({ k: c }));

/** F1-F12 row — optional overlay row (terminal layout only). */
const fRow = (): KeyDesc[] =>
  Array.from({ length: 12 }, (_, i) => ({
    label: `F${i + 1}`, key: `F${i + 1}`, code: `F${i + 1}`,
  }));

/**
 * JuiceSSH-style special keys row — optional overlay row (terminal layout
 * only). Carries the layer toggle so 123/ABC stays reachable when enabled.
 */
const specialRow = (layer: "letters" | "symbols"): KeyDesc[] => {
  const onSymbols = layer === "symbols";
  return [
    { type: "layer", target: onSymbols ? "letters" : "symbols", label: onSymbols ? "ABC" : "123", w: 1.2 },
    { label: "Esc", key: "Escape", code: "Escape" },
    { label: "Tab", key: "Tab", code: "Tab" },
    { type: "mod", mod: "Control", label: "Ctrl", key: "Control", code: "ControlLeft" },
    { type: "mod", mod: "Alt", label: "Alt", key: "Alt", code: "AltLeft" },
    { label: "Home", key: "Home", code: "Home" },
    { label: "End", key: "End", code: "End" },
    { label: "PgUp", key: "PageUp", code: "PageUp" },
    { label: "PgDn", key: "PageDown", code: "PageDown" },
  ];
};

/** Shared bottom row: just a wide space bar. */
const spaceRow: KeyDesc[] = [{ label: "␣", key: " ", code: "Space" }];

/** The five typing rows common to every layout. */
const typeRows = (): KeyDesc[][] => [
  [...row(["`", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-", "="]), backspace],
  [tab, ...row(["q", "w", "e", "r", "t", "y", "u", "i", "o", "p", "[", "]", "\\"])],
  [{ type: "caps", label: "⇪", w: 1.5 }, ...row(["a", "s", "d", "f", "g", "h", "j", "k", "l", ";", "'"]), enter],
  [{ type: "shift", label: "⇧", w: 1.7 }, ...row(["z", "x", "c", "v", "b", "n", "m", ",", ".", "/"]), { type: "shift", label: "⇧", w: 1.7 }],
  spaceRow,
];

const symbolRows = (): KeyDesc[][] => [
  [...row(["!", "@", "#", "$", "%", "^", "&", "*", "(", ")", "-", "="]), backspace],
  [tab, ...row(["[", "]", "{", "}", "(", ")", "<", ">", "_", "\\"])],
  [...row(["`", "~", "|", ":", ";", "\"", "'", "+", "€", "£", "¥"]), enter],
  [...row(["?", "!", "$", "&", "@", "•", "°", "©", "±", "×", "÷"])],
  spaceRow,
];

/**
 * Terminal layout: plain QWERTY (+symbols) with two optional overlay rows,
 * controlled by toggles in the settings panel (both default off):
 *   toggles.f12     -> F1-F12 row at the top
 *   toggles.special -> Esc/Tab/Ctrl/Alt/Home/End/PgUp/PgDn row at the top
 */
const buildTerminalLayers = (toggles: { special?: boolean; f12?: boolean } = {}): LayoutLayers => {
  const { special = false, f12 = false } = toggles;
  const top = (layer: "letters" | "symbols"): KeyDesc[][] => [
    ...(f12 ? [fRow()] : []),
    ...(special ? [specialRow(layer)] : []),
  ];
  const layers: LayoutLayers = {
    letters: [...top("letters"), ...typeRows()],
    symbols: [...top("symbols"), ...symbolRows()],
  };
  if (!special) {
    // Without the special row the layer switch must stay reachable: replace
    // the duplicate right-hand Shift with the 123/ABC toggle.
    const li = layers.letters.findIndex((r) => r.some((d) => d.type === "shift"));
    layers.letters[li] = [...layers.letters[li].slice(0, -1),
      { type: "layer", target: "symbols", label: "123", w: 1.7 }];
    const si = layers.symbols.length - 2; // symbol row before the space bar
    layers.symbols[si] = [{ type: "layer", target: "letters", label: "ABC", w: 1.7 },
      ...layers.symbols[si]];
  }
  return layers;
};

const WIDE_SHIFT: KeyDesc = { type: "shift", label: "⇧" };

/**
 * Full QWERTY: Surface Pro 13" Signature Keyboard style — physical
 * proportions, intrinsic Esc+F1-F12 row, full modifier bottom row
 * (Ctrl/Win/Alt ␣ Alt/Ctrl) and a 65%-style arrow cluster at the
 * bottom-right (↑ above ←↓→). Overlay toggles do not apply to this layout.
 */
const buildFullLayers = (): LayoutLayers => {
  const escFRow: KeyDesc[] = [{ label: "Esc", key: "Escape", code: "Escape" }, ...fRow()];
  const modRow = (tail: KeyDesc[]): KeyDesc[] => [
    { type: "mod", mod: "Control", label: "Ctrl", key: "Control", code: "ControlLeft", w: 1.25 },
    { type: "mod", mod: "Meta", label: "Win", key: "Meta", code: "MetaLeft", w: 1.25 },
    { type: "mod", mod: "Alt", label: "Alt", key: "Alt", code: "AltLeft", w: 1.25 },
    { label: "␣", key: " ", code: "Space", w: 5.5 },
    { type: "mod", mod: "Alt", label: "Alt", key: "Alt", code: "AltRight", w: 1.25 },
    { type: "mod", mod: "Control", label: "Ctrl", key: "Control", code: "ControlRight", w: 1.25 },
    ...tail,
  ];
  const arrowsTop: KeyDesc = { label: "↑", key: "ArrowUp", code: "ArrowUp", repeat: true, w: 1 };
  const arrowsBottom: KeyDesc[] = [
    { label: "←", key: "ArrowLeft", code: "ArrowLeft", repeat: true, w: 0.85 },
    { label: "↓", key: "ArrowDown", code: "ArrowDown", repeat: true, w: 0.85 },
    { label: "→", key: "ArrowRight", code: "ArrowRight", repeat: true, w: 0.85 },
  ];
  return {
    letters: [
      escFRow,
      [...row(["`", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-", "="]), { ...backspace, w: 2 }],
      [{ ...tab, w: 1.5 }, ...row(["q", "w", "e", "r", "t", "y", "u", "i", "o", "p", "[", "]"]), { label: "\\", key: "\\", code: "Backslash" }],
      [{ type: "caps", label: "Caps", w: 1.75 }, ...row(["a", "s", "d", "f", "g", "h", "j", "k", "l", ";", "'"]), { ...enter, w: 1.25 }],
      [{ ...WIDE_SHIFT, w: 2.25 }, ...row(["z", "x", "c", "v", "b", "n", "m", ",", ".", "/"]), { ...WIDE_SHIFT, w: 1.25 }, arrowsTop],
      modRow(arrowsBottom),
    ],
    symbols: [
      escFRow,
      [...row(["!", "@", "#", "$", "%", "^", "&", "*", "(", ")", "-", "="]), { ...backspace, w: 2 }],
      [{ ...tab, w: 1.5 }, ...row(["[", "]", "{", "}", "(", ")", "<", ">", "_"]), { label: "\\", key: "\\", code: "Backslash" }],
      [...row(["`", "~", "|", ":", ";", "\"", "'", "+", "€", "£", "¥"]), { ...enter, w: 1.75 }],
      [{ type: "layer", target: "letters", label: "ABC", w: 1.75 }, ...row(["?", "•", "°", "©", "±", "§", "¶", "†", "‡", "×"]), { ...enter, w: 1.25, label: "⏎", key: "Enter", code: "Enter" }],
      modRow(arrowsBottom),
    ],
  };
};

/** A layout: its identity, display name, and how its rows are built. */
export interface KeyboardLayoutDef {
  id: string;
  name: string;
  build: (toggles?: { special?: boolean; f12?: boolean }) => LayoutLayers;
  /** Whether the settings offer the terminal's overlay rows for this layout. */
  supportsToggles: boolean;
}

export const KEYBOARD_LAYOUTS: Record<string, KeyboardLayoutDef> = {
  full: { id: "full", name: "Full QWERTY", build: () => buildFullLayers(), supportsToggles: false },
  terminal: { id: "terminal", name: "Terminal", build: buildTerminalLayers, supportsToggles: true },
};

/** Layout ids in menu order. */
export const KEYBOARD_LAYOUT_IDS = ["full", "terminal"];

export const DEFAULT_LAYOUT_ID = "terminal";

// Legacy layout ids (persisted in localStorage by older bundles) → current.
const MIGRATED_LAYOUTS: Record<string, string> = { surface: "full", compact: "full" };

/** Resolve a stored layout id, mapping retired ids onto their successors. */
export function migrateLayoutId(id: string | null | undefined): string {
  if (!id) return DEFAULT_LAYOUT_ID;
  if (KEYBOARD_LAYOUT_IDS.includes(id)) return id;
  return MIGRATED_LAYOUTS[id] || DEFAULT_LAYOUT_ID;
}

/** A concrete layout (layer -> rows) for the given layout id and overlay-row
 *  toggles ({ special, f12 }); toggles are ignored by layouts that render
 *  fixed function rows (Full QWERTY). */
export interface BuiltLayout {
  id: string;
  name: string;
  supportsToggles: boolean;
  layers: LayoutLayers;
}

export function getLayout(id: string, toggles: { special?: boolean; f12?: boolean } = {}): BuiltLayout {
  const layout = KEYBOARD_LAYOUTS[id] || KEYBOARD_LAYOUTS[DEFAULT_LAYOUT_ID];
  return {
    id: layout.id,
    name: layout.name,
    supportsToggles: !!layout.supportsToggles,
    layers: layout.build(toggles),
  };
}
