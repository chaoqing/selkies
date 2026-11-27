/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/**
 * The keyboard's character source: which glyph a physical key draws, and which
 * physical key types a character.
 *
 * `layouts.ts` keeps the geometry — rows, widths, ANSI/ISO topology — because
 * XKB has no concept of an on-screen row; the characters come from here, and
 * here is the only place that asks. Three sources feed it, in the order the
 * `SELKIES_OSK_KEYMAP` mode picks (best available wins, and a missing source
 * must never leave the keyboard faceless):
 *
 *   live    the container pushes its current keymap over the stream;
 *   static  the image's baked default layout, fetched once;
 *   bundle  gen-keymap.ts, generated from XKB and committed.
 *
 * `setRuntimeKeymap` is the seam the static fetch and the live push call. Until
 * one of them does, the bundle is the active table.
 */

import { GEN_CHAR_TO_CODE, GEN_CODES } from "./gen-keymap";

/** code -> [base, shift, altgr]; '' when that level draws nothing. */
export type KeyLevels = readonly string[];

/** The table shape a runtime source must provide. */
export interface KeymapTable {
  codes: Record<string, KeyLevels>;
  charToCode: Record<string, string>;
}

interface ActiveKeymap extends KeymapTable {
  /** Where the active table came from, for the settings panel to report. */
  source: "bundle" | "static" | "live";
  layout: string;
}

const BUNDLE: ActiveKeymap = {
  source: "bundle",
  layout: "us",
  codes: GEN_CODES,
  charToCode: GEN_CHAR_TO_CODE,
};

let active: ActiveKeymap = BUNDLE;

/** Base levels win over shifted ones, as they do in the generated table. */
function buildCharIndex(codes: Record<string, KeyLevels>): Record<string, string> {
  const index: Record<string, string> = {};
  for (const [code, row] of Object.entries(codes)) {
    if (row[0] && !(row[0] in index)) index[row[0]] = code;
  }
  for (const [code, row] of Object.entries(codes)) {
    if (row[1] && !(row[1] in index)) index[row[1]] = code;
  }
  return index;
}

/**
 * Install a runtime table, replacing whatever is active. A table that resolves
 * no keys at all is rejected: a bad fetch or a truncated push must fall back to
 * the bundle rather than blank the keyboard.
 */
export function setRuntimeKeymap(
  codes: Record<string, KeyLevels>,
  opts: { source: "static" | "live"; layout?: string; charToCode?: Record<string, string> },
): boolean {
  if (!codes || typeof codes !== "object") return false;
  const entries = Object.entries(codes);
  if (!entries.length) return false;
  active = {
    source: opts.source,
    layout: opts.layout || active.layout,
    codes,
    charToCode: opts.charToCode && Object.keys(opts.charToCode).length
      ? opts.charToCode
      : buildCharIndex(codes),
  };
  notifyKeymapChange();
  return true;
}

/** Restore the committed bundle table. */
export function resetKeymap(): void {
  if (active === BUNDLE) return;
  active = BUNDLE;
  notifyKeymapChange();
}

const listeners = new Set<() => void>();

/**
 * Subscribe to table swaps. The static fetch and the live push both land after
 * first paint, so a keyboard already on screen has to be told to redraw.
 * @returns the unsubscribe function, for an effect cleanup.
 */
export function onKeymapChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

function notifyKeymapChange(): void {
  for (const fn of [...listeners]) fn();
}

/** Which table is driving the key faces right now. */
export function keymapSource(): { source: ActiveKeymap["source"]; layout: string } {
  return { source: active.source, layout: active.layout };
}

/**
 * The `code` of the key that types `ch` on the *active* layout, or '' when this
 * layout has no such key. Use this when a character arrives with no physical
 * origin — a symbol-palette tap, or a shifted lookup — and the keyboard must
 * find the hardware key that produces it right now.
 *
 * Do not use it to identify a key authored in `layouts.ts`: those rows name
 * their keys by their US character, and on a German table `codeForChar('y')`
 * answers KeyZ, because German puts `y` on the Z position. That inversion is
 * the whole point of the table, so asking it for a geometry key's identity
 * silently swaps the key face.
 */
export function codeForChar(ch: string): string {
  return active.charToCode[ch] || "";
}

/**
 * The `code` of the US key `ch` names, from the committed reference table.
 *
 * This is the identity of a geometry key: `layouts.ts` writes its rows in US
 * characters, so `row(["q","w",...,"\\"])` means those physical positions no
 * matter which layout is active. Look the identity up here, then ask the active
 * table what that position draws via `glyphFor`.
 */
export function referenceCodeForChar(ch: string): string {
  return GEN_CHAR_TO_CODE[ch] || "";
}

/**
 * How to type `ch` on the active layout, as a physical press: which key, and
 * whether it needs Shift. Returns null when the character is only reachable
 * through AltGr or is not on this layout at all, in which case the caller must
 * fall back to sending the bare character and let the server map its keysym —
 * the same route the exotic palette keys (€, ×) already take.
 */
export function basePressFor(ch: string): { code: string; shift: boolean } | null {
  const code = active.charToCode[ch];
  if (!code) return null;
  const row = active.codes[code];
  if (!row) return null;
  if (row[0] === ch) return { code, shift: false };
  if (row[1] === ch) return { code, shift: true };
  return null;
}

/**
 * The glyph `code` draws under the given shift state, or undefined when the
 * active table says nothing about that key — callers must then keep whatever
 * label the geometry already carries.
 */
export function glyphFor(code: string, shift: boolean, altGr = false): string | undefined {
  const row = active.codes[code];
  if (!row) return undefined;
  const glyph = row[altGr ? 2 : shift ? 1 : 0];
  return glyph || undefined;
}

/** The unshifted glyph for `code`, when a caller needs a key's identity. */
export function baseGlyph(code: string): string | undefined {
  return glyphFor(code, false);
}
