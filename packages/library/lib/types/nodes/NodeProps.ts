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
