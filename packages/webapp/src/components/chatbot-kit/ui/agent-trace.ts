/**
 * Who wrote each line of a Spec-Driven run's files, read from the Agent Trace
 * record the run ships in its zip (`.agent-trace/<run id>.json`, written by
 * BESSER's `besser/spec_driven_agent/state/agent_trace.py`).
 *
 * The record lists, per file, line ranges per contributor. BESSER's generators
 * are contributor type `unknown` with a `generator` related link; code that was
 * already there with no attribution is `unknown` without one. Each range carries
 * the sha256 of its lines, checked here: a file that changed after the record
 * was written gets no attribution rather than a wrong one.
 */

export type LineAuthor = "ai" | "generator" | "human" | "unknown"

export interface FileAttribution {
  /** Author of each line; index 0 is line 1. */
  authors: LineAuthor[]
  counts: Record<LineAuthor, number>
}

export interface RunAttribution {
  files: Map<string, FileAttribution>
  /** Files the record covers but whose content no longer matches it. */
  stale: Set<string>
}

const TRACE_DIR = ".agent-trace/"

/** Whether a zip path is an Agent Trace record. */
export const isAgentTracePath = (path: string): boolean =>
  path.startsWith(TRACE_DIR) && path.endsWith(".json") && !path.slice(TRACE_DIR.length).includes("/")

interface TraceRange {
  start_line: number
  end_line: number
  content_hash?: string
}

interface TraceConversation {
  contributor?: { type?: string }
  ranges?: TraceRange[]
  related?: { type?: string }[]
}

interface TraceRecord {
  timestamp?: string
  files?: { path?: string; conversations?: TraceConversation[] }[]
}

const authorOf = (conversation: TraceConversation): LineAuthor => {
  const type = conversation.contributor?.type
  if (type === "ai") return "ai"
  if (type === "human") return "human"
  const fromGenerator = (conversation.related ?? []).some((r) => r?.type === "generator")
  return fromGenerator ? "generator" : "unknown"
}

/** Lines as Python's `splitlines()` sees them for ordinary text: no trailing empty line. */
export const textLines = (text: string): string[] => {
  const lines = text.split(/\r\n|\r|\n/)
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop()
  return lines
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("")
}

/** This run's record: `<runId>.json`, else the newest one in the zip. */
function pickRecord(
  files: { path: string; text: string | null }[],
  runId?: string,
): TraceRecord | null {
  const records: TraceRecord[] = []
  for (const file of files) {
    if (!isAgentTracePath(file.path) || file.text === null) continue
    let parsed: unknown
    try {
      parsed = JSON.parse(file.text)
    } catch {
      continue
    }
    if (!parsed || typeof parsed !== "object") continue
    if (runId && file.path === `${TRACE_DIR}${runId}.json`) return parsed as TraceRecord
    records.push(parsed as TraceRecord)
  }
  records.sort((a, b) => String(b.timestamp ?? "").localeCompare(String(a.timestamp ?? "")))
  return records[0] ?? null
}

/**
 * Line authorship for the files in a run's zip, or null when the zip holds no
 * usable Agent Trace record (a deterministic run, an older backend, or a run
 * whose attribution failed and shipped no record).
 */
export async function readRunAttribution(
  files: { path: string; text: string | null }[],
  runId?: string,
): Promise<RunAttribution | null> {
  const record = pickRecord(files, runId)
  if (!record || !Array.isArray(record.files)) return null
  const byPath = new Map(files.map((f) => [f.path, f]))
  const result: RunAttribution = { files: new Map(), stale: new Set() }
  for (const entry of record.files) {
    if (typeof entry?.path !== "string") continue
    const file = byPath.get(entry.path)
    if (!file || file.text === null) continue
    const lines = textLines(file.text)
    const authors: (LineAuthor | undefined)[] = Array.from({ length: lines.length }, () => undefined)
    let valid = true
    for (const conversation of entry.conversations ?? []) {
      const author = authorOf(conversation)
      for (const range of conversation.ranges ?? []) {
        const start = range.start_line
        const end = range.end_line
        if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start || end > lines.length) {
          valid = false
          break
        }
        if (range.content_hash) {
          const actual = `sha256:${await sha256Hex(lines.slice(start - 1, end).join("\n"))}`
          if (actual !== range.content_hash) {
            valid = false
            break
          }
        }
        for (let i = start - 1; i < end; i++) authors[i] = author
      }
      if (!valid) break
    }
    if (!valid || authors.includes(undefined)) {
      result.stale.add(entry.path)
      continue
    }
    const counts: Record<LineAuthor, number> = { ai: 0, generator: 0, human: 0, unknown: 0 }
    for (const author of authors as LineAuthor[]) counts[author]++
    result.files.set(entry.path, { authors: authors as LineAuthor[], counts })
  }
  return result.files.size > 0 || result.stale.size > 0 ? result : null
}
