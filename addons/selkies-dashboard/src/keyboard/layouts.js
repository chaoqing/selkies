// src/keyboard/layouts.js
// On-screen keyboard layout registry.
//
// Layouts are pure data so new configurations (compact rows, numeric pad,
// game-key profiles...) can be added here without touching the component.
//
// Key descriptor schema:
//   { k: 'a' }                         character key; shifted variant derived
//   { label, key, code }               action key (Enter, Tab, arrows...)
//   { type:'shift'|'caps'|'layer'|'mod', ... } state-toggling keys
//   w: number                          flex width units (default 1)
//   repeat: true                       auto-repeat while held (backspace, arrows)

// Shifted characters for the letters layer (Android-style digit row).
export const SHIFTED_CHARS = {
  '`': '~', '1': '!', '2': '@', '3': '#', '4': '$', '5': '%', '6': '^',
  '7': '&', '8': '*', '9': '(', '0': ')', '-': '_', '=': '+', '[': '{',
  ']': '}', '\\': '|', ';': ':', "'": '"', ',': '<', '.': '>', '/': '?',
};

// Reverse map: shifted char -> physical base key (e.g. '$' -> '4').
export const SHIFT_REVERSE = Object.fromEntries(
  Object.entries(SHIFTED_CHARS).map(([k, v]) => [v, k])
);

const backspace = { label: '⌫', key: 'Backspace', code: 'Backspace', w: 1.4, repeat: true };
const enter = { label: '⏎', key: 'Enter', code: 'Enter', w: 1.4 };
const tab = { label: 'Tab', key: 'Tab', code: 'Tab', w: 1.4 };
const row = (chars) => chars.map((c) => ({ k: c }));

// F1-F12 row — optional overlay row (terminal layout only).
const fRow = () =>
  Array.from({ length: 12 }, (_, i) => ({
    label: `F${i + 1}`, key: `F${i + 1}`, code: `F${i + 1}`,
  }));

// JuiceSSH-style special keys row — optional overlay row (terminal layout
// only). Carries the layer toggle so 123/ABC stays reachable when enabled.
const specialRow = (layer) => {
  const onSymbols = layer === 'symbols';
  return [
    { type: 'layer', target: onSymbols ? 'letters' : 'symbols', label: onSymbols ? 'ABC' : '123', w: 1.2 },
    { label: 'Esc', key: 'Escape', code: 'Escape' },
    { label: 'Tab', key: 'Tab', code: 'Tab' },
    { type: 'mod', mod: 'Control', label: 'Ctrl', key: 'Control', code: 'ControlLeft' },
    { type: 'mod', mod: 'Alt', label: 'Alt', key: 'Alt', code: 'AltLeft' },
    { label: 'Home', key: 'Home', code: 'Home' },
    { label: 'End', key: 'End', code: 'End' },
    { label: 'PgUp', key: 'PageUp', code: 'PageUp' },
    { label: 'PgDn', key: 'PageDown', code: 'PageDown' },
  ];
};

// Shared bottom row: just a wide space bar.
const spaceRow = [{ label: '␣', key: ' ', code: 'Space' }];

// The five typing rows common to every layout.
const typeRows = () => [
  [...row(['`', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=']), backspace],
  [tab, ...row(['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '[', ']', '\\'])],
  [{ type: 'caps', label: '⇪', w: 1.5 }, ...row(['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', "'"]), enter],
  [{ type: 'shift', label: '⇧', w: 1.7 }, ...row(['z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/']), { type: 'shift', label: '⇧', w: 1.7 }],
  spaceRow,
];

const symbolRows = () => [
  [...row(['!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '-', '=']), backspace],
  [tab, ...row(['[', ']', '{', '}', '(', ')', '<', '>', '_', '\\'])],
  [...row(['`', '~', '|', ':', ';', '"', "'", '+', '€', '£', '¥']), enter],
  [...row(['?', '!', '$', '&', '@', '•', '°', '©', '±', '×', '÷'])],
  spaceRow,
];

// Terminal layout: plain QWERTY (+symbols) with two optional overlay rows,
// controlled by toggles in the settings panel (both default off):
//   toggles.f12     -> F1-F12 row at the top
//   toggles.special -> Esc/Tab/Ctrl/Alt/Home/End/PgUp/PgDn row at the top
const buildTerminalLayers = (toggles = {}) => {
  const { special = false, f12 = false } = toggles;
  const top = (layer) => [
    ...(f12 ? [fRow()] : []),
    ...(special ? [specialRow(layer)] : []),
  ];
  const layers = {
    letters: [...top('letters'), ...typeRows()],
    symbols: [...top('symbols'), ...symbolRows()],
  };
  if (!special) {
    // Without the special row the layer switch must stay reachable: replace
    // the duplicate right-hand Shift with the 123/ABC toggle.
    const li = layers.letters.findIndex((r) => r.some((d) => d.type === 'shift'));
    layers.letters[li] = [...layers.letters[li].slice(0, -1),
      { type: 'layer', target: 'symbols', label: '123', w: 1.7 }];
    const si = layers.symbols.length - 2; // symbol row before the space bar
    layers.symbols[si] = [{ type: 'layer', target: 'letters', label: 'ABC', w: 1.7 },
      ...layers.symbols[si]];
  }
  return layers;
};

// Full QWERTY: Surface Pro 13" Signature Keyboard style — physical
// proportions, intrinsic Esc+F1-F12 row, full modifier bottom row
// (Ctrl/Win/Alt ␣ Alt/Ctrl) and a 65%-style arrow cluster at the
// bottom-right (↑ above ←↓→). Overlay toggles do not apply to this layout.
const WIDE_SHIFT = { type: 'shift', label: '⇧' };
const buildFullLayers = () => {
  const escFRow = [{ label: 'Esc', key: 'Escape', code: 'Escape' }, ...fRow()];
  const modRow = (tail) => [
    { type: 'mod', mod: 'Control', label: 'Ctrl', key: 'Control', code: 'ControlLeft', w: 1.25 },
    { type: 'mod', mod: 'Meta', label: 'Win', key: 'Meta', code: 'MetaLeft', w: 1.25 },
    { type: 'mod', mod: 'Alt', label: 'Alt', key: 'Alt', code: 'AltLeft', w: 1.25 },
    { label: '␣', key: ' ', code: 'Space', w: 5.5 },
    { type: 'mod', mod: 'Alt', label: 'Alt', key: 'Alt', code: 'AltRight', w: 1.25 },
    { type: 'mod', mod: 'Control', label: 'Ctrl', key: 'Control', code: 'ControlRight', w: 1.25 },
    ...tail,
  ];
  const arrowsTop = { label: '↑', key: 'ArrowUp', code: 'ArrowUp', repeat: true, w: 1 };
  const arrowsBottom = [
    { label: '←', key: 'ArrowLeft', code: 'ArrowLeft', repeat: true, w: 0.85 },
    { label: '↓', key: 'ArrowDown', code: 'ArrowDown', repeat: true, w: 0.85 },
    { label: '→', key: 'ArrowRight', code: 'ArrowRight', repeat: true, w: 0.85 },
  ];
  return {
    letters: [
      escFRow,
      [...row(['`', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=']), { ...backspace, w: 2 }],
      [{ ...tab, w: 1.5 }, ...row(['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '[', ']']), { label: '\\', key: '\\', code: 'Backslash' }],
      [{ type: 'caps', label: 'Caps', w: 1.75 }, ...row(['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', "'"]), { ...enter, w: 1.25 }],
      [{ ...WIDE_SHIFT, w: 2.25 }, ...row(['z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/']), { ...WIDE_SHIFT, w: 1.25 }, arrowsTop],
      modRow(arrowsBottom),
    ],
    symbols: [
      escFRow,
      [...row(['!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '-', '=']), { ...backspace, w: 2 }],
      [{ ...tab, w: 1.5 }, ...row(['[', ']', '{', '}', '(', ')', '<', '>', '_']), { label: '\\', key: '\\', code: 'Backslash' }],
      [...row(['`', '~', '|', ':', ';', '"', "'", '+', '€', '£', '¥']), { ...enter, w: 1.75 }],
      [{ type: 'layer', target: 'letters', label: 'ABC', w: 1.75 }, ...row(['?', '•', '°', '©', '±', '§', '¶', '†', '‡', '×']), { ...enter, w: 1.25, label: '⏎', key: 'Enter', code: 'Enter' }],
      modRow(arrowsBottom),
    ],
  };
};

export const KEYBOARD_LAYOUTS = {
  full: { id: 'full', name: 'Full QWERTY', build: () => buildFullLayers(), supportsToggles: false },
  terminal: { id: 'terminal', name: 'Terminal', build: buildTerminalLayers, supportsToggles: true },
};

// Legacy layout ids (persisted in localStorage by older bundles) → current.
export const migrateLayoutId = (id) =>
  (id === 'surface' || id === 'compact' ? 'full' : id);

export const DEFAULT_LAYOUT_ID = 'terminal';

// Build a concrete layout (layer -> rows) for the given layout id and
// overlay-row toggles ({ special, f12 }); toggles are ignored by layouts
// that render fixed function rows (Full QWERTY).
export function getLayout(id, toggles = {}) {
  const layout = KEYBOARD_LAYOUTS[id] || KEYBOARD_LAYOUTS[DEFAULT_LAYOUT_ID];
  return {
    id: layout.id,
    name: layout.name,
    supportsToggles: !!layout.supportsToggles,
    layers: layout.build(toggles),
  };
}
