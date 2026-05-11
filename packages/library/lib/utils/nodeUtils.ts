import { DiagramNodeTypeRecord, type DiagramNodeType } from "@/nodes"
import { XYPosition, type Node } from "@xyflow/react"
import { log } from "../logger"

export const getPositionOnCanvas = (
  node: Node,
  allNodes: Node[]
): XYPosition => {
  // we need to copy position object here, otherwise updates node's position
  const position: XYPosition = { x: node.position.x, y: node.position.y }
  let parent = node.parentId
    ? allNodes.find((n) => n.id === node.parentId)
    : null

  while (parent) {
    position.x = position.x + parent.position.x
    position.y = position.y + parent.position.y

    parent = parent.parentId
      ? allNodes.find((n) => n.id === parent!.parentId)
      : null
  }

  return position
}

/**
 * Per-parent minimum size floor. Matches the per-node `NodeResizer` minWidth/
 * minHeight values in the canvas components so we never shrink a parent below
 * the size it would clamp to anyway. Falls back to a conservative 80x60.
 */
const PARENT_MIN_SIZE: Record<string, { width: number; height: number }> = {
  package: { width: 200, height: 100 },
  activity: { width: 200, height: 120 },
  useCaseSystem: { width: 200, height: 120 },
  componentSubsystem: { width: 180, height: 120 },
  deploymentNode: { width: 180, height: 120 },
  deploymentComponent: { width: 180, height: 120 },
  bpmnPool: { width: 200, height: 120 },
  bpmnGroup: { width: 160, height: 60 },
  bpmnSubprocess: { width: 160, height: 60 },
  bpmnTransaction: { width: 160, height: 60 },
  bpmnCallActivity: { width: 160, height: 60 },
  NNContainer: { width: 200, height: 140 },
  State: { width: 160, height: 100 },
  AgentIntent: { width: 160, height: 100 },
}

const DEFAULT_PARENT_MIN = { width: 80, height: 60 }

const getParentMinSize = (parentType?: string) =>
  (parentType && PARENT_MIN_SIZE[parentType]) || DEFAULT_PARENT_MIN

export const resizeAllParents = (node: Node, allNodes: Node[]) => {
  let currentNode = node

  while (currentNode.parentId) {
    const parent = allNodes.find((n) => n.id === currentNode.parentId)!
    const allChildren = allNodes.filter((n) => n.parentId === parent.id)

    if (currentNode.position.x < 0) {
      const parentPositionUpdateOffsetX = -1 * currentNode.position.x
      parent.position.x = parent.position.x - parentPositionUpdateOffsetX
      parent.width = parent.width! + parentPositionUpdateOffsetX
      allChildren.forEach((child) => {
        child.position.x = child.position.x + parentPositionUpdateOffsetX
      })
    }
    if (currentNode.position.y < 0) {
      const parentPositionUpdateOffsetY = -1 * currentNode.position.y
      parent.position.y = parent.position.y - parentPositionUpdateOffsetY
      parent.height = parent.height! + parentPositionUpdateOffsetY
      allChildren.forEach((child) => {
        child.position.y = child.position.y + parentPositionUpdateOffsetY
      })
    }
    if (currentNode.position.x + currentNode.width! > parent.width!) {
      parent.width = currentNode.position.x + currentNode.width!
    }
    if (currentNode.position.y + currentNode.height! > parent.height!) {
      parent.height = currentNode.position.y + currentNode.height!
    }

    // SA-FINAL-3 Tier 5 #18: shrink the parent to the tight bounds of its
    // remaining children once the grow-branch above has fired. v3's
    // `UMLContainer.render` recomputed bounds from the child set every
    // pass; the previous implementation only grew, so once a child was
    // moved away or deleted the parent stayed bloated.
    if (allChildren.length > 0) {
      const PADDING = 10
      let tightMinX = Infinity
      let tightMinY = Infinity
      let tightMaxX = -Infinity
      let tightMaxY = -Infinity
      for (const child of allChildren) {
        const cw = child.width ?? 0
        const ch = child.height ?? 0
        tightMinX = Math.min(tightMinX, child.position.x)
        tightMinY = Math.min(tightMinY, child.position.y)
        tightMaxX = Math.max(tightMaxX, child.position.x + cw)
        tightMaxY = Math.max(tightMaxY, child.position.y + ch)
      }

      const floor = getParentMinSize(parent.type)
      // Translate parent + children if the tight bounds leave dead space at
      // the top-left corner (e.g. all children moved down/right by 30 px →
      // shift the whole frame so the children stay glued to the corner).
      if (tightMinX > PADDING) {
        const dx = tightMinX - PADDING
        parent.position.x = parent.position.x + dx
        parent.width = parent.width! - dx
        allChildren.forEach((child) => {
          child.position.x = child.position.x - dx
        })
        tightMaxX -= dx
      }
      if (tightMinY > PADDING) {
        const dy = tightMinY - PADDING
        parent.position.y = parent.position.y + dy
        parent.height = parent.height! - dy
        allChildren.forEach((child) => {
          child.position.y = child.position.y - dy
        })
        tightMaxY -= dy
      }
      // Refit to `desiredWidth` = max(tight bounds + padding, floor).
      // We assign unconditionally so a previous over-aggressive shift
      // (which deflated `parent.width` past `desiredWidth`) is corrected,
      // and so subsequent runs with the same child set stay deterministic.
      const desiredWidth = Math.max(tightMaxX + PADDING, floor.width)
      const desiredHeight = Math.max(tightMaxY + PADDING, floor.height)
      parent.width = desiredWidth
      parent.height = desiredHeight
    }

    currentNode = allNodes.find((n) => n.id === currentNode.parentId)!
  }
  return allNodes
}

export function sortNodesTopologically(nodes: Node[]): Node[] {
  const nodeMap = new Map<string, Node>()
  nodes.forEach((node) => nodeMap.set(node.id, node))

  const sorted: Node[] = []
  const visited = new Set<string>()
  const visiting = new Set<string>()

  const visit = (node: Node) => {
    if (visited.has(node.id)) return
    if (visiting.has(node.id)) {
      throw new Error(`Circular dependency detected at node ${node.id}`)
    }

    visiting.add(node.id)

    if (node.parentId) {
      const parentNode = nodeMap.get(node.parentId)
      if (parentNode) {
        visit(parentNode)
      } else {
        log.warn(
          `Parent node with id ${node.parentId} not found for node ${node.id}`
        )
      }
    }

    visiting.delete(node.id)
    visited.add(node.id)
    sorted.push(node)
  }

  nodes.forEach((node) => {
    if (!visited.has(node.id)) {
      visit(node)
    }
  })

  return sorted
}

/**
 * Per-node-type label capabilities — the single source of truth for what
 * the rename popover and the SVG renderer must agree on.
 *
 *   `wrapsName`         — the node's SVG renders `data.name` through
 *                         `MultilineText` or one of the `layoutTextIn…`
 *                         shape helpers. When true, the rename popover
 *                         exposes a multiline input (Enter inserts `\n`).
 *   `rendersNameLabel`  — the node renders `data.name` at all. When false,
 *                         the rename popover hides the input entirely
 *                         (pure-symbol nodes like activity initial/final/
 *                         fork have no text to repaint).
 *
 * This is declared as `Record<DiagramNodeType, …> satisfies …` so adding
 * a new enum entry to `DiagramNodeTypeRecord` without classifying it here
 * becomes a compile error rather than a silent default. Change this table
 * only when a node's SVG wrapping behaviour actually changes.
 */
type NodeLabelCapabilities = {
  wrapsName: boolean
  rendersNameLabel: boolean
}

const NODE_LABEL_CAPABILITIES = {
  // Class diagram
  package: { wrapsName: true, rendersNameLabel: true },
  class: { wrapsName: false, rendersNameLabel: true },
  // SA-UX-FIX B1: free-standing OCL constraint draws its own header
  // text and wraps the body — neither the rename popover nor the
  // global label workflow is appropriate here.
  ClassOCLConstraint: { wrapsName: false, rendersNameLabel: false },
  objectName: { wrapsName: false, rendersNameLabel: true },
  communicationObjectName: { wrapsName: false, rendersNameLabel: true },
  colorDescription: { wrapsName: true, rendersNameLabel: true },
  // SA-HIDE-NOISE: free-form sticky-note Comment ported from v3
  // `common/comments`. The body text wraps inside the note and the
  // node renders its own label, so the global rename popover is
  // unused here (the inspector edits via a multiline TextField).
  comment: { wrapsName: true, rendersNameLabel: false },
  titleAndDesctiption: { wrapsName: false, rendersNameLabel: true },

  // Activity diagram
  activity: { wrapsName: true, rendersNameLabel: true },
  activityActionNode: { wrapsName: true, rendersNameLabel: true },
  activityObjectNode: { wrapsName: true, rendersNameLabel: true },
  activityMergeNode: { wrapsName: true, rendersNameLabel: true },
  activityInitialNode: { wrapsName: false, rendersNameLabel: false },
  activityFinalNode: { wrapsName: false, rendersNameLabel: false },
  activityForkNode: { wrapsName: false, rendersNameLabel: false },
  activityForkNodeHorizontal: { wrapsName: false, rendersNameLabel: false },

  // Use case diagram
  useCase: { wrapsName: true, rendersNameLabel: true },
  useCaseActor: { wrapsName: true, rendersNameLabel: true },
  useCaseSystem: { wrapsName: true, rendersNameLabel: true },

  // Component diagram
  component: { wrapsName: true, rendersNameLabel: true },
  componentSubsystem: { wrapsName: true, rendersNameLabel: true },
  componentInterface: { wrapsName: false, rendersNameLabel: true },

  // Deployment diagram
  deploymentNode: { wrapsName: true, rendersNameLabel: true },
  deploymentComponent: { wrapsName: true, rendersNameLabel: true },
  deploymentArtifact: { wrapsName: true, rendersNameLabel: true },
  deploymentInterface: { wrapsName: false, rendersNameLabel: true },

  // Flowchart
  flowchartTerminal: { wrapsName: true, rendersNameLabel: true },
  flowchartProcess: { wrapsName: true, rendersNameLabel: true },
  flowchartDecision: { wrapsName: true, rendersNameLabel: true },
  flowchartInputOutput: { wrapsName: true, rendersNameLabel: true },
  flowchartFunctionCall: { wrapsName: true, rendersNameLabel: true },

  // Syntax tree
  syntaxTreeTerminal: { wrapsName: true, rendersNameLabel: true },
  syntaxTreeNonterminal: { wrapsName: true, rendersNameLabel: true },

  // Petri net (labels are single-line below the shape by convention)
  petriNetTransition: { wrapsName: false, rendersNameLabel: true },
  petriNetPlace: { wrapsName: false, rendersNameLabel: true },

  // BPMN
  bpmnTask: { wrapsName: true, rendersNameLabel: true },
  bpmnSubprocess: { wrapsName: true, rendersNameLabel: true },
  bpmnTransaction: { wrapsName: true, rendersNameLabel: true },
  bpmnCallActivity: { wrapsName: true, rendersNameLabel: true },
  bpmnAnnotation: { wrapsName: true, rendersNameLabel: true },
  bpmnGroup: { wrapsName: true, rendersNameLabel: true },
  bpmnStartEvent: { wrapsName: false, rendersNameLabel: true },
  bpmnIntermediateEvent: { wrapsName: false, rendersNameLabel: true },
  bpmnEndEvent: { wrapsName: false, rendersNameLabel: true },
  bpmnGateway: { wrapsName: false, rendersNameLabel: true },
  bpmnPool: { wrapsName: false, rendersNameLabel: true },
  bpmnDataObject: { wrapsName: false, rendersNameLabel: true },
  bpmnDataStore: { wrapsName: false, rendersNameLabel: true },

  // Reachability graph
  reachabilityGraphMarking: { wrapsName: true, rendersNameLabel: true },

  // SFC
  sfcStep: { wrapsName: true, rendersNameLabel: true },
  sfcStart: { wrapsName: false, rendersNameLabel: true },
  sfcJump: { wrapsName: false, rendersNameLabel: true },
  sfcTransitionBranch: { wrapsName: false, rendersNameLabel: true },
  sfcActionTable: { wrapsName: false, rendersNameLabel: true },
} as const satisfies Record<DiagramNodeType, NodeLabelCapabilities>

/**
 * Does this node's SVG renderer wrap its label? Drives whether the rename
 * popover accepts multiline input — see `NODE_LABEL_CAPABILITIES`.
 */
export const supportsMultilineName = (nodeType?: string): boolean =>
  !!nodeType &&
  nodeType in NODE_LABEL_CAPABILITIES &&
  NODE_LABEL_CAPABILITIES[nodeType as DiagramNodeType].wrapsName

/**
 * Does this node render a user-editable text label at all? False for
 * pure-symbol nodes so the rename popover hides its input for them.
 */
export const rendersNameLabel = (nodeType?: string): boolean => {
  if (!nodeType) return true
  if (!(nodeType in NODE_LABEL_CAPABILITIES)) return true
  return NODE_LABEL_CAPABILITIES[nodeType as DiagramNodeType].rendersNameLabel
}

export const isParentNodeType = (nodeType?: string) => {
  if (!nodeType) {
    return false
  }

  return (
    nodeType === DiagramNodeTypeRecord.package ||
    nodeType === DiagramNodeTypeRecord.activity ||
    nodeType === DiagramNodeTypeRecord.useCaseSystem ||
    nodeType === DiagramNodeTypeRecord.componentSubsystem ||
    nodeType === DiagramNodeTypeRecord.deploymentNode ||
    nodeType === DiagramNodeTypeRecord.deploymentComponent ||
    nodeType === DiagramNodeTypeRecord.bpmnPool ||
    nodeType === DiagramNodeTypeRecord.bpmnGroup ||
    nodeType === DiagramNodeTypeRecord.bpmnSubprocess ||
    nodeType === DiagramNodeTypeRecord.bpmnTransaction ||
    nodeType === DiagramNodeTypeRecord.bpmnCallActivity ||
    // SA-FIX-NN-DROPS: BESSER-registered parent shapes (NN, State,
    // Agent diagrams) live outside the default node-type registry —
    // they're added at runtime via `registerNodeTypes`. Compare by
    // string literal so the union type does not need to be widened.
    // Without this the drop-handler in `DraggableGhost.tsx` /
    // `useNodeDragStop.ts` never recognises these as parents and
    // children land at the canvas root with no `parentId`.
    nodeType === "NNContainer" ||
    nodeType === "State" ||
    // SA-FINAL-3 Tier 5 #19: AgentState bodies are inlined on
    // `AgentState.data.bodies`, not nested children. Listing AgentState as
    // a parent here advertised a drop target the `canDropIntoParent`
    // predicate then rejected — the hover halo lit up but nothing landed.
    // Removing it from this set short-circuits the drop handler so the
    // child lands at the canvas root, matching v3 behaviour.
    nodeType === "AgentIntent"
  )
}
