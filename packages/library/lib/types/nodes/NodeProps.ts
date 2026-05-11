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
  /** Freeform stereotype. Was `ClassType` enum. */
  stereotype?: string
  /** Independent italic flag. */
  italic?: boolean
  /** Independent underline flag. */
  underline?: boolean
  /** Free-text description (v3 `StylePane.showDescription`). */
  description?: string
  /** Optional URI (v3 `StylePane.showUri`). */
  uri?: string
  /** Optional inline icon SVG body (v3 `StylePane.showIcon`). */
  icon?: string
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
 * v3 `ClassOCLConstraint` elements onto their owner class. picks
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
 * Node data for a free-standing OCL constraint rendered as
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
 * Free-form sticky-note Comment node, ported from v3
 * (`packages/editor/src/main/packages/common/comments/`). The body text
 * is stored on `data.name` for parity with the v3 element, which used
 * the `UMLElement.name` field as the comment body (the v3 inspector
 * was a textarea bound to `name`). Kept as a separate prop type so the
 * inspector can swap to a multiline editor without affecting unrelated
 * `DefaultNodeProps` consumers.
 */
export type CommentNodeProps = DefaultNodeProps

/**
 * Object-diagram per-instance attribute row. v3 parity: object attribute
 * rows carry only the attribute identity (name + type) and a runtime
 * value — never the class-method-only fields (`code`,
 * `implementationType`, `stateMachineId`, `quantumCircuitId`,
 * `parameters`, `returnType`). The previous shape extended
 * `ClassNodeElement` wholesale and surfaced those by accident.
 */
export type ObjectNodeAttribute = Pick<
  ClassNodeElement,
  | "id"
  | "name"
  | "attributeType"
  | "visibility"
  | "isOptional"
  | "isDerived"
  | "isId"
  | "isExternalId"
  | "defaultValue"
  | "fillColor"
  | "strokeColor"
  | "textColor"
> & {
  /** Link to a class attribute id in a sibling ClassDiagram, when known. */
  attributeId?: string
  /** Runtime value of the attribute on this instance. */
  value?: unknown
}

export type ObjectNodeProps = {
  attributes: ObjectNodeAttribute[]
  /** Link to a class node id in a sibling ClassDiagram, when known. */
  classId?: string
  /** Cached class name from the linked class — display-only. */
  className?: string
  /** Inline icon SVG body for icon-view rendering. */
  icon?: string
  /**
   * Optional stereotype band shown above the underlined name (
   * Gap 1). v3 ObjectName extended UMLClassifier with a free-form
   * `string | null` stereotype; we mirror that here so migrated
   * fixtures keep their `«…»` label.
   */
  stereotype?: string | null
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
 * Inline body row stored on `StateNodeProps.bodies` /
 * `StateNodeProps.fallbackBodies`. v3 parity: `UMLStateBody` /
 * `UMLStateFallbackBody` carried only a `name` field (they extend
 * `UMLStateMember` which has nothing beyond the inherited UMLElement
 * fields). The row id is preserved across round-trip with v3.
 */
export type StateBodyRow = {
  id: string
  name?: string
}

/**
 * `State` parent node. v3 parity: body and fallback-body rows render
 * inline on the parent (same pattern as `AgentState` and Class
 * attribute rows). Replaces the prior child-node approach where
 * `StateBody` / `StateFallbackBody` were separate React-Flow nodes
 * connected via `parentId`. A normalizer folds any legacy floating body
 * nodes back into these arrays on load.
 */
export type StateNodeProps = DefaultNodeProps & {
  stereotype?: string | null
  italic?: boolean
  underline?: boolean
  /** Main-section body rows (entry / do / exit / on). */
  bodies?: StateBodyRow[]
  /** Fallback body rows. */
  fallbackBodies?: StateBodyRow[]
}

/** StateActionNode — labelled rounded rectangle. v3 parity: only the
 *  `name` is editable; v3 had no code body on the action node. */
export type StateActionNodeProps = DefaultNodeProps

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
/* AgentDiagram (BESSER)                                                */
/* -------------------------------------------------------------------------- */

/**
 * Inline-body row attached to `AgentState.data.bodies`.
 *
 * v3's `AgentState` rendered its body sections inline (entry / do /
 * exit / on-transition / fallback) like a Class node renders attribute
 * / method rows. originally split each body into a separate
 * `AgentStateBody` / `AgentStateFallbackBody` node connected via
 * `parentId`; undoes that split and folds the bodies onto
 * the parent's `data.bodies` array.
 *
 * Each row carries the v3 `AgentStateMember` reply-type-driven extras
 * (`ragDatabaseName`, `dbCustomName`, …) verbatim so round-trip with v3
 * fixtures stays lossless. The migrator preserves the original v3
 * element ids on the body rows so v4 → v3 emits them back as top-level
 * child elements with their original ids.
 */
export type AgentStateBodyRow = {
  /** Stable id (re-emitted as the v3 element id on export). */
  id: string
  /** Display label / row content (also stores v3 `name`). */
  name?: string
  /** Optional code body when `replyType === 'code'`. */
  code?: string
  /** v3 `AgentStateMember.replyType`. */
  replyType?: string
  ragDatabaseName?: string
  dbSelectionType?: string
  dbCustomName?: string
  dbQueryMode?: string
  dbOperation?: string
  dbSqlQuery?: string
  /** Optional fillColor / textColor passthrough for round-trip parity. */
  fillColor?: string
  textColor?: string
}

/**
 * `AgentState` parent node — extends `StateNodeProps` with a `replyType`
 * discriminator and an inline `bodies` array. v3 source:
 * `agent-state-diagram/agent-state/agent-state.ts` (`replyType` defaults
 * to `'text'` on `AgentStateMember`).
 *
 * Bodies render inline on the parent (table-style rows,
 * like a Class node's attributes). Each `bodies[i]` carries the v3
 * element id so the migrator emits them back as top-level v3 child
 * elements with their original ids.
 */
export type AgentStateNodeProps = StateNodeProps & {
  /**
   * Reply discriminator: `'text' | 'image' | 'json' | 'llm' | 'rag' | 'code'
   * | 'db_reply'` per the v3 `AgentStateMember` defaults. Defaults to `'text'`.
   */
  replyType?: string
  /**
   * Main-section inline body rows. Folded from v3's child `AgentStateBody`
   * elements. Fallback rows live in `fallbackBodies`
   * below — kept as a separate array (replacing the prior `kind: 'fallback'`
   * discriminator) so the body row shape stays clean.
   */
  bodies?: AgentStateBodyRow[]
  /**
   * Fallback-section inline body rows. Folded from v3's child
   * `AgentStateFallbackBody` elements.
   */
  fallbackBodies?: AgentStateBodyRow[]
}

/**
 * Training-phrase row attached to
 * `AgentIntent.data.training_phrases`. Mirrors the v3 `AgentIntentBody`
 * element shape — one user utterance per row. Folded inline like
 * `ClassNodeElement` rows so the editor renders them as SVG rows on the
 * parent intent.
 */
export type AgentIntentTrainingPhrase = {
  /** Stable id (re-emitted as the v3 element id on export). */
  id: string
  /** Display label / utterance text. */
  name: string
}

/**
 * Entity-slot row attached to
 * `AgentIntent.data.entity_slots`. Mirrors v3 `AgentIntentObjectComponent`:
 * a (name, entity, slot, value) tuple.
 */
export type AgentIntentEntitySlot = {
  /** Stable id (re-emitted as the v3 element id on export). */
  id: string
  /** Row label / slot identifier (display name). */
  name: string
  /** Entity name attached to this slot. */
  entity?: string
  /** Slot name (entity binding). */
  slot?: string
  /** Optional value — fixed value the agent expects. */
  value?: string
}

/**
 * `AgentIntent` parent node. folds the v3
 * `AgentIntentBody` / `AgentIntentDescription` / `AgentIntentObjectComponent`
 * children into inline data arrays on this node: `training_phrases[]`,
 * `entity_slots[]`, and the existing `intent_description` string. The
 * editor renders these as SVG rows inside the intent rectangle, matching
 * how `Class` renders `data.attributes[]` and `AgentState` renders
 * `data.bodies[]`. Children are no longer separate React-Flow nodes.
 */
export type AgentIntentNodeProps = DefaultNodeProps & {
  /** Free-text description rendered as the first row under the header. */
  intent_description?: string
  /** Inline training-utterance rows (was `AgentIntentBody` child nodes). */
  training_phrases?: AgentIntentTrainingPhrase[]
  /** Inline entity-slot rows (was `AgentIntentObjectComponent` child nodes). */
  entity_slots?: AgentIntentEntitySlot[]
  stereotype?: string | null
  italic?: boolean
  underline?: boolean
}

/**
 * Legacy `AgentIntentBody` shape — one training utterance row. Kept as
 * a typed alias so older fixtures and the v3 → v4 inverse converter can
 * still reference it; folds this row onto the
 * parent intent's `data.training_phrases` on import so React Flow no
 * longer sees a separate node for it.
 */
export type AgentIntentBodyNodeProps = DefaultNodeProps

/**
 * Legacy `AgentIntentDescription` shape — single description block under
 * the intent header. folds the value onto the
 * parent intent's `data.intent_description` on import.
 */
export type AgentIntentDescriptionNodeProps = DefaultNodeProps

/**
 * Legacy `AgentIntentObjectComponent` shape — entity / slot mapping
 * row. folds the row onto the parent intent's
 * `data.entity_slots` on import.
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
 * `AgentRagElement` — standalone RAG database element (cylinder visual).
 *
 * The DB-mode fields (`ragDatabaseName`,
 * `dbCustomName`, `dbSelectionType`, `dbQueryMode`, `dbOperation`,
 * `dbSqlQuery`) were removed from this prop type. Those settings belong
 * to the AgentState `db_reply` reply mode (see `AgentStateEditPanel`),
 * not to the standalone cylinder. The standalone palette element now
 * carries only its display name — keeping the type lean and the
 * inspector focused on what the canvas actually surfaces.
 *
 * Round-trip: when older v3/v4 fixtures ship the legacy DB fields on
 * an `AgentRagElement`, the versionConverter still preserves them on
 * the v3 wire form via passthrough (the migrator never relied on
 * reading them from this typed shape).
 */
export type AgentRagElementNodeProps = DefaultNodeProps

/* -------------------------------------------------------------------------- */
/* UserDiagram (BESSER)                                                 */
/* -------------------------------------------------------------------------- */

/**
 * `UserModelAttribute` — per-instance attribute row on a `UserModelName`.
 * Mirrors `ObjectNodeAttribute` plus the v3-only fields:
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
  /**
   * Per-node render mode. `"icon"` (default) renders
   * the person/class icon — matching the v3 fork's preferred preview
   * of a UserDiagram node. `"attributes"` shows the underlined header
   * + attribute table (v3 "normal view"). When unset the consumer
   * treats it as `"icon"` and the migrator normalises absent values
   * accordingly.
   */
  view?: "icon" | "attributes"
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
/* NNDiagram (BESSER)                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Generic data shape for a v4 NN layer node. collapses the v3
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
