import type { Translate } from "@/i18n"

/**
 * Agent-to-agent (A2A) tags, ported from develop's `a2a-notation.tsx`.
 * Grammar: `a2a:in|a2a:out` then `;key=value` parts (`peer`, `ref`, `flow`,
 * `order`, `kind`). AgentState `description` holds one `a2a:out` tag per
 * line; an AgentStateTransition `name` holds one `a2a:in` tag.
 */
export interface A2ATag {
  dir: "in" | "out"
  raw: string
  peer?: string
  ref?: string
  flow?: string
  order?: string
  kind?: string
}

export function parseA2ATag(value?: string): A2ATag | undefined {
  if (!value) return undefined
  const raw = value.trim()
  if (!raw.startsWith("a2a:")) return undefined

  const parts = raw.split(";")
  const head = parts[0]
  const dir = head === "a2a:in" ? "in" : head === "a2a:out" ? "out" : undefined
  if (!dir) return undefined

  const tag: A2ATag = { dir, raw }
  for (const part of parts.slice(1)) {
    const eq = part.indexOf("=")
    if (eq <= 0) continue
    const key = part.slice(0, eq)
    const val = part.slice(eq + 1)
    if (key === "peer") tag.peer = val
    else if (key === "ref") tag.ref = val
    else if (key === "flow") tag.flow = val
    else if (key === "order") tag.order = val
    else if (key === "kind") tag.kind = val
  }
  return tag
}

export function parseA2AOutTags(description?: string): A2ATag[] {
  if (!description) return []
  return description
    .split(/\r?\n/)
    .map((line) => parseA2ATag(line))
    .filter((tag): tag is A2ATag => tag?.dir === "out")
}

/** One "Send to <peer>" / "Receive from <peer>" line per tag. */
export function a2aTitle(tags: A2ATag[], t: Translate): string {
  return tags
    .map((tag) => {
      const action =
        tag.dir === "in"
          ? t("packages.AgentDiagram.A2AReceiveFrom", "Receive from")
          : t("packages.AgentDiagram.A2ASendTo", "Send to")
      return `${action} ${tag.peer || t("packages.AgentDiagram.A2APeer", "peer")}`
    })
    .join("\n")
}
