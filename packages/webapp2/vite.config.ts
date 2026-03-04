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
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@besser/wme': path.resolve(__dirname, '../editor/src/main/index.ts'),
        shared: path.resolve(__dirname, '../shared/src/index.ts'),
        webapp: path.resolve(__dirname, '.'),
      },
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
      hmr: {
        host: 'localhost',
      },
      watch: {
        usePolling: true,
        interval: 300,
      },
    },
  };
});
