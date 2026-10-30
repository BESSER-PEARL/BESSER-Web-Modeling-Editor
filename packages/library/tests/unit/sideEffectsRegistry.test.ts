import { describe, expect, it } from "vitest"
import { readdirSync, readFileSync, statSync } from "fs"
import { join, relative, resolve } from "path"

/**
 * Node, edge, inspector and connection-rule modules register themselves at
 * import time. The package's `sideEffects` list must cover them, or a
 * production build tree-shakes the registrations away: state, agent, NN and
 * user nodes then render as empty default boxes with no edges (dev is fine).
 */
const ROOT = resolve(__dirname, "../..")
const TOP_LEVEL_REGISTER = /^\s{0,2}register[A-Za-z]*\(/m

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })

describe("package.json sideEffects", () => {
  it("covers every module that registers itself at import time", () => {
    const { sideEffects } = JSON.parse(
      readFileSync(join(ROOT, "package.json"), "utf-8")
    ) as { sideEffects: string[] }
    const covered = (file: string) =>
      sideEffects.some((pattern) => {
        const p = pattern.replace(/^\.\//, "")
        return p.endsWith("/**") ? file.startsWith(p.slice(0, -2)) : file === p
      })
    const registering = walk(join(ROOT, "lib"))
      .filter((f) => /\.tsx?$/.test(f) && !f.includes("__tests__"))
      .filter((f) => TOP_LEVEL_REGISTER.test(readFileSync(f, "utf-8")))
      .map((f) => relative(ROOT, f).split("\\").join("/"))
      .filter((f) => !f.startsWith("lib/services/connectionRules/registry"))
    expect(registering.length).toBeGreaterThan(10)
    expect(registering.filter((f) => !covered(f))).toEqual([])
  })
})
