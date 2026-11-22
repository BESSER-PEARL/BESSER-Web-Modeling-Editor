import type {
  SpecDrivenFindingsView,
  SpecDrivenPhaseView,
  SpecDrivenToolCallView,
} from "@/main/features/spec-driven/types"

/** One validation round and how its blockers compare with the round before. */
export interface FindingsSegment {
  kind: "findings"
  round: SpecDrivenFindingsView
  /** Set only when both rounds' lists are complete (not capped). */
  diff?: { fixed: string[]; remaining: string[]; added: string[] }
}

/** Tool calls; `attempt` is the fix attempt they belong to (none before the first check). */
export interface CallsSegment {
  kind: "calls"
  calls: SpecDrivenToolCallView[]
  attempt?: number
}

export type RepairSegment = FindingsSegment | CallsSegment

const complete = (round: SpecDrivenFindingsView) => round.blockers.length === round.blockerCount

/**
 * The validate row as it happened: each check's findings, then the fix
 * attempt's tool calls, then the re-check. A round's tool calls are those
 * that arrived between it and the next round.
 */
export function repairTimeline(phase: SpecDrivenPhaseView): RepairSegment[] {
  const rounds = phase.findings ?? []
  const calls = phase.toolCalls
  if (rounds.length === 0) return calls.length > 0 ? [{ kind: "calls", calls }] : []
  const segments: RepairSegment[] = []
  const before = calls.slice(0, rounds[0].afterToolCalls)
  if (before.length > 0) segments.push({ kind: "calls", calls: before })
  rounds.forEach((round, k) => {
    const previous = rounds[k - 1]
    const segment: FindingsSegment = { kind: "findings", round }
    if (previous && complete(previous) && complete(round)) {
      const now = new Set(round.blockers)
      const then = new Set(previous.blockers)
      segment.diff = {
        fixed: previous.blockers.filter((b) => !now.has(b)),
        remaining: round.blockers.filter((b) => then.has(b)),
        added: round.blockers.filter((b) => !then.has(b)),
      }
    }
    segments.push(segment)
    const next = rounds[k + 1]
    const attemptCalls = calls.slice(round.afterToolCalls, next ? next.afterToolCalls : calls.length)
    // A re-check follows an attempt even when that attempt called no tool.
    if (attemptCalls.length > 0 || (next && !next.restored)) {
      segments.push({ kind: "calls", calls: attemptCalls, attempt: round.attempt + 1 })
    }
  })
  return segments
}

/** How many fix attempts the row shows. */
export const fixAttemptCount = (segments: RepairSegment[]): number =>
  segments.filter((s) => s.kind === "calls" && s.attempt !== undefined).length
