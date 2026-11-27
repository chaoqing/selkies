/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/**
 * Loads the keymap table a deployment serves, when it serves one.
 *
 * Two independent switches, because the library and the deployment are separate
 * domains:
 *
 *   build time  `DYNAMIC_OSK_KEYMAP`, baked by vite.config.js as
 *               `window.__SELKIES_OSK_KEYMAP_URL__`. Empty — the default here —
 *               means this package was built to stand alone: it ships its own
 *               generated table (`gen-keymap.ts`) and never issues a request.
 *   run time    `SELKIES_OSK_KEYMAP`, published by the server's `/api/status`
 *               as `window.__SELKIES_OSK_KEYMAP__`, picking among `bundle`,
 *               `static` and `live` *within* what the build allows.
 *
 * So a webtop image opts in at build (`DYNAMIC_OSK_KEYMAP=/osk-keymap.json`,
 * the file it bakes itself) and then chooses `static` or `live` with an ENV,
 * while an untouched selkies build stays on the bundle whatever the server asks
 * for. `live` starts from the same file as `static`, because the file is the
 * floor the server's pushes ride on top of; taking those pushes is the stream
 * layer's job, not this module's.
 *
 * The fetch is never awaited by the caller: the bundled table paints the
 * keyboard immediately and a slow or missing file must not delay or blank it.
 * @module
 */
import { getRoutePrefix } from '../utils';
import { setRuntimeKeymap, type KeyLevels } from './keymap';

declare global {
  interface Window {
    /** The keymap URL a deployment baked, or undefined for a standalone build. */
    __SELKIES_OSK_KEYMAP_URL__?: string;
  }
}

/** The JSON the generator emits. */
interface KeymapFile {
  v?: number;
  layout?: string;
  codes?: Record<string, (string | null)[]>;
  charToCode?: Record<string, string>;
}

/**
 * Fetch the served table if this build allows it and the mode asks for it.
 * @returns whether the active table changed.
 */
export async function loadRuntimeKeymap(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const url = window.__SELKIES_OSK_KEYMAP_URL__;
  if (!url) return false; // built standalone: the bundle is the whole story
  const mode = window.__SELKIES_OSK_KEYMAP__ || 'bundle';
  if (mode === 'bundle') return false; // the operator locked it to the bundle
  try {
    const resp = await fetch(`${getRoutePrefix()}${url}`, {
      credentials: 'same-origin',
      signal: AbortSignal.timeout(3000),
    });
    if (!resp.ok) throw new Error(`status ${resp.status}`);
    const data = (await resp.json()) as KeymapFile;
    const codes = data.codes as Record<string, KeyLevels> | undefined;
    if (!setRuntimeKeymap(codes || {}, { source: 'static', layout: data.layout, charToCode: data.charToCode })) {
      throw new Error('keymap table is empty');
    }
    return true;
  } catch (err) {
    // The baked URL outran the file: a deployment that set the build ARG
    // without shipping it, or one whose file predates a layout change. The
    // bundled table is a complete keymap, so keep the keyboard working rather
    // than retry.
    console.warn(`osk keymap mode '${mode}' unavailable, using the bundled table: ${err}`);
    return false;
  }
}
