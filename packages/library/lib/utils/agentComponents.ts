/**
 * Off-canvas agent components (v4 `UMLModel.components`).
 *
 * Agent components — LLMs, intents and their training sentences, RAG
 * databases, tools, skills, workspaces and GUIs — are not diagram geometry.
 * They are edited in the webapp's agent Components page and stored in a
 * top-level `components` map on the AgentDiagram model, keyed by id:
 *
 * ```ts
 * model.components = {
 *   [id]: { id, type: AgentComponentType, name, owner: string | null, ...typeFields }
 * }
 * ```
 *
 * The entry shape is exactly the smart-generator v3 `model.components` entry
 * (flat fields, no `bounds` / `position`), so v3 and v4 share it verbatim.
 * See `docs/source/migrations/uml-v4-shape.md` → AgentDiagram → Components.
 *
 * Legacy locations migrated by {@link normalizeAgentComponents}:
 *  - v4 `nodes` of a component type (pre-Components-page React Flow models
 *    rendered intents / LLMs / RAG / tools / skills / workspaces on the
 *    canvas). Their `data` is flattened onto the component, and an intent's
 *    `data.training_phrases` (or `data.bodies`) rows become
 *    `AgentIntentBody` components owned by the intent.
 *  - `model.agentComponents` (an early build of the components panel).
 *
 * Entries already present in `components` win over migrated copies.
 */
import type { BesserEdge, BesserNode, UMLModel } from "@/typings"

export const AgentComponentType = {
  AgentLLM: "AgentLLM",
  AgentIntent: "AgentIntent",
  AgentIntentBody: "AgentIntentBody",
  AgentRagElement: "AgentRagElement",
  AgentTool: "AgentTool",
  AgentSkill: "AgentSkill",
  AgentWorkspace: "AgentWorkspace",
  AgentGUI: "AgentGUI",
} as const

export type AgentComponentType =
  (typeof AgentComponentType)[keyof typeof AgentComponentType]

/**
 * One off-canvas agent component. Type-specific payload fields sit flat on
 * the entry (e.g. `bodies` + `intent_description` on an intent, `provider` /
 * `parameters` on an LLM, `gui_id` / `is_form` / `guiModel` on a GUI).
 */
export type UMLModelComponent = {
  id: string
  type: AgentComponentType | string
  name: string
  owner?: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [field: string]: any
}

export type AgentComponents = { [id: string]: UMLModelComponent }

export const AGENT_COMPONENT_TYPES: ReadonlySet<string> = new Set<string>(
  Object.values(AgentComponentType)
)

export const isAgentComponentType = (type: unknown): boolean =>
  typeof type === "string" && AGENT_COMPONENT_TYPES.has(type)

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

/**
 * Strip canvas geometry from a component entry (components have no
 * position). Only geometry keys go: `width` / `height` inside an entry
 * (or a node's `data`) are payload — e.g. `AgentGUI.width` — and are kept.
 * A node's own top-level `width` / `height` never reach this function
 * because only `node.data` is spread into the entry.
 */
const stripGeometry = (entry: Record<string, unknown>): UMLModelComponent => {
  const {
    bounds: _bounds,
    position: _position,
    measured: _measured,
    parentId: _parentId,
    ...rest
  } = entry
  return rest as UMLModelComponent
}

/**
 * Convert a legacy canvas node of a component type into component entries
 * (the component itself, plus `AgentIntentBody` entries for an intent's
 * inline training-phrase rows).
 */
const nodeToComponents = (node: BesserNode): UMLModelComponent[] => {
  const data = isRecord(node.data) ? { ...node.data } : {}
  const out: UMLModelComponent[] = []
  if (node.type === AgentComponentType.AgentIntent) {
    const rows = Array.isArray(data.training_phrases)
      ? data.training_phrases
      : Array.isArray(data.bodies)
        ? data.bodies
        : []
    delete data.training_phrases
    const bodyIds: string[] = []
    rows.forEach((row: unknown, index: number) => {
      if (typeof row === "string") {
        // Already a list of body ids (v3-shaped intent) — keep as is.
        bodyIds.push(row)
        return
      }
      if (!isRecord(row)) return
      const bodyId =
        typeof row.id === "string" && row.id ? row.id : `${node.id}-body-${index}`
      bodyIds.push(bodyId)
      out.push({
        id: bodyId,
        type: AgentComponentType.AgentIntentBody,
        name: typeof row.name === "string" ? row.name : "",
        owner: node.id,
      })
    })
    out.unshift({
      ...stripGeometry(data),
      id: node.id,
      type: AgentComponentType.AgentIntent,
      name: typeof data.name === "string" ? data.name : "",
      owner: null,
      intent_description:
        typeof data.intent_description === "string" ? data.intent_description : "",
      bodies: bodyIds,
    })
    return out
  }
  if ((node.type as string) === AgentComponentType.AgentIntentBody) {
    return [
      {
        ...stripGeometry(data),
        id: node.id,
        type: AgentComponentType.AgentIntentBody,
        name: typeof data.name === "string" ? data.name : "",
        owner: node.parentId ?? (typeof data.owner === "string" ? data.owner : null),
      },
    ]
  }
  return [
    {
      ...stripGeometry(data),
      id: node.id,
      type: node.type,
      name: typeof data.name === "string" ? data.name : "",
      owner: null,
    },
  ]
}

/**
 * Move agent components into `model.components` (v4).
 *
 * Pure (never mutates its input), idempotent, and a no-op (same reference
 * returned) for non-agent models or agent models with nothing to migrate.
 * Edges attached to a migrated node are dropped (components are not
 * connectable).
 */
export function normalizeAgentComponents<T extends UMLModel>(model: T): T {
  if (!model || (model.type as string) !== "AgentDiagram") return model
  const nodes: BesserNode[] = Array.isArray(model.nodes) ? model.nodes : []
  const legacy = (model as { agentComponents?: unknown }).agentComponents
  const movedIds = new Set(
    nodes.filter((n) => isAgentComponentType(n?.type)).map((n) => n.id)
  )
  if (movedIds.size === 0 && legacy === undefined) return model

  const components: AgentComponents = {}
  for (const node of nodes) {
    if (!movedIds.has(node.id)) continue
    for (const component of nodeToComponents(node)) {
      components[component.id] = component
    }
  }
  if (isRecord(legacy)) {
    for (const [id, entry] of Object.entries(legacy)) {
      if (isRecord(entry)) components[id] = { ...stripGeometry(entry), id }
    }
  }
  Object.assign(components, model.components || {})

  const edges: BesserEdge[] = Array.isArray(model.edges) ? model.edges : []
  const { agentComponents: _legacy, ...rest } = model as T & {
    agentComponents?: unknown
  }
  return {
    ...rest,
    nodes: nodes.filter((n) => !movedIds.has(n.id)),
    edges: edges.filter((e) => !movedIds.has(e.source) && !movedIds.has(e.target)),
    components,
  } as unknown as T
}

/** Components of one type, in insertion order. */
export function getAgentComponentsOfType(
  components: AgentComponents | undefined,
  type: AgentComponentType
): UMLModelComponent[] {
  return Object.values(components || {}).filter((c) => c?.type === type)
}

/**
 * Whether a "when intent matched" transition names an intent the agent no
 * longer defines (deleted or renamed). Unknown (false) when no intent list is
 * available at all, e.g. the library used without the webapp's components.
 */
export const isMissingIntent = (
  intentName: string | undefined,
  intents: readonly { name: string }[]
): boolean => !!intentName && intents.length > 0 && !intents.some((i) => i.name === intentName)
