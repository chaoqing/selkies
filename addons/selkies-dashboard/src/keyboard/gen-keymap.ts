/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/**
 * GENERATED FILE - DO NOT EDIT BY HAND.
 *
 * Produced by scripts/gen-osk-keymap.py from this image's XKB data, so the
 * keyboard's key face can never drift from what the container really maps.
 * Regenerate with the command line documented in that script; the layout,
 * geometry and widths still live in layouts.ts, which is hand-authored.
 *
 * `codes` maps a UI Events `code` to its [base, shift, altgr] glyphs.
 * `charToCode` is the reverse index the injector uses to send a real
 * physical key for punctuation, which hand-written tables never covered.
 */

/** One physical key's glyphs, per shift level; '' means no glyph there. */
export type KeyLevels = readonly [string, string, string];

const DATA = {
  "charToCode": {
    "!": "Digit1",
    "\"": "Quote",
    "#": "Digit3",
    "$": "Digit4",
    "%": "Digit5",
    "&": "Digit7",
    "'": "Quote",
    "(": "Digit9",
    ")": "Digit0",
    "*": "Digit8",
    "+": "Equal",
    ",": "Comma",
    "-": "Minus",
    ".": "Period",
    "/": "Slash",
    "0": "Digit0",
    "1": "Digit1",
    "2": "Digit2",
    "3": "Digit3",
    "4": "Digit4",
    "5": "Digit5",
    "6": "Digit6",
    "7": "Digit7",
    "8": "Digit8",
    "9": "Digit9",
    ":": "Semicolon",
    ";": "Semicolon",
    "<": "Comma",
    "=": "Equal",
    ">": "Period",
    "?": "Slash",
    "@": "Digit2",
    "A": "KeyA",
    "B": "KeyB",
    "C": "KeyC",
    "D": "KeyD",
    "E": "KeyE",
    "F": "KeyF",
    "G": "KeyG",
    "H": "KeyH",
    "I": "KeyI",
    "J": "KeyJ",
    "K": "KeyK",
    "L": "KeyL",
    "M": "KeyM",
    "N": "KeyN",
    "O": "KeyO",
    "P": "KeyP",
    "Q": "KeyQ",
    "R": "KeyR",
    "S": "KeyS",
    "T": "KeyT",
    "U": "KeyU",
    "V": "KeyV",
    "W": "KeyW",
    "X": "KeyX",
    "Y": "KeyY",
    "Z": "KeyZ",
    "[": "BracketLeft",
    "\\": "Backslash",
    "]": "BracketRight",
    "^": "Digit6",
    "_": "Minus",
    "`": "Backquote",
    "a": "KeyA",
    "b": "KeyB",
    "c": "KeyC",
    "d": "KeyD",
    "e": "KeyE",
    "f": "KeyF",
    "g": "KeyG",
    "h": "KeyH",
    "i": "KeyI",
    "j": "KeyJ",
    "k": "KeyK",
    "l": "KeyL",
    "m": "KeyM",
    "n": "KeyN",
    "o": "KeyO",
    "p": "KeyP",
    "q": "KeyQ",
    "r": "KeyR",
    "s": "KeyS",
    "t": "KeyT",
    "u": "KeyU",
    "v": "KeyV",
    "w": "KeyW",
    "x": "KeyX",
    "y": "KeyY",
    "z": "KeyZ",
    "{": "BracketLeft",
    "|": "Backslash",
    "}": "BracketRight",
    "~": "Backquote"
  },
  "codes": {
    "Backquote": [
      "`",
      "~",
      ""
    ],
    "Backslash": [
      "\\",
      "|",
      ""
    ],
    "BracketLeft": [
      "[",
      "{",
      ""
    ],
    "BracketRight": [
      "]",
      "}",
      ""
    ],
    "Comma": [
      ",",
      "<",
      ""
    ],
    "Digit0": [
      "0",
      ")",
      ""
    ],
    "Digit1": [
      "1",
      "!",
      ""
    ],
    "Digit2": [
      "2",
      "@",
      ""
    ],
    "Digit3": [
      "3",
      "#",
      ""
    ],
    "Digit4": [
      "4",
      "$",
      ""
    ],
    "Digit5": [
      "5",
      "%",
      ""
    ],
    "Digit6": [
      "6",
      "^",
      ""
    ],
    "Digit7": [
      "7",
      "&",
      ""
    ],
    "Digit8": [
      "8",
      "*",
      ""
    ],
    "Digit9": [
      "9",
      "(",
      ""
    ],
    "Equal": [
      "=",
      "+",
      ""
    ],
    "KeyA": [
      "a",
      "A",
      ""
    ],
    "KeyB": [
      "b",
      "B",
      ""
    ],
    "KeyC": [
      "c",
      "C",
      ""
    ],
    "KeyD": [
      "d",
      "D",
      ""
    ],
    "KeyE": [
      "e",
      "E",
      ""
    ],
    "KeyF": [
      "f",
      "F",
      ""
    ],
    "KeyG": [
      "g",
      "G",
      ""
    ],
    "KeyH": [
      "h",
      "H",
      ""
    ],
    "KeyI": [
      "i",
      "I",
      ""
    ],
    "KeyJ": [
      "j",
      "J",
      ""
    ],
    "KeyK": [
      "k",
      "K",
      ""
    ],
    "KeyL": [
      "l",
      "L",
      ""
    ],
    "KeyM": [
      "m",
      "M",
      ""
    ],
    "KeyN": [
      "n",
      "N",
      ""
    ],
    "KeyO": [
      "o",
      "O",
      ""
    ],
    "KeyP": [
      "p",
      "P",
      ""
    ],
    "KeyQ": [
      "q",
      "Q",
      ""
    ],
    "KeyR": [
      "r",
      "R",
      ""
    ],
    "KeyS": [
      "s",
      "S",
      ""
    ],
    "KeyT": [
      "t",
      "T",
      ""
    ],
    "KeyU": [
      "u",
      "U",
      ""
    ],
    "KeyV": [
      "v",
      "V",
      ""
    ],
    "KeyW": [
      "w",
      "W",
      ""
    ],
    "KeyX": [
      "x",
      "X",
      ""
    ],
    "KeyY": [
      "y",
      "Y",
      ""
    ],
    "KeyZ": [
      "z",
      "Z",
      ""
    ],
    "Minus": [
      "-",
      "_",
      ""
    ],
    "Period": [
      ".",
      ">",
      ""
    ],
    "Quote": [
      "'",
      "\"",
      ""
    ],
    "Semicolon": [
      ";",
      ":",
      ""
    ],
    "Slash": [
      "/",
      "?",
      ""
    ]
  },
  "layout": "us",
  "source": "image-default"
} as const;

/** The layout this module was generated from. */
export const GEN_LAYOUT: string = DATA.layout;

/** code -> [base, shift, altgr], from XKB. */
export const GEN_CODES: Record<string, KeyLevels> = DATA.codes;

/** character -> code, base level winning over the shifted one. */
export const GEN_CHAR_TO_CODE: Record<string, string> = DATA.charToCode;

/**
 * The glyph a physical key draws for a given shift state, or undefined
 * when this table has nothing to say about that key.
 */
export function genGlyph(code: string | undefined, shift: boolean, altGr: boolean): string | undefined {
  if (!code) return undefined;
  const row = GEN_CODES[code];
  if (!row) return undefined;
  const glyph = row[altGr ? 2 : shift ? 1 : 0];
  return glyph || undefined;
}
