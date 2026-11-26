import { createHash } from "crypto"
import { describe, expect, it } from "vitest"

import { isAgentTracePath, readRunAttribution, textLines } from "../agent-trace"

const RUN = "e8834aa911ae4049b5fa5c5af1357a13"
const hash = (lines: string[]) => `sha256:${createHash("sha256").update(lines.join("\n")).digest("hex")}`

const MAIN = ["from fastapi import FastAPI", "", "app = FastAPI()", "app.include_router(books)", ""].join("\n")
const MAIN_LINES = textLines(MAIN)

/** Shaped like a real record (run t2-a4, 2026-11-17): generators are `unknown` + a generator link. */
const record = (ranges = { generator: [1, 3], ai: [4, 4] }) =>
  JSON.stringify({
    version: "0.1",
    timestamp: "2026-11-17T20:00:00+00:00",
    files: [
      {
        path: "backend/main.py",
        conversations: [
          {
            contributor: { type: "unknown" },
            ranges: [{ start_line: ranges.generator[0], end_line: ranges.generator[1],
              content_hash: hash(MAIN_LINES.slice(ranges.generator[0] - 1, ranges.generator[1])) }],
            related: [{ type: "generator", url: "urn:besser:generator:generate_fastapi_backend@8.10.1" }],
          },
          {
            contributor: { type: "ai", model_id: "anthropic/claude-sonnet-5-5" },
            ranges: [{ start_line: ranges.ai[0], end_line: ranges.ai[1],
              content_hash: hash(MAIN_LINES.slice(ranges.ai[0] - 1, ranges.ai[1])) }],
            related: [{ type: "session", url: `urn:besser:run:${RUN}` }],
          },
        ],
      },
    ],
    metadata: { "org.besser-pearl": { run_id: RUN } },
  })

describe("readRunAttribution", () => {
  it("gives each line its author, telling the generator apart from unknown code", async () => {
    const result = await readRunAttribution([
      { path: "backend/main.py", text: MAIN },
      { path: `.agent-trace/${RUN}.json`, text: record() },
    ], RUN)
    const main = result!.files.get("backend/main.py")!
    expect(main.authors).toEqual(["generator", "generator", "generator", "ai"])
    expect(main.counts).toEqual({ ai: 1, generator: 3, human: 0, unknown: 0 })
  })

  it("shows nothing for a file that changed after the record was written", async () => {
    const edited = MAIN.replace("app = FastAPI()", "app = FastAPI(title='x')")
    const result = await readRunAttribution([
      { path: "backend/main.py", text: edited },
      { path: `.agent-trace/${RUN}.json`, text: record() },
    ], RUN)
    expect(result!.files.has("backend/main.py")).toBe(false)
    expect(result!.stale.has("backend/main.py")).toBe(true)
  })

  it("prefers this run's record over an earlier run's", async () => {
    const earlier = record({ generator: [1, 4], ai: [4, 4] }).replace('"2026-11-17T20', '"2026-11-18T20')
    const result = await readRunAttribution([
      { path: "backend/main.py", text: MAIN },
      { path: ".agent-trace/0000aaaa.json", text: earlier },
      { path: `.agent-trace/${RUN}.json`, text: record() },
    ], RUN)
    expect(result!.files.get("backend/main.py")!.counts.ai).toBe(1)
  })

  it("is null without a record", async () => {
    expect(await readRunAttribution([{ path: "backend/main.py", text: MAIN }], RUN)).toBeNull()
    expect(await readRunAttribution([{ path: `.agent-trace/${RUN}.json`, text: "{not json" }], RUN)).toBeNull()
  })

  it("recognises only top-level trace records", () => {
    expect(isAgentTracePath(`.agent-trace/${RUN}.json`)).toBe(true)
    expect(isAgentTracePath("src/.agent-trace/x.json")).toBe(false)
    expect(isAgentTracePath(".agent-trace/nested/x.json")).toBe(false)
  })

  it("counts lines like Python's splitlines", () => {
    expect(textLines("a\nb\n")).toEqual(["a", "b"])
    expect(textLines("a\r\nb")).toEqual(["a", "b"])
  })
})
