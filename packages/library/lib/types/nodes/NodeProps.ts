import { ClassType } from "./enums"

export type DefaultNodeProps = {
  name: string
  fillColor?: string
  strokeColor?: string
  textColor?: string
}

/**
 * UML visibility values for classifier members. Stored canonically; the
 * row renderer derives the symbol via `VISIBILITY_SYMBOLS`.
 */
export type ClassifierVisibility = "public" | "private" | "protected" | "package"

/**
 * BESSER method implementation type — drives the inspector to render either a
 * code editor (`code` / `bal`) or a cross-diagram dropdown (`state_machine`,
 * `quantum_circuit`). `none` is the pure-UML default.
 */
export type ClassifierMethodImplementationType =
  | "none"
  | "code"
  | "bal"
  | "state_machine"
  | "quantum_circuit"

/**
 * Method parameter row (used by ClassMethod members).
 *
 * `name` and `parameterType` are the canonical fields. Legacy diagrams
 * stored the entire signature in the row name; the inspector parses that
 * fallback via `parseLegacyNameFormat` when these structured fields are
 * missing.
 */
export type ClassifierMethodParameter = {
  id: string
  name: string
  parameterType?: string
  defaultValue?: unknown
}

/**
 * Row data for class / object attributes and methods.
 *
 * `name` stays the source-of-truth for rendering on stock-diagram code
 * paths that read `item.name` directly (e.g. `RowBlockSection`). The
 * structured fields below are BESSER additions: when present, the
 * class-row renderer formats the row via `formatDisplayName(member,
 * mode)` so ER↔UML notation toggling is purely render-time.
 *
 * All BESSER fields are optional so upstream stock diagrams continue to
 * work unchanged with the minimal `{id, name}` shape.
 */
export type ClassNodeElement = {
  id: string
  /** Raw type string (`'str'`, `'int'`, `'MyClass'`, …) before normalization. */
  attributeType?: string
  /** Visibility, canonical form. The row renderer maps to `+/-/#/~`. */
  visibility?: ClassifierVisibility
  /** Method body / attribute default expression (Python or BAL). */
  code?: string
  /** Selects the method implementation strategy. Defaults to `'none'`. */
  implementationType?: ClassifierMethodImplementationType
  /** Cross-diagram link when `implementationType === 'state_machine'`. */
  stateMachineId?: string
  /** Cross-diagram link when `implementationType === 'quantum_circuit'`. */
  quantumCircuitId?: string
  /** UML "?" marker — attribute may be null. */
  isOptional?: boolean
  /** UML "/" marker — derived attribute. */
  isDerived?: boolean
  /** BESSER `{id}` marker — primary identifier. */
  isId?: boolean
  /** BESSER `{external id}` marker — externally-managed identifier. */
  isExternalId?: boolean
  /** Default value for attributes; ignored on methods. */
  defaultValue?: unknown
  /** Method parameters. Ignored on attribute rows. */
  parameters?: ClassifierMethodParameter[]
  /** Method return type. Ignored on attribute rows; mirrors `attributeType`. */
  returnType?: string
} & DefaultNodeProps

export type ClassNodeProps = {
  methods: ClassNodeElement[]
  attributes: ClassNodeElement[]
  stereotype?: ClassType
  /**
   * BESSER OCL constraints attached to this classifier. `expression` is the
   * raw OCL text; `name` is the constraint identifier shown in the panel.
   * Empty / undefined ⇒ no constraints rail rendered.
   */
  oclConstraints?: ClassOCLConstraint[]
} & DefaultNodeProps

/**
 * BESSER ClassDiagram OCL constraint, attached as a row on the parent
 * class. Spec recommendation (`docs/source/migrations/uml-v4-shape.md`
 * "Mapping rules (ClassDiagram)" §): collapse free-standing
 * v3 `ClassOCLConstraint` elements onto their owner class. SA-2 picks
 * the collapse-onto-owner option per the open-question note in the spec.
 */
export type ClassOCLConstraint = {
  id: string
  name: string
  expression: string
  /** Optional human-readable description used by the assistant. */
  description?: string
  /** Optional kind discriminator (`'invariant'`, `'pre'`, `'post'`). */
  kind?: string
}

/**
 * SA-UX-FIX (B1): Node data for a free-standing OCL constraint rendered as
 * a sticky-note style box (yellow, dog-eared corner) — distinct from a
 * regular Class node. Used when v3 emits a `ClassOCLConstraint` element
 * with no owner class. Owned constraints continue to collapse onto the
 * parent's `data.oclConstraints`.
 */
export type ClassOCLConstraintNodeProps = {
  /** OCL expression body. */
  expression: string
  /** Optional human-readable description. */
  description?: string
  /** Constraint kind: 'inv' | 'pre' | 'post' (auto-derived if omitted). */
  kind?: string
} & DefaultNodeProps

/**
 * Object-diagram per-instance attribute row.
 *
 * Differs from `ClassNodeElement` in two ways:
 *  - `value` carries the runtime value (or its string form) — class
 *    attributes default it via `defaultValue`, instances commit it via
 *    `value`.
 *  - `attributeId` links back to the source `ClassNodeElement.id` on the
 *    owning class, so the inspector can pin the attribute name/type.
 */
export type ObjectNodeAttribute = ClassNodeElement & {
  /** Link to a class attribute id in a sibling ClassDiagram, when known. */
  attributeId?: string
  /** Runtime value of the attribute on this instance. */
  value?: unknown
}

export type ObjectNodeProps = {
  methods: ClassNodeElement[]
  attributes: ObjectNodeAttribute[]
  /** Link to a class node id in a sibling ClassDiagram, when known. */
  classId?: string
  /** Cached class name from the linked class — display-only. */
  className?: string
  /** Inline icon SVG body for icon-view rendering. */
  icon?: string
} & DefaultNodeProps

export type CommunicationObjectNodeProps = {
  methods: ClassNodeElement[]
  attributes: ClassNodeElement[]
} & DefaultNodeProps

export type ComponentNodeProps = {
  isComponentHeaderShown: boolean
} & DefaultNodeProps

export type ComponentSubsystemNodeProps = {
  isComponentSubsystemHeaderShown: boolean
} & DefaultNodeProps

export type DeploymentNodeProps = {
  isComponentHeaderShown: boolean
  stereotype: string
} & DefaultNodeProps

export type DeploymentComponentProps = {
  isComponentHeaderShown: boolean
} & DefaultNodeProps

export type PetriNetPlaceProps = {
  tokens: number
  capacity: number | "Infinity"
} & DefaultNodeProps

export type BPMNTaskType =
  | "default"
  | "user"
  | "send"
  | "receive"
  | "manual"
  | "business-rule"
  | "script"

export type BPMNMarkerType =
  | "none"
  | "parallel multi instance"
  | "sequential multi instance"
  | "loop"

export type BPMNTaskProps = DefaultNodeProps & {
  taskType: BPMNTaskType
  marker: BPMNMarkerType
}

export type BPMNStartEventType =
  | "default"
  | "message"
  | "timer"
  | "conditional"
  | "signal"

export type BPMNIntermediateEventType =
  | "default"
  | "message-catch"
  | "message-throw"
  | "timer-catch"
  | "escalation-throw"
  | "conditional-catch"
  | "link-catch"
  | "link-throw"
  | "compensation-throw"
  | "signal-catch"
  | "signal-throw"

export type BPMNEndEventType =
  | "default"
  | "message"
  | "escalation"
  | "error"
  | "compensation"
  | "signal"
  | "terminate"

export type BPMNEventProps = DefaultNodeProps & {
  eventType: BPMNStartEventType
}

export type BPMNGatewayType =
  | "complex"
  | "event-based"
  | "exclusive"
  | "inclusive"
  | "parallel"

export type BPMNGatewayProps = DefaultNodeProps & {
  gatewayType: BPMNGatewayType
}

export type BPMNSubprocessProps = DefaultNodeProps
export type BPMNTransactionProps = DefaultNodeProps
export type BPMNCallActivityProps = DefaultNodeProps
export type BPMNAnnotationProps = DefaultNodeProps
export type BPMNDataObjectProps = DefaultNodeProps
export type BPMNDataStoreProps = DefaultNodeProps
export type BPMNPoolProps = DefaultNodeProps
export type BPMNGroupProps = DefaultNodeProps

export type ReachabilityGraphMarkingProps = DefaultNodeProps & {
  isInitialMarking: boolean
}

export type SfcActionRow = DefaultNodeProps & {
  id: string
  identifier: string
}

export type SfcActionTableProps = DefaultNodeProps & {
  actionRows: SfcActionRow[]
}
export type SfcTransitionBranchNodeProps = DefaultNodeProps & {
  showHint: boolean
}

/* -------------------------------------------------------------------------- */
/* StateMachineDiagram (BESSER)                                                */
/* -------------------------------------------------------------------------- */

/**
 * Body row attached to a `State` parent. Wire spec
 * (`docs/source/migrations/uml-v4-shape.md`, StateMachineDiagram §):
 * v4 represents `StateBody`/`StateFallbackBody` as React-Flow children with
 * `parentId` pointing at the containing `State`. The brief instructs the
 * port to ship them as separate node types so the parent State can use
 * React Flow's `parentId` semantics — that's why this carries `data`
 * inline rather than collapsing onto `StateNodeProps.bodies`.
 */
export type StateBodyNodeProps = DefaultNodeProps

/**
 * `State` parent node. Children (StateBody / StateFallbackBody /
 * StateCodeBlock) hang off of it via React Flow `parentId`. The
 * stereotype renders centred above the name; `italic`/`underline` style
 * the name itself. v3 cached `bodyIds` / `fallbackBodyIds` arrays — in
 * v4 those are derived at render time by walking children.
 */
export type StateNodeProps = DefaultNodeProps & {
  stereotype?: string | null
  italic?: boolean
  underline?: boolean
}

/** StateActionNode — labelled rounded rectangle. */
export type StateActionNodeProps = DefaultNodeProps & {
  /** Optional Python / BAL action body, edited in the inspector. */
  code?: string
}

/**
 * StateObjectNode — references a class in a sibling ClassDiagram.
 *
 * Spec open question 4: the `classId` link is YES, mirroring
 * `ObjectName.classId`. The inspector renders a class-picker driven by
 * `diagramBridge.getAvailableClasses()`; the v3 fork stored the link on
 * the element directly so the v3 → v4 migrator passes the field through
 * verbatim.
 */
export type StateObjectNodeProps = DefaultNodeProps & {
  classId?: string
  /** Cached class name from the linked class — display-only. */
  className?: string
}

/**
 * StateCodeBlock — Python code panel. `language` defaults to `'python'`.
 * The body is rendered inside a `foreignObject` so multi-line code keeps
 * its formatting.
 */
export type StateCodeBlockProps = DefaultNodeProps & {
  code: string
  language?: string
}

/**
 * StateInitialNode / StateFinalNode / StateMergeNode / StateForkNode /
 * StateForkNodeHorizontal — markers with at most a `name` label. Use
 * the shared `DefaultNodeProps` shape; no extra fields.
 */
export type StateMarkerNodeProps = DefaultNodeProps

/* -------------------------------------------------------------------------- */
/* AgentDiagram (BESSER) — SA-4                                                */
/* -------------------------------------------------------------------------- */

/**
 * `AgentState` parent node — extends `StateNodeProps` with a `replyType`
 * discriminator. v3 source: `agent-state-diagram/agent-state/agent-state.ts`
 * (`replyType` defaults to `'text'` on `AgentStateMember`).
 *
 * Children (`AgentStateBody` / `AgentStateFallbackBody` / `AgentRagElement`)
 * hang off via React Flow `parentId`, mirroring SA-3's State/StateBody
 * pattern instead of collapsing onto the parent's data — the SA-4 brief
 * inherits SA-3's choice for visual + auto-grow parity with v3.
 */
export type AgentStateNodeProps = StateNodeProps & {
  /**
   * Reply discriminator: `'text' | 'image' | 'json' | 'llm' | 'rag' | 'code'
   * | 'db_reply'` per the v3 `AgentStateMember` defaults. Defaults to `'text'`.
   */
  replyType?: string
}

/**
 * `AgentStateBody` / `AgentStateFallbackBody` — child rows of an
 * `AgentState`. Carry the optional `replyType`-driven extras
 * (`ragDatabaseName`, `dbCustomName`, …) verbatim per the spec at
 * `docs/source/migrations/uml-v4-shape.md` — the spec mounts these on the
 * RAG element, but in practice v3's `AgentStateMember` carries them on
 * **every** agent-state body / fallback body, so the SA-4 port preserves
 * them on both shapes for round-trip fidelity.
 */
export type AgentStateBodyNodeProps = DefaultNodeProps & {
  replyType?: string
  ragDatabaseName?: string
  dbSelectionType?: string
  dbCustomName?: string
  dbQueryMode?: string
  dbOperation?: string
  dbSqlQuery?: string
  /** Optional code body when `replyType === 'code'`. */
  code?: string
}

/**
 * `AgentIntent` parent node. Children: `AgentIntentBody` (training utterance
 * row), `AgentIntentDescription` (single description row),
 * `AgentIntentObjectComponent` (entity/slot mapping). All nested via
 * `parentId`.
 */
export type AgentIntentNodeProps = DefaultNodeProps & {
  /** Free-text description rendered in the description row. */
  intent_description?: string
  stereotype?: string | null
  italic?: boolean
  underline?: boolean
}

/**
 * `AgentIntentBody` — one training utterance row.
 */
export type AgentIntentBodyNodeProps = DefaultNodeProps

/**
 * `AgentIntentDescription` — single description block under the intent
 * header. Stores its description on `data.name` for symmetry with the
 * other intent body rows; the parent intent's `intent_description`
 * mirrors this value during round-trip.
 */
export type AgentIntentDescriptionNodeProps = DefaultNodeProps

/**
 * `AgentIntentObjectComponent` — entity / slot mapping row. Carries
 * the entity reference and slot config as plain strings; the inspector
 * exposes them as form fields.
 */
export type AgentIntentObjectComponentNodeProps = DefaultNodeProps & {
  /** Entity name attached to this slot. */
  entity?: string
  /** Slot name (entity binding). */
  slot?: string
  /** Optional value — fixed value the agent expects. */
  value?: string
}

/**
 * `AgentRagElement` — RAG database element. Open question #5 resolution
 * (per the SA-4 brief): retain BOTH `dbCustomName` and `ragDatabaseName`
 * verbatim. The editor renders `dbCustomName ?? ragDatabaseName` for
 * display, but stores both fields untouched on `data` so the v3 → v4 → v3
 * round-trip is lossless. The BAF generator (backend) decides which one
 * to consume by inspecting `dbSelectionType`.
 */
export type AgentRagElementNodeProps = DefaultNodeProps & {
  /**
   * Original v3 field — typically the canonical RAG database identifier
   * (mapped to a vector store on the backend).
   */
  ragDatabaseName?: string
  /**
   * v3 selection-mode discriminator: `'predefined' | 'custom' | 'default'`.
   * When `'custom'`, the editor and BAF generator both consume
   * `dbCustomName` instead of `ragDatabaseName`.
   */
  dbSelectionType?: string
  /**
   * v3 custom-name field — preserved verbatim alongside `ragDatabaseName`
   * (per open question #5). Display preference: `dbCustomName ??
   * ragDatabaseName`.
   */
  dbCustomName?: string
  /** v3 query-mode discriminator: `'sql' | 'natural_language' | 'llm_query' | …`. */
  dbQueryMode?: string
  /** v3 SQL operation type when `dbQueryMode === 'sql'`. */
  dbOperation?: string
  /** v3 SQL query text. */
  dbSqlQuery?: string
  /** Optional `ragType` discriminator surfaced by the inspector. */
  ragType?: string
}

/* -------------------------------------------------------------------------- */
/* UserDiagram (BESSER) — SA-4                                                 */
/* -------------------------------------------------------------------------- */

/**
 * `UserModelAttribute` — per-instance attribute row on a `UserModelName`.
 * Mirrors `ObjectNodeAttribute` (SA-2) plus the v3-only fields:
 *
 * - `attributeOperator` — comparator (`<` / `<=` / `==` / `>=` / `>`).
 *   Defaults to `'=='`.
 * - `attributeId` — link to a class attribute id in a sibling
 *   ClassDiagram, when known.
 */
export type UserModelAttributeRow = ClassNodeElement & {
  attributeId?: string
  attributeOperator?: "<" | "<=" | "==" | ">=" | ">"
  defaultValue?: unknown
  /** Runtime / constraint comparison value bound to this attribute. */
  value?: unknown
}

/**
 * `UserModelName` — top-level user node, similar to ObjectName but with
 * the user-modelling discriminators. Spec open question #1 resolution
 * (`docs/source/migrations/uml-v4-shape.md`): YES, `classId` is preserved
 * for parity with `ObjectName.classId`.
 */
export type UserModelNameNodeProps = DefaultNodeProps & {
  attributes: UserModelAttributeRow[]
  description?: string
  /** Cross-diagram link to a class node id in a sibling ClassDiagram. */
  classId?: string
  /** Cached class name from the linked class — display-only. */
  className?: string
  /** Inline icon SVG body for icon-view rendering. */
  icon?: string
}

/**
 * `UserModelAttribute` — separate React-Flow node when the v3 fixture
 * stored attribute rows as siblings (rare; the migrator collapses them
 * onto the owner). The inspector renders against the parent's
 * `attributes` array; this node type exists for legacy round-trip.
 */
export type UserModelAttributeNodeProps = DefaultNodeProps & {
  attributeType?: string
  defaultValue?: unknown
  attributeOperator?: "<" | "<=" | "==" | ">=" | ">"
}

/**
 * `UserModelIcon` — small icon node attached to a `UserModelName`. v3
 * stored these as separate child elements; v4 keeps them as standalone
 * marker nodes for round-trip.
 */
export type UserModelIconNodeProps = DefaultNodeProps & {
  icon?: string
}

/* -------------------------------------------------------------------------- */
/* NNDiagram (BESSER) — SA-5                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Generic data shape for a v4 NN layer node. SA-5 collapses the v3
 * "every attribute is its own UMLElement" layout into a flat
 * `attributes: Record<string, unknown>` per
 * `docs/source/migrations/uml-v4-shape.md` (NNDiagram §). Keys follow
 * the snake_case attribute slug stripped of the layer suffix
 * (e.g. `KernelDimAttributeConv2D` → `kernel_dim`). For slugs that
 * collide across layer kinds (`DimensionAttributePooling` vs
 * `DimensionAttributeBatchNormalization`) the migrator emits
 * `<layer_kind>.<slug>` to disambiguate (`pooling.dimension`,
 * `batch_normalization.dimension`).
 *
 * Numeric attributes stay as **strings** in v4 to match the inline
 * widget which edits them as text. Boolean attributes are normalised
 * to JS `boolean`.
 */
export type NNLayerNodeProps = DefaultNodeProps & {
  attributes: Record<string, unknown>
  description?: string
  assessmentNote?: string
}

/**
 * Container for a sequential layer stack. Children attach via React
 * Flow `parentId = container.id`. v3 stored an entry-point reference
 * (which layer is the "input" side) on the container; the migrator
 * preserves that as `entryLayerId` if present.
 */
export type NNContainerNodeProps = DefaultNodeProps & {
  /** Optional entry-layer pointer (v3 named `entryLayer` / `inputLayer`). */
  entryLayerId?: string
  description?: string
}

/**
 * Cross-container reference. v3 carried this as a free-floating element
 * holding the referenced container id.
 */
export type NNReferenceNodeProps = DefaultNodeProps & {
  /** id of the referenced container / layer. */
  referenceTarget?: string
}

/**
 * Tensor operation (reshape, concatenate, multiply, transpose, …).
 * Same `attributes` shape as a layer node.
 */
export type NNTensorOpNodeProps = NNLayerNodeProps

/**
 * Model-level training configuration (loss, optimizer, batch size, …).
 * Same flat `attributes` shape as a layer node.
 */
export type NNConfigurationNodeProps = NNLayerNodeProps

/**
 * Training/test dataset. Same flat `attributes` shape as a layer node;
 * the inspector renders dataset-specific fields (`path_data`,
 * `task_type`, `input_format`, `shape`, `normalize`).
 */
export type NNDatasetNodeProps = NNLayerNodeProps
