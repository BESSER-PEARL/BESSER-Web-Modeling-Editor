import path from 'node:path';
import fs from 'node:fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';

const libraryLib = path.resolve(__dirname, '../library/lib');
const webappSrc = path.resolve(__dirname, './src');

// SA-7b: dual-package `@/*` resolution. The library uses `@/*` → `lib/*`
// internally; the webapp uses `@/*` → `src/*`. After flipping the
// `@besser/wme` alias to point at library source, vite needs to pick the
// right base depending on the importer.
//
// Note: Vite normalizes importer paths to forward slashes regardless of
// platform (see vite/src/node/utils.ts). Match on `/packages/library/`
// (literal) instead of `path.sep` so this works on Windows too.
function resolveAtPath(source: string, importer?: string): string {
  const normalized = importer ? importer.replace(/\\/g, '/') : '';
  const inLibrary = normalized.includes('/packages/library/');
  const base = inLibrary ? libraryLib : webappSrc;
  const target = path.join(base, source);
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
}
const conditionalAtAlias = {
  find: /^@\/(.*)/,
  replacement: '$1',
  customResolver(source: string, importer?: string) {
    return resolveAtPath(source, importer);
  },
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react(), svgr()],
    publicDir: 'assets',
    resolve: {
      alias: [
        conditionalAtAlias,
        { find: '@besser/wme', replacement: path.resolve(__dirname, '../library/lib/index.tsx') },
        { find: 'shared', replacement: path.resolve(__dirname, '../shared/src/index.ts') },
        { find: /^webapp\/(.*)/, replacement: path.resolve(__dirname, './$1') },
      ],
    },
    define: {
      'process.env.APPLICATION_SERVER_VERSION': JSON.stringify(env.APPLICATION_SERVER_VERSION ?? ''),
      'process.env.DEPLOYMENT_URL': JSON.stringify(env.DEPLOYMENT_URL ?? ''),
      'process.env.BACKEND_URL': JSON.stringify(env.BACKEND_URL ?? ''),
      'process.env.SENTRY_DSN': JSON.stringify(env.SENTRY_DSN ?? ''),
      'process.env.POSTHOG_HOST': JSON.stringify(env.POSTHOG_HOST ?? ''),
      'process.env.POSTHOG_KEY': JSON.stringify(env.POSTHOG_KEY ?? ''),
      'process.env.UML_BOT_WS_URL': JSON.stringify(env.UML_BOT_WS_URL ?? ''),
    },
    server: {
      host: '0.0.0.0',
      port: 8080,
      hmr: true,
      watch: {
        usePolling: true,
        interval: 300,
      },
    },
  };
});
