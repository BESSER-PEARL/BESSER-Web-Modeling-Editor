import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const libraryLib = path.resolve(__dirname, '../library/lib');
const webappSrc = path.resolve(__dirname, 'src');

// SA-7b: the library uses its own `@/*` → `lib/*` alias internally; the webapp
// uses `@/*` → `src/*`. After flipping `@besser/wme` to point at the library
// source, vitest needs to disambiguate per-importer. We use a custom resolver
// for `@/` that picks the library lib/ when the requesting module is inside
// packages/library, and the webapp src/ otherwise.
import fs from 'node:fs';
function resolveAtPath(source: string, importer?: string): string {
  const inLibrary = importer && importer.includes(`${path.sep}packages${path.sep}library${path.sep}`);
  const base = inLibrary ? libraryLib : webappSrc;
  const target = path.join(base, source);
  // 1) literal file
  if (fs.existsSync(target) && fs.statSync(target).isFile()) return target;
  // 2) try with extensions
  for (const ext of ['.ts', '.tsx', '.js', '.jsx']) {
    if (fs.existsSync(target + ext)) return target + ext;
  }
  // 3) directory + index.{ts,tsx,js,jsx}
  if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
    for (const ext of ['ts', 'tsx', 'js', 'jsx']) {
      const idx = path.join(target, `index.${ext}`);
      if (fs.existsSync(idx)) return idx;
    }
  }
  return target;
}
const conditionalAtAlias = {
  find: /^@\/(.*)/,
  replacement: '$1',
  customResolver(source: string, importer?: string) {
    return resolveAtPath(source, importer);
  },
};

export default defineConfig({
  plugins: [react()],
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
