import { defineConfig } from 'vite';
import { resolve } from 'node:path';

/**
 * Multi-entry build for the Insystem / Agent Assist Chrome Extension (MV3).
 *
 * Layout (dist/):
 *   background/index.js   — service worker (ES module, declared in manifest)
 *   content/index.js      — content script (ES module-safe: no imports/exports)
 *   popup/index.html      — extension popup
 *   options/index.html    — options page
 *   manifest.json, icons/ — copied verbatim from public/
 *
 * We set `root` to `src/` so Vite treats src/popup/index.html and
 * src/options/index.html as natural HTML entries and emits them at the
 * expected subpaths under dist/.
 */
export default defineConfig({
  root: resolve(__dirname, 'src'),
  publicDir: resolve(__dirname, 'public'),
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    sourcemap: true,
    minify: false,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/index.html'),
        options: resolve(__dirname, 'src/options/index.html'),
        background: resolve(__dirname, 'src/background/index.ts'),
        content: resolve(__dirname, 'src/content/index.ts'),
      },
      output: {
        entryFileNames: '[name]/index.js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
        format: 'es',
      },
    },
  },
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@content': resolve(__dirname, 'src/content'),
      '@background': resolve(__dirname, 'src/background'),
      '@popup': resolve(__dirname, 'src/popup'),
      '@options': resolve(__dirname, 'src/options'),
    },
  },
});
