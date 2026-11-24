/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/**
 * Layouts for the frontend on-screen keyboard. A layout is the map of rows
 * the overlay draws — plain text keys as characters, action keys as a
 * `key`/`code` pair — plus the modifier and toggle keys that ride beside
 * them. Ids are stable: they are the values kept in browser storage, where
 * the retired ids of removed layouts migrate to their successors.
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
  /** Width in grid units (default 1). */
  w?: number;
  /** A press-and-hold key that auto-repeats, like the hardware does. */
  repeat?: boolean;
}

/** One keyboard layout: its display name and the rows of each layer. */
export interface KeyboardLayout {
  name: string;
  layers: { letters: KeyDesc[][]; symbols: KeyDesc[][] };
  /** Whether the settings offer the terminal's overlay rows for this layout. */
  supportsToggles?: boolean;
}

/** The printable characters an unshifted key yields on the symbol layer, per ANSI row. */
const SYMBOL_NUMBERS = ["`", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-", "="];
const SYMBOL_UPPER = ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p", "[", "]", "\\"];
const SYMBOL_HOME = ["a", "s", "d", "f", "g", "h", "j", "k", "l", ";", "'"];
const SYMBOL_LOWER = ["z", "x", "c", "v", "b", "n", "m", ",", ".", "/"];

/** The symbol a shifted number key yields, used both ways: to draw, and to derive the physical key. */
const SHIFTED_CHARS: Record<string, string> = {
  "1": "!", "2": "@", "3": "#", "4": "$", "5": "%", "6": "^", "7": "&", "8": "*", "9": "(", "0": ")",
  "-": "_", "=": "+", "[": "{", "]": "}", "\\": "|", ";": ":", "'": "\"", ",": "<", ".": ">", "/": "?", "`": "~",
};
const SHIFT_REVERSE: Record<string, string> = Object.fromEntries(Object.entries(SHIFTED_CHARS).map(([k, v]) => [v, k]));

/** A plain text key. */
const ch = (c: string): KeyDesc => ({ k: c });

/** A row of characters, given as a string or a list. */
const row = (chars: string | string[]): KeyDesc[] => (typeof chars === "string" ? Array.from(chars) : chars).map(ch);

/**
 * The full QWERTY: letters, digits and punctuation in a symbols layer,
 * with a modifiers row — Escape, Tab, Control, Alt, Meta, arrows, Enter.
 */
const fullLayout: KeyboardLayout = {
  name: "osk.layoutFull",
  layers: {
    letters: [
      row("`1234567890-="),
      [{ label: "Tab", key: "Tab", code: "Tab", w: 1.5 }, ...row("qwertyuiop"), ch("["), ch("]"), ch("\\")],
      [{ type: "caps", label: "Caps", key: "CapsLock", code: "CapsLock", w: 1.8 }, ...row("asdfghjkl"), ch(";"), ch("'"),
        { type: "shift", label: "Shift", key: "Shift", code: "ShiftRight", w: 2.2 }],
      [{ type: "layer", label: "?123", target: "symbols", w: 1.6 }, ...row("zxcvbnm"), ch(","), ch("."), ch("/")],
      [
        { label: "Esc", key: "Escape", code: "Escape" },
        { type: "mod", label: "Ctrl", mod: "Control", key: "Control", code: "ControlLeft", w: 1.3 },
        { type: "mod", label: "Alt", mod: "Alt", key: "Alt", code: "AltLeft", w: 1.3 },
        { type: "mod", label: "Meta", mod: "Meta", key: "Meta", code: "MetaLeft", w: 1.3 },
        { label: "Space", k: " ", w: 4 },
        { label: "◀", key: "ArrowLeft", code: "ArrowLeft", repeat: true },
        { label: "▲", key: "ArrowUp", code: "ArrowUp", repeat: true },
        { label: "▼", key: "ArrowDown", code: "ArrowDown", repeat: true },
        { label: "▶", key: "ArrowRight", code: "ArrowRight", repeat: true },
        { label: "⏎", key: "Enter", code: "Enter", w: 1.6, repeat: true },
      ],
    ],
    symbols: [
      [...row(SYMBOL_NUMBERS), ..."`~!@#$%^&*()_+".split("").filter((c) => !SYMBOL_NUMBERS.includes(c)).map(ch), ch("{"), ch("}"), ch("|")],
      [...row(SYMBOL_UPPER), ch("$"), ch("%"), ch("^"), ch("&"), ch("*"), ch("("), ch(")"), ch("_"), ch("+"), ch("=")],
      [...row(SYMBOL_HOME), ch(":"), ch("\""), ch("<"), ch(">"), ch("?"), ch("/")],
      [...row(SYMBOL_LOWER), ch("["), ch("]"), ch("{"), ch("}"), ch("~"), ch("`")],
      [
        { type: "layer", label: "ABC", target: "letters", w: 1.6 },
        { label: "Esc", key: "Escape", code: "Escape" },
        { type: "mod", label: "Ctrl", mod: "Control", key: "Control", code: "ControlLeft", w: 1.3 },
        { type: "mod", label: "Alt", mod: "Alt", key: "Alt", code: "AltLeft", w: 1.3 },
        { label: "Space", k: " ", w: 3 },
        { label: "◀", key: "ArrowLeft", code: "ArrowLeft", repeat: true },
        { label: "▶", key: "ArrowRight", code: "ArrowRight", repeat: true },
        { label: "⌫", key: "Backspace", code: "Backspace", w: 1.4, repeat: true },
      ],
    ],
  },
};

/** The action keys of the terminal's extra rows, as key descriptors. */
const fn = (n: number): KeyDesc => ({ label: `F${n}`, key: `F${n}`, code: `F${n}` });
const specialRow = (): KeyDesc[] => [
  { label: "~", k: "~" }, { label: "`", k: "`" }, { label: "|", k: "|" }, { label: "\\", k: "\\" },
  { label: "{", k: "{" }, { label: "}", k: "}" }, { label: "[", k: "[" }, { label: "]", k: "]" },
  { label: "^", k: "^" }, { label: "<", k: "<" }, { label: ">", k: ">" },
  { label: "⌫", key: "Backspace", code: "Backspace", w: 1.4, repeat: true },
];
const fnRow = (): KeyDesc[] => [fn(1), fn(2), fn(3), fn(4), fn(5), fn(6), fn(7), fn(8), fn(9), fn(10), fn(11), fn(12)];

/**
 * The terminal layout: letters and digits as plain rows, the punctuation
 * beside them reached through the symbols layer, and — when their toggles
 * are on — the special-keys and function-keys rows that a desktop terminal
 * user reaches for.
 */
const terminalLayout: KeyboardLayout = {
  name: "osk.layoutTerminal",
  supportsToggles: true,
  layers: {
    letters: [
      row("1234567890"),
      row("qwertyuiop"),
      row("asdfghjkl"),
      [
        { type: "shift", label: "Shift", key: "Shift", code: "ShiftLeft", w: 1.5 },
        ...row("zxcvbnm"),
        { label: "⌫", key: "Backspace", code: "Backspace", w: 1.5, repeat: true },
      ],
      [
        { type: "layer", label: "?123", target: "symbols", w: 1.5 },
        { type: "mod", label: "Ctrl", mod: "Control", key: "Control", code: "ControlLeft" },
        { type: "mod", label: "Alt", mod: "Alt", key: "Alt", code: "AltLeft" },
        { type: "mod", label: "Meta", mod: "Meta", key: "Meta", code: "MetaLeft" },
        { label: "Space", k: " ", w: 4 },
        { label: "⏎", key: "Enter", code: "Enter", w: 1.5, repeat: true },
      ],
    ],
    symbols: [
      row(SYMBOL_NUMBERS),
      [...row("!@#$%^&*()"), ch("-"), ch("="),
        { label: "⌫", key: "Backspace", code: "Backspace", w: 1.5, repeat: true }],
      row("{}[]|\\~`"),
      row(";:'\"<>,.?/"),
      [
        { type: "layer", label: "ABC", target: "letters", w: 1.5 },
        { type: "mod", label: "Ctrl", mod: "Control", key: "Control", code: "ControlLeft" },
        { type: "mod", label: "Alt", mod: "Alt", key: "Alt", code: "AltLeft" },
        { label: "Space", k: " ", w: 4 },
        { label: "⏎", key: "Enter", code: "Enter", w: 1.5, repeat: true },
      ],
    ],
  },
};

/** The keyboard the settings offer and the overlay draws, by id. */
export const KEYBOARD_LAYOUTS: Record<string, KeyboardLayout> = {
  full: fullLayout,
  terminal: terminalLayout,
};
export const KEYBOARD_LAYOUT_IDS = ["full", "terminal"];
export const DEFAULT_LAYOUT_ID = "full";

/**
 * Ids kept in browser storage by older frontends. `zhuyin` and `bopomofo`
 * were one layout renamed twice, and `qwerty` was the full one before the
 * full/terminal distinction; `special` rows folded into `terminal`.
 */
const MIGRATED_LAYOUTS: Record<string, string> = {
  zhuyin: "full", bopomofo: "full", qwerty: "full", terminal: "terminal", special: "terminal",
};

/** The current id for a stored one. */
export function migrateLayoutId(id: string | null | undefined): string {
  if (!id) return DEFAULT_LAYOUT_ID;
  return KEYBOARD_LAYOUT_IDS.includes(id) ? id : MIGRATED_LAYOUTS[id] || DEFAULT_LAYOUT_ID;
}

/** The layout for an id, falling back to the default. */
export function getLayout(id: string, opts: { special?: boolean; f12?: boolean } = {}): KeyboardLayout {
  const base = KEYBOARD_LAYOUTS[id] || KEYBOARD_LAYOUTS[DEFAULT_LAYOUT_ID];
  if (base !== terminalLayout || (!opts.special && !opts.f12)) return base;
  const extra = [...(opts.special ? [specialRow()] : []), ...(opts.f12 ? [fnRow()] : [])];
  return { ...base, layers: { ...base.layers, letters: [...extra, ...base.layers.letters] } };
}

export { SHIFTED_CHARS, SHIFT_REVERSE };
