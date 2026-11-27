/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv } from "vite"
import { ViteMinifyPlugin } from "vite-plugin-minify"

// https://vite.dev/config/
export default ({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const inject = env.SELKIES_INJECT === '1' || env.SELKIES_INJECT === 'true';
  const downloadsPath = env.SELKIES_UPLOAD_DIR || '~/Desktop';
  // Where a deployment serves its own on-screen-keyboard keymap JSON, empty for
  // a build that has none. Baked into the bundle rather than probed at runtime
  // so this package stands alone: without it the keyboard uses its committed
  // table and never issues a request.
  const oskKeymapUrl = env.DYNAMIC_OSK_KEYMAP || '';

  return defineConfig({
    // Relative asset URLs so the dist works when served under a subfolder prefix.
    base: '',
    plugins: [react(), tailwindcss(), ViteMinifyPlugin()],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "./src"),
      },
    },
    server: {
      // Dev-server exposure is opt-in: bind loopback unless SELKIES_VITE_HOST is set
      // (parity with selkies-web-core).
      host: process.env.SELKIES_VITE_HOST || '127.0.0.1',
      allowedHosts: process.env.SELKIES_VITE_HOST ? true : undefined,
      // main.tsx imports the touch gamepad and the core's lib from the sibling packages.
      fs: { allow: ['.', '../universal-touch-gamepad', '../selkies-web-core'] },
    },
    build: {
      target: 'chrome94',
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            if (id.includes('node_modules')) {
              if (id.includes('@base-ui')) {
                return 'base-ui';
              }
              if (id.includes('react') || id.includes('lucide-react')) {
                return 'vendor';
              }
            }
          }
        }
      }
    },
    define: {
      // if inject=false -> undefined, so runtime falls back to localStorage/default
      'window.__SELKIES_INJECTED_PATH_PREFIX__': inject ? JSON.stringify(downloadsPath) : 'undefined',
      // An empty DYNAMIC_OSK_KEYMAP leaves this undefined, and loadRuntimeKeymap
      // then keeps the bundled table without ever fetching.
      'window.__SELKIES_OSK_KEYMAP_URL__': oskKeymapUrl ? JSON.stringify(oskKeymapUrl) : 'undefined'
    }
  })
}
