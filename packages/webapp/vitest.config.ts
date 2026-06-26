import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@besser/wme': path.resolve(__dirname, '../editor/src/main/index.ts'),
      shared: path.resolve(__dirname, '../shared/src/index.ts'),
      webapp: path.resolve(__dirname, '.'),
    },
  },
});
