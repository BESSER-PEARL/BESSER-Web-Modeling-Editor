import { describe, expect, it } from "vitest"

import type { SpecDrivenFindingsView, SpecDrivenPhaseView } from "@/main/features/spec-driven/types"
import { fixAttemptCount, repairTimeline } from "../run-repairs"

const IMPORT = "import [backend/main.py]: No module named 'routers.book'"
const SYNTAX = "Syntax error in backend/models.py line 3: invalid syntax"
const TSC = "tsc [frontend]: src/App.tsx(12,5): error TS2304: Cannot find name 'Book'"

const call = (turn: number, tool = "modify_file") => ({ turn, tool, detail: `path=f${turn}` })
const round = (attempt: number, blockers: string[], afterToolCalls: number, extra: Partial<SpecDrivenFindingsView> = {}) =>
  ({ attempt, blockers, blockerCount: blockers.length, issueCount: blockers.length, restored: false, afterToolCalls, ...extra })

const validate = (findings: SpecDrivenFindingsView[], calls: number): SpecDrivenPhaseView => ({
  phase: "validate",
  label: "Validating",
  message: "",
  toolCalls: Array.from({ length: calls }, (_, i) => call(i + 1)),
  findings,
})

describe("repairTimeline", () => {
  it("reads check, attempt, re-check, with what each attempt fixed", () => {
    const segments = repairTimeline(validate([
      round(0, [IMPORT, SYNTAX], 0),
      round(1, [SYNTAX, TSC], 2),
      round(2, [], 3),
    ], 3))
    expect(segments.map((s) => (s.kind === "calls" ? `calls:${s.attempt}:${s.calls.length}` : `check:${s.round.attempt}`)))
      .toEqual(["check:0", "calls:1:2", "check:1", "calls:2:1", "check:2"])
    const recheck = segments[2]
    expect(recheck.kind === "findings" && recheck.diff).toEqual({ fixed: [IMPORT], remaining: [SYNTAX], added: [TSC] })
    expect(fixAttemptCount(segments)).toBe(2)
  })

  it("does not claim a blocker was fixed when a list was capped", () => {
    const segments = repairTimeline(validate([
      round(0, [IMPORT], 0, { blockerCount: 30 }),
      round(1, [SYNTAX], 1, { blockerCount: 25 }),
    ], 1))
    const recheck = segments[2]
    expect(recheck.kind === "findings" && recheck.diff).toBeUndefined()
  })

  it("shows an attempt that called no tool before its re-check", () => {
    const segments = repairTimeline(validate([round(0, [IMPORT], 0), round(1, [IMPORT], 0)], 0))
    expect(segments[1]).toEqual({ kind: "calls", calls: [], attempt: 1 })
  })

  it("ends on a restored round without inventing an attempt before it", () => {
    const segments = repairTimeline(validate([
      round(0, [IMPORT], 0),
      round(1, [IMPORT, SYNTAX], 1),
      round(1, [IMPORT], 1, { restored: true }),
    ], 1))
    expect(segments.map((s) => s.kind)).toEqual(["findings", "calls", "findings", "findings"])
    expect(fixAttemptCount(segments)).toBe(1)
  })

  it("keeps tool calls made before the first check, and plain rows unchanged", () => {
    expect(repairTimeline(validate([round(0, [IMPORT], 1)], 1))[0]).toEqual({ kind: "calls", calls: [call(1)] })
    expect(repairTimeline({ ...validate([], 2), findings: undefined })).toEqual([
      { kind: "calls", calls: [call(1), call(2)] },
    ])
  })
})
