import type { BesserEdge, UMLModel } from "@/typings"
import type { V3UMLRelationship } from "./v3Typings"
import {
  importDiagram,
  isV3Format,
  isV4Format,
  liftAgentTransitionDataToV4,
} from "./versionConverter"

/**
 * Flat / legacy transition keys that the canonical nested shape replaces.
 * They are consumed by the lifter and dropped from the edge `data` so a
 * normalised edge carries exactly one description of its trigger — the
 * backend agent processor only reads `transitionType` + `predefined` /
 * `custom`, and a lingering top-level `condition` used to make it collapse
 * the transition to `when_no_intent_matched`.
 */
const LEGACY_TRANSITION_KEYS: readonly string[] = [
  "condition",
  "conditionValue",
  "predefinedType",
  "intentName",
  "variable",
  "operator",
  "targetValue",
  "fileType",
  "event",
  "conditions",
  "customEvent",
  "customConditions",
  "customCondition",
]

type PredefinedBlock = {
  predefinedType: string
  intentName?: string
  fileType?: string
  conditionValue?:
    | string
    | { variable: string; operator: string; targetValue: string }
}

type CustomBlock = { event: string; condition: string[] }

type TransitionData = Record<string, unknown> & {
  transitionType?: unknown
  predefined?: unknown
  custom?: unknown
  params?: unknown
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

/**
 * Canonical `params` shape is a string-keyed dict (the inspector edits a
 * numeric-keyed dict). Older exports wrote a bare string or an ordered
 * array; lift both the way the v3 deserializer did.
 */
const normalizeParams = (params: unknown): Record<string, string> | undefined => {
  if (typeof params === "string") {
    return params.length > 0 ? { "0": params } : {}
  }
  if (Array.isArray(params)) {
    const out: Record<string, string> = {}
    params.forEach((param, index) => {
      if (typeof param === "string") out[String(index)] = param
    })
    return out
  }
  if (isRecord(params)) return params as Record<string, string>
  return undefined
}

/** Fill the defaults the v3 serializer always wrote for a predefined block. */
const canonicalPredefined = (block: Record<string, unknown>): PredefinedBlock => {
  const predefinedType =
    typeof block.predefinedType === "string" && block.predefinedType.length > 0
      ? block.predefinedType
      : "when_intent_matched"
  const out: PredefinedBlock = { predefinedType }
  if (predefinedType === "when_intent_matched") {
    out.intentName = typeof block.intentName === "string" ? block.intentName : ""
  } else if (predefinedType === "when_file_received") {
    out.fileType = typeof block.fileType === "string" ? block.fileType : ""
  } else if (predefinedType === "when_variable_operation_matched") {
    const cv = isRecord(block.conditionValue) ? block.conditionValue : {}
    out.conditionValue = {
      variable: typeof cv.variable === "string" ? cv.variable : "",
      operator: typeof cv.operator === "string" ? cv.operator : "",
      targetValue: typeof cv.targetValue === "string" ? cv.targetValue : "",
    }
  } else {
    out.conditionValue =
      typeof block.conditionValue === "string" ? block.conditionValue : ""
  }
  return out
}

const canonicalCustom = (block: Record<string, unknown>): CustomBlock => ({
  event:
    typeof block.event === "string" && block.event.length > 0
      ? block.event
      : "WildcardEvent",
  condition: Array.isArray(block.condition)
    ? block.condition.filter((c): c is string => typeof c === "string")
    : [],
})

/**
 * Normalise one `AgentStateTransition` edge's `data` to the canonical
 * nested shape. Exported for the tests; `normalizeAgentModel` is the
 * public entry point.
 *
 * An explicit, well-formed `transitionType` + matching block is treated as
 * authoritative (that is what the inspector writes — switching modes keeps
 * the other block around, so it must not be allowed to flip the mode
 * back). Anything else runs through the v3→v4 lifter, which collapses the
 * five historical flat shapes.
 */
export function normalizeAgentTransitionData(
  data: Record<string, unknown> | undefined
): Record<string, unknown> {
  const d: TransitionData = { ...(data ?? {}) }
  const explicitType =
    d.transitionType === "predefined" || d.transitionType === "custom"
      ? d.transitionType
      : undefined
  const hasCanonicalPredefined =
    explicitType === "predefined" &&
    isRecord(d.predefined) &&
    typeof d.predefined.predefinedType === "string" &&
    d.predefined.predefinedType.length > 0
  const hasCanonicalCustom =
    explicitType === "custom" &&
    isRecord(d.custom) &&
    typeof d.custom.event === "string"

  let lifted: Record<string, unknown>
  if (hasCanonicalPredefined) {
    lifted = {
      transitionType: "predefined",
      predefined: canonicalPredefined(d.predefined as Record<string, unknown>),
      ...(isRecord(d.custom) && { custom: canonicalCustom(d.custom) }),
    }
  } else if (hasCanonicalCustom) {
    lifted = {
      transitionType: "custom",
      custom: canonicalCustom(d.custom as Record<string, unknown>),
      ...(isRecord(d.predefined) &&
        typeof d.predefined.predefinedType === "string" && {
          predefined: canonicalPredefined(d.predefined),
        }),
    }
  } else {
    // Legacy flat / partial shape → reuse the migrator's lifter so there is
    // exactly one flat→nested mapper to keep in sync. Its `legacy` bag +
    // `legacyShape` stamp are only meaningful for v3 round-trips; keep the
    // ones already on the edge, but don't mint new ones from data that is
    // being normalised in place.
    const { legacy: _legacy, legacyShape: _legacyShape, ...fromLifter } =
      liftAgentTransitionDataToV4({
        type: "AgentStateTransition",
        ...d,
      } as unknown as V3UMLRelationship)
    const liftedPredefined = fromLifter.predefined
    const liftedCustom = fromLifter.custom
    lifted = {
      ...fromLifter,
      ...(isRecord(liftedPredefined) && {
        predefined: canonicalPredefined(liftedPredefined),
      }),
      ...(isRecord(liftedCustom) && { custom: canonicalCustom(liftedCustom) }),
    }
  }

  const rest: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(d)) {
    if (LEGACY_TRANSITION_KEYS.includes(key)) continue
    if (key === "transitionType" || key === "predefined" || key === "custom") continue
    rest[key] = value
  }
  const params = normalizeParams(d.params)
  return {
    ...rest,
    ...(params !== undefined && { params }),
    ...lifted,
  }
}

/**
 * Normalize every agent transition in a model to the canonical nested shape.
 *
 * Agent transitions historically came in two JSON shapes: a legacy *flat*
 * shape (top-level `condition` + `conditionValue`) and the canonical
 * *nested* shape (`transitionType` + `predefined` / `custom` blocks). The
 * editor upgrades flat → nested whenever a diagram is loaded, but models
 * that bypass the editor — e.g. an `agentBaseModels` snapshot bundled in an
 * imported project and written straight to localStorage, or a
 * personalisation variant sent to the generator — keep the flat shape. The
 * backend agent processor only understands the nested shape and silently
 * collapses flat transitions to `when_no_intent_matched`, so any model
 * persisted outside the editor must be normalized first.
 *
 * Accepts v3 (`elements` / `relationships` records) or v4 input; v3 goes
 * through `importDiagram` first, so the result is always canonical v4
 * (`nodes` / `edges` arrays, inline agent bodies, canonical action keys).
 * Endpoints, handles, waypoints and the edge id are preserved. The
 * function is pure (returns a clone) and idempotent on already-nested
 * input. Non-model input is returned untouched.
 */
export function normalizeAgentModel(model: UMLModel | unknown): UMLModel {
  if (!model || typeof model !== "object") return model as UMLModel

  let v4: UMLModel
  if (isV4Format(model)) {
    v4 = importDiagram(JSON.parse(JSON.stringify(model)))
  } else if (isV3Format(model)) {
    v4 = importDiagram(model)
  } else {
    return model as UMLModel
  }

  if (!Array.isArray(v4.edges)) return v4
  const edges: BesserEdge[] = v4.edges.map((edge) => {
    if (edge?.type !== "AgentStateTransition") return edge
    return {
      ...edge,
      data: normalizeAgentTransitionData(edge.data) as BesserEdge["data"],
    }
  })
  return { ...v4, edges }
}
