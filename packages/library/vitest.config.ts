import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import { resolve } from "path"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "lib"),
      "@/": resolve(__dirname, "lib/"),
      // SA-FINAL-3 Tier 8 #13: force test + source to share a single React
      // instance. `packages/library/node_modules/react` is 18.3.1 and
      // `frontend/node_modules/react` is 18.2.0; without this alias the
      // test imports React from one tree and the rendered component
      // imports it from the other, so `useMemo` reads a `null` dispatcher
      // and every <MultilineText> render test crashes (8 failures).
      react: resolve(__dirname, "../../node_modules/react"),
      "react-dom": resolve(__dirname, "../../node_modules/react-dom"),
    },
    dedupe: ["react", "react-dom"],
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      include: ["lib/**/*.{ts,tsx}"],
      exclude: [
        "lib/**/index.{ts,tsx}",
        "lib/**/*.d.ts",
        "lib/styles/**",
        "lib/constants/**",
      ],
    },
  },
})
