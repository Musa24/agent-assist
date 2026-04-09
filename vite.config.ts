import { defineConfig } from 'vite';
import { resolve } from 'node:path';

/**
 * Main multi-entry build for the Agent Assist Chrome Extension (MV3).
 *
 * Builds popup, options, and background into dist/. Popup + options are HTML
 * entries (ES modules are fine there); background is an ES module service
 * worker declared as `type: module` in manifest.json.
 *
 * The CONTENT SCRIPT is NOT part of this config. Content scripts in MV3
 * cannot be ES modules, so they need IIFE output — which cannot share chunks
 * with ES entries. Content is built separately via `vite.config.content.ts`,
 * chained after this one in the `build` npm script.
 *
 * Layout (dist/):
 *   manifest.json, icons/   — copied from public/
 *   background/index.js     — service worker (ES module)
 *   popup/index.{html,js}   — extension popup
 *   options/index.{html,js} — options page
 *   content/index.js        — added by vite.config.content.ts (IIFE)
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
