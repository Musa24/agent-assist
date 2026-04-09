import { defineConfig } from 'vite';
import { resolve } from 'node:path';

/**
 * Dedicated build for the MV3 content script.
 *
 * Content scripts declared in manifest.json are NOT loaded as ES modules,
 * so we cannot share chunks with the main ES-module build. This config uses
 * Vite's `build.lib` IIFE output to produce a single self-contained bundle
 * at `dist/content/index.js` with all imports inlined.
 *
 * Runs as the second step of the `build` script, with emptyOutDir: false
 * so it does not wipe the main build's output.
 */
export default defineConfig({
  publicDir: false,
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: false,
    sourcemap: true,
    minify: false,
    lib: {
      entry: resolve(__dirname, 'src/content/index.ts'),
      name: 'AgentAssistContent',
      formats: ['iife'],
      fileName: () => 'content/index.js',
    },
    rollupOptions: {
      output: {
        extend: true,
      },
    },
  },
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@content': resolve(__dirname, 'src/content'),
    },
  },
});
