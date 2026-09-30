import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import dts from "vite-plugin-dts"
import { resolve } from "path"

export default defineConfig({
  // entryRoot pins the .d.ts layout to lib/: the translation bundles are
  // imported from ../i18n, which would otherwise widen the computed root.
  plugins: [react(), dts({ include: ["lib"], entryRoot: "lib" })],
  build: {
    copyPublicDir: false,
    lib: {
      name: "besser-library",
      entry: resolve(__dirname, "lib/index.tsx"),
      formats: ["es"],
      cssFileName: "style",
    },
    // Do not externalize React: bundle everything so consumers don't need React installed
    rollupOptions: {
      output: {
        assetFileNames: "assets/[name][extname]",
        entryFileNames: "index.js",
      },
    },
    minify: true,
    commonjsOptions: {
      include: [/node_modules/],
      // No exclusions: allow bundling of all deps
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "lib"),
    },
    dedupe: ["react", "react-dom", "@emotion/react", "@emotion/styled"],
  },
  esbuild: { drop: ["console", "debugger"] },
})
