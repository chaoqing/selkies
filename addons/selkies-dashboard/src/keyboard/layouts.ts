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

import { GEN_CODES } from "./gen-keymap";

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

/**
 * Shifted characters for the letters layer (Android-style digit row).
 *
 * Derived from the generated XKB table rather than hand-written: the previous
 * constant was maintained by eye, and a key missing here silently lost its
 * shifted form on the key face. Letters are excluded because the letters layer
 * capitalises them separately.
 */
export const SHIFTED_CHARS: Record<string, string> = Object.fromEntries(
  Object.values(GEN_CODES)
    .filter(([base, shifted]) => base && shifted && base !== shifted && !/^[a-z]$/i.test(base))
    .map(([base, shifted]) => [base, shifted]),
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
 * Terminal bottom row: the keys that used to need a special-keys overlay row,
 * folded into the space bar's row in three roughly equal groups — latching
 * modifiers and Home on the left, Space in the middle, End and the arrow
 * cluster on the right. The layer toggle lives here so 123/ABC is always
 * reachable, which retires the old overlay special-keys row entirely.
 */
const terminalBottomRow = (layer: "letters" | "symbols"): KeyDesc[] => {
  const onSymbols = layer === "symbols";
  const nav = (label: string, key: string, code: string, repeat = false): KeyDesc =>
    ({ label, key, code, w: 0.95, ...(repeat ? { repeat: true } : {}) });
  return [
    { label: "Esc", key: "Escape", code: "Escape", w: 0.95 },
    { type: "mod", mod: "Control", label: "Ctrl", key: "Control", code: "ControlLeft", w: 0.95 },
    { type: "mod", mod: "Alt", label: "Alt", key: "Alt", code: "AltLeft", w: 0.95 },
    { type: "layer", target: onSymbols ? "letters" : "symbols", label: onSymbols ? "ABC" : "123", w: 0.95 },
    nav("⇱", "Home", "Home"),
    { label: "␣", key: " ", code: "Space", w: 4.9 },
    nav("⇲", "End", "End"),
    nav("←", "ArrowLeft", "ArrowLeft", true),
    nav("↑", "ArrowUp", "ArrowUp", true),
    nav("↓", "ArrowDown", "ArrowDown", true),
    nav("→", "ArrowRight", "ArrowRight", true),
  ];
};

/** The five typing rows common to every layout. */
const typeRows = (layer: "letters" | "symbols"): KeyDesc[][] => [
  [...row(["`", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-", "="]), backspace],
  [tab, ...row(["q", "w", "e", "r", "t", "y", "u", "i", "o", "p", "[", "]", "\\"])],
  [{ type: "caps", label: "⇪", w: 1.5 }, ...row(["a", "s", "d", "f", "g", "h", "j", "k", "l", ";", "'"]), enter],
  [{ type: "shift", label: "⇧", w: 1.7 }, ...row(["z", "x", "c", "v", "b", "n", "m", ",", ".", "/"]), { type: "shift", label: "⇧", w: 1.7 }],
  terminalBottomRow(layer),
];

const symbolRows = (layer: "letters" | "symbols"): KeyDesc[][] => [
  [...row(["!", "@", "#", "$", "%", "^", "&", "*", "(", ")", "-", "="]), backspace],
  [tab, ...row(["[", "]", "{", "}", "(", ")", "<", ">", "_", "\\"])],
  [...row(["`", "~", "|", ":", ";", "\"", "'", "+", "€", "£", "¥"]), enter],
  [...row(["?", "!", "$", "&", "@", "•", "°", "©", "±", "×", "÷"])],
  terminalBottomRow(layer),
];

/**
 * Terminal layout: plain QWERTY (+symbols) whose bottom row carries the
 * modifier and navigation cluster; one optional overlay row, controlled by a
 * toggle in the settings panel (default off):
 *   toggles.f12     -> F1-F12 row at the top
 */
const buildTerminalLayers = (toggles: { f12?: boolean } = {}): LayoutLayers => {
  const { f12 = false } = toggles;
  return {
    letters: [...(f12 ? [fRow()] : []), ...typeRows("letters")],
    symbols: [...(f12 ? [fRow()] : []), ...symbolRows("symbols")],
  };
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
      [{ ...tab, w: 1.5 }, ...row(["q", "w", "e", "r", "t", "y", "u", "i", "o", "p", "[", "]", "\\"])],
      [{ type: "caps", label: "Caps", w: 1.75 }, ...row(["a", "s", "d", "f", "g", "h", "j", "k", "l", ";", "'"]), { ...enter, w: 1.25 }],
      [{ ...WIDE_SHIFT, w: 2.25 }, ...row(["z", "x", "c", "v", "b", "n", "m", ",", ".", "/"]), { ...WIDE_SHIFT, w: 1.25 }, arrowsTop],
      modRow(arrowsBottom),
    ],
    symbols: [
      escFRow,
      [...row(["!", "@", "#", "$", "%", "^", "&", "*", "(", ")", "-", "="]), { ...backspace, w: 2 }],
      [{ ...tab, w: 1.5 }, ...row(["[", "]", "{", "}", "(", ")", "<", ">", "_", "\\"])],
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
  build: (toggles?: { f12?: boolean }) => LayoutLayers;
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
 *  toggles ({ f12 }); toggles are ignored by layouts that render
 *  fixed function rows (Full QWERTY). */
export interface BuiltLayout {
  id: string;
  name: string;
  supportsToggles: boolean;
  layers: LayoutLayers;
}

export function getLayout(id: string, toggles: { f12?: boolean } = {}): BuiltLayout {
  const layout = KEYBOARD_LAYOUTS[id] || KEYBOARD_LAYOUTS[DEFAULT_LAYOUT_ID];
  return {
    id: layout.id,
    name: layout.name,
    supportsToggles: !!layout.supportsToggles,
    layers: layout.build(toggles),
  };
}
