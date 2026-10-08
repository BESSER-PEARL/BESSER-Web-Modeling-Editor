import fs from 'node:fs';
import path from 'node:path';

const libraryLib = path.resolve(__dirname, '../library/lib');
const webappSrc = path.resolve(__dirname, './src');

/**
 * `@/x` resolves against the library's `lib/` when imported from the library
 * (which uses `@/*` internally) and against the webapp's `src/` otherwise.
 * Shared by vite.config.ts and vitest.config.ts so both resolve identically.
 */
export function resolveAtPath(source: string, importer?: string): string {
  // Vite hands importers in posix form even on Windows; match on the literal.
  const inLibrary = (importer ?? '').replace(/\\/g, '/').includes('/packages/library/');
  const target = path.join(inLibrary ? libraryLib : webappSrc, source);
  const resolved = (() => {
    if (fs.existsSync(target) && fs.statSync(target).isFile()) return target;
    for (const ext of ['.ts', '.tsx', '.js', '.jsx']) {
      if (fs.existsSync(target + ext)) return target + ext;
    }
    if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
      for (const ext of ['ts', 'tsx', 'js', 'jsx']) {
        const idx = path.join(target, `index.${ext}`);
        if (fs.existsSync(idx)) return idx;
      }
    }
    return target;
  })();
  // Forward slashes on Windows too: a backslash id makes Rollup bundle the same file twice
  // (two zustand stores / React contexts, TDZ errors at load).
  return resolved.split(path.sep).join('/');
}

export const conditionalAtAlias = {
  find: /^@\/(.*)/,
  replacement: '$1',
  customResolver: (source: string, importer?: string) => resolveAtPath(source, importer),
};
