import { describe, expect, it, vi } from "vitest"

// Only the config object matters; the real vite/esbuild cannot load under jsdom.
vi.mock("vite", () => ({ defineConfig: (c: unknown) => c }))
vi.mock("@vitejs/plugin-react", () => ({ default: () => ({}) }))
vi.mock("vite-plugin-dts", () => ({ default: () => ({}) }))

describe("library build config", () => {
  // The published dist referenced the ELK worker as "/assets/elk.worker-*.js",
  // which resolves against the host origin, so consumers never got the worker.
  it("emits asset URLs relative to the dist chunk", async () => {
    // A non-literal specifier keeps the build config out of the test typecheck.
    const path = "../../vite.config"
    const { default: config } = await import(/* @vite-ignore */ path)
    expect((config as { base?: string }).base).toBe("./")
  })
})
