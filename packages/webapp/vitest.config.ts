import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { conditionalAtAlias } from './atAlias';

export default defineConfig({
  plugins: [react()],
  // Same injection as vite.config.ts, so tests see the real editor version.
  define: {
    'process.env.EDITOR_VERSION': JSON.stringify(
      JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8')).version,
    ),
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
  resolve: {
    alias: [
      conditionalAtAlias,
      { find: '@besser/wme', replacement: path.resolve(__dirname, '../library/lib/index.tsx') },
      { find: 'shared', replacement: path.resolve(__dirname, '../shared/src/index.ts') },
      { find: /^webapp\/(.*)/, replacement: path.resolve(__dirname, './$1') },
    ],
  },
});
