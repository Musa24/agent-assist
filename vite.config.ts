import { defineConfig } from 'vite';
import { resolve } from 'node:path';

/**
 * Multi-entry build for the Insystem Chrome Extension (MV3).
 * Each entry produces a standalone JS bundle in dist/.
 */
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    minify: false,
    rollupOptions: {
      input: {
        content: resolve(__dirname, 'src/content/index.ts'),
        popup: resolve(__dirname, 'src/popup/index.ts'),
        background: resolve(__dirname, 'src/background/index.ts'),
        options: resolve(__dirname, 'src/options/index.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name].js',
        assetFileNames: 'assets/[name][extname]',
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
  publicDir: 'public',
});
