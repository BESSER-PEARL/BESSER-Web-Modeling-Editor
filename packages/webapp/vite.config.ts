import path from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react(), svgr()],
    publicDir: 'assets',
    resolve: {
      alias: [
        { find: '@', replacement: path.resolve(__dirname, './src') },
        { find: '@besser/wme', replacement: path.resolve(__dirname, '../editor/src/main/index.ts') },
        { find: 'shared', replacement: path.resolve(__dirname, '../shared/src/index.ts') },
        { find: 'webapp', replacement: path.resolve(__dirname, '.') },
        // Exact match required: string alias does prefix matching, which would
        // also catch 'plotly.js-dist-min/plotly.min.js' inside the shim itself.
        { find: /^plotly\.js-dist-min$/, replacement: path.resolve(__dirname, './src/plotly-compat.js') },
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
