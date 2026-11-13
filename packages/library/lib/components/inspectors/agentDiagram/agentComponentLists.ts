import type { Node } from "@xyflow/react"
import {
  diagramBridge,
  type AgentGUIInfo,
  type AgentIntentInfo,
  type AgentLLMInfo,
  type AgentRAGInfo,
} from "@/services/diagramBridge"

/**
 * Agent components (intents, LLMs, RAG databases, GUIs) the AgentState and
 * transition inspectors offer in their dropdowns.
 *
 * They live off-canvas in the diagram's `model.components` (agent
 * Components page); the webapp is the single writer of the lists in
 * `diagramBridge`. When the bridge has nothing (e.g. the library used on
 * its own with a legacy model that still keeps them as nodes), fall back to
 * component-typed nodes in the store.
 */
export interface AgentComponentLists {
  intents: AgentIntentInfo[]
  llms: AgentLLMInfo[]
  rags: AgentRAGInfo[]
  guis: AgentGUIInfo[]
  platform: string
}

const nodeName = (n: Node): string =>
  String((n.data as { name?: unknown } | undefined)?.name ?? "").trim()

const uniqueBy = <T>(items: T[], key: (item: T) => string): T[] => {
  const seen = new Set<string>()
  return items.filter((item) => {
    const k = key(item)
    if (!k || seen.has(k)) return false
    seen.add(k)
    return true
  })
}

export const getAgentComponentLists = (nodes: Node[]): AgentComponentLists => {
  const bridgeIntents = diagramBridge.getAgentIntents()
  const bridgeLlms = diagramBridge.getAgentLLMs()
  const bridgeRags = diagramBridge.getAgentRAGs()
  const ofType = (type: string) => nodes.filter((n) => (n.type as string) === type)

  const intents = bridgeIntents.length
    ? bridgeIntents
    : ofType("AgentIntent").map((n) => ({ name: nodeName(n), id: n.id }))
  const llms = bridgeLlms.length
    ? bridgeLlms
    : ofType("AgentLLM").map((n) => ({
        name: nodeName(n),
        provider: String(
          (n.data as { provider?: unknown } | undefined)?.provider ?? ""
        ).toLowerCase(),
      }))
  const rags = bridgeRags.length
    ? bridgeRags
    : ofType("AgentRagElement").map((n) => ({ name: nodeName(n) }))

  return {
    intents: uniqueBy(intents, (i) => i.name.trim()),
    llms: uniqueBy(llms, (l) => l.name.trim()),
    rags: uniqueBy(rags, (r) => r.name.trim()),
    guis: diagramBridge.getAgentGUIs(),
    platform: diagramBridge.getAgentPlatform(),
  }
}

type IntentRefEdge = { data?: Record<string, unknown> }

/**
 * Point every `when_intent_matched` transition naming `oldName` at
 * `newName`, so renaming an intent does not orphan its transitions.
 * Returns the input array when nothing references `oldName`.
 */
export const renameIntentInTransitions = <E extends IntentRefEdge>(
  edges: E[],
  oldName: string,
  newName: string
): E[] => {
  if (!oldName || oldName === newName) return edges
  let changed = false
  const next = edges.map((e) => {
    const predefined = e.data?.predefined as
      | { predefinedType?: string; intentName?: string }
      | undefined
    if (
      predefined?.predefinedType !== "when_intent_matched" ||
      predefined.intentName !== oldName
    ) {
      return e
    }
    changed = true
    return {
      ...e,
      data: { ...e.data, predefined: { ...predefined, intentName: newName } },
    }
  })
  return changed ? next : edges
}
