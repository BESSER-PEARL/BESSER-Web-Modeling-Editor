import React, { useCallback, useEffect, useRef, useState } from "react"
import { CANVAS, DROPS, DropElementConfig, ZINDEX } from "@/constants"
import { DropNodeData } from "@/types"
import { createPortal } from "react-dom"
import { useReactFlow, type Node } from "@xyflow/react"
import {
  generateUUID,
  getPositionOnCanvas,
  isParentNodeType,
  resizeAllParents,
} from "@/utils"
import {
  canDropIntoParent,
  clampIntoLaneBody,
  requiresParent,
} from "@/utils/bpmnConstraints"
import { POOL_HEADER_WIDTH, stackPoolLanes } from "@/hooks/useSwimlaneLayout"
import { useDiagramStore, useDiagramStoreApi } from "@/store/context"
import { useShallow } from "zustand/shallow"
import { log } from "../logger"
import { translate, useTranslation } from "@/i18n"
import { Locale } from "@/typings"
import { createNewNodeDataWithNewIds } from "@/utils/copyPasteUtils"

/* ========================================================================
   Utility functions to manage page scrolling during dragging
   ======================================================================== */
const disableScroll = () => {
  document.body.style.overflow = "hidden"
  document.body.style.touchAction = "none"
}

const enableScroll = () => {
  document.body.style.overflow = ""
  document.body.style.touchAction = ""
}

/* ========================================================================
   Palette template row re-iding
   ======================================================================== */
/**
 * Clone a palette entry's `defaultData` and assign fresh ids to every
 * template row in every id-bearing list -- `methods` (and their
 * `parameters`) / `attributes` / `bodies` / `fallbackBodies` /
 * `training_phrases` / `entity_slots` / `oclConstraints` / ... (upstream
 * Apollon `instantiatePaletteData`, shared with paste via
 * `remintNestedChildIds`). Row ids become top-level v3 element ids on
 * export (e.g. `convertV4ToV3Agent` emits `elements[row.id]`), so two
 * drops of the same pre-populated palette card would collide without this.
 *
 * NN-layer palette entries store `attributes` as a slug→value dict
 * (e.g. `{"pooling.dimension": "2D"}`) — non-array shapes are left
 * untouched; their keys are stable, no ids needed.
 *
 * Exported for tests (palette-drop unique-id guarantees).
 */
export const cloneDefaultDataWithFreshRowIds = (
  configDefaultData: Record<string, unknown> | undefined
): Record<string, unknown> =>
  createNewNodeDataWithNewIds(structuredClone(configDefaultData ?? {}))

/**
 * Resolve a palette entry's `defaultData` for the given locale: when the
 * entry declares a `nameKey`, the default `name` is translated (the English
 * `defaultData.name` is the fallback). v3 parity — only the BPMN palette
 * translated default names (`bpmn-diagram-preview.ts`); the result is
 * model content, frozen at creation like in v3. Used for both the sidebar
 * preview and the dropped node. Returns the input unchanged without a key.
 */
export const resolvePaletteDefaultData = (
  config: Pick<DropElementConfig, "defaultData" | "nameKey">,
  locale: Locale
): Record<string, unknown> | undefined => {
  if (!config.nameKey || !config.defaultData) return config.defaultData
  const fallback =
    typeof config.defaultData.name === "string"
      ? config.defaultData.name
      : undefined
  return {
    ...config.defaultData,
    name: translate(config.nameKey, fallback, locale),
  }
}

/* ========================================================================
   Click / keyboard insert
   ======================================================================== */
type InsertRect = { x: number; y: number; width: number; height: number }

const INSERT_GRID_PX = 10
const INSERT_STEP_PX = 20

const rectsOverlap = (a: InsertRect, b: InsertRect) =>
  a.x < b.x + b.width &&
  b.x < a.x + a.width &&
  a.y < b.y + b.height &&
  b.y < a.y + a.height

/**
 * Top-left for a palette click/keyboard insert (develop parity,
 * `create-pane.tsx` getInsertPosition): the centre of the visible canvas,
 * cascaded down-right in 20 px steps until the spot (plus one step of
 * margin) is clear of root elements, so repeated inserts don't stack.
 * Never steps past the visible area; falls back to the centre.
 * `view` and the result are flow coordinates. Exported for tests.
 */
export const getClickInsertPosition = (
  view: InsertRect,
  size: { width: number; height: number },
  nodes: readonly Node[]
): { x: number; y: number } => {
  const snap = (v: number) => Math.round(v / INSERT_GRID_PX) * INSERT_GRID_PX
  const start = {
    x: snap(view.x + (view.width - size.width) / 2),
    y: snap(view.y + (view.height - size.height) / 2),
  }
  const siblings = nodes.flatMap((n) => {
    const width = n.width ?? n.measured?.width ?? 0
    const height = n.height ?? n.measured?.height ?? 0
    return !n.parentId && !n.hidden && width > 0 && height > 0
      ? [{ x: n.position.x, y: n.position.y, width, height }]
      : []
  })
  for (
    let x = start.x, y = start.y;
    x + size.width <= view.x + view.width &&
    y + size.height <= view.y + view.height;
    x += INSERT_STEP_PX, y += INSERT_STEP_PX
  ) {
    const spot = {
      x: x - INSERT_STEP_PX,
      y: y - INSERT_STEP_PX,
      width: size.width + 2 * INSERT_STEP_PX,
      height: size.height + 2 * INSERT_STEP_PX,
    }
    if (!siblings.some((sib) => rectsOverlap(spot, sib))) return { x, y }
  }
  return start
}

// A pointer that travels further than this between press and release was a drag, not a click.
const CLICK_TOLERANCE_PX = 4

/* ========================================================================
   DraggableGhost Component
   Wraps a child element with drag & drop behavior and drop logic.
   ======================================================================== */
interface DraggableGhostProps {
  children: React.ReactNode
  dropElementConfig: DropElementConfig
}

export const DraggableGhost: React.FC<DraggableGhostProps> = ({
  children,
  dropElementConfig,
}) => {
  const diagramId = useDiagramStore(useShallow((state) => state.diagramId))
  const { locale } = useTranslation()
  // Hooks from react-flow and zustand store for node management
  const { screenToFlowPosition, getIntersectingNodes } = useReactFlow()
  const setNodes = useDiagramStore((state) => state.setNodes)
  // Live nodes are read on drop: subscribing to them would re-render every
  // palette item on every drag step.
  const diagramStoreApi = useDiagramStoreApi()
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null)

  // Local state to track drag status, ghost position, and pointer offset
  const [isDragging, setIsDragging] = useState(false)
  const [ghostPosition, setGhostPosition] = useState({ x: 0, y: 0 })
  const [clickOffset, setClickOffset] = useState({ x: 0, y: 0 })

  /* ----------------------------------------------------------------------
     onDrop: Handles the pointer up event by calculating the drop position,
     checking boundaries, and creating/updating the new node.
     ---------------------------------------------------------------------- */
  const onDrop = useCallback(
    (event: PointerEvent) => {
      event.preventDefault()

      const canvas = document.getElementById(`react-flow-library-${diagramId}`)
      if (!canvas) {
        log.warn("Canvas element not found")
        return
      }

      // Convert drop position from screen to flow coordinates (with grid snapping)
      const dropPosition = screenToFlowPosition(
        { x: event.clientX, y: event.clientY },
        { snapToGrid: true }
      )

      // Check if the drop occurred outside the canvas bounds
      const canvasBounding = canvas.getBoundingClientRect()
      const isOutsideCanvas =
        event.clientX < canvasBounding.left ||
        event.clientY < canvasBounding.top ||
        event.clientX > canvasBounding.right ||
        event.clientY > canvasBounding.bottom

      if (isOutsideCanvas) {
        return
      }

      const { nodes } = diagramStoreApi.getState()

      // Deep clone defaultData (avoids mutating the original config) and
      // assign fresh ids to template rows — see
      // `cloneDefaultDataWithFreshRowIds` for the why.
      const defaultData = cloneDefaultDataWithFreshRowIds(
        resolvePaletteDefaultData(dropElementConfig, locale)
      )

      // Prepare the drop data including offset adjustments
      const dropData: DropNodeData = {
        type: dropElementConfig.type,
        data: defaultData,
        offsetX: clickOffset.x / DROPS.SIDEBAR_PREVIEW_SCALE,
        offsetY: clickOffset.y / DROPS.SIDEBAR_PREVIEW_SCALE,
      }

      // Find potential parent node by checking intersections with a potential Parent node type
      const intersectingNodes = getIntersectingNodes({
        x: dropPosition.x,
        y: dropPosition.y,
        width: CANVAS.MOUSE_UP_OFFSET_PX,
        height: CANVAS.MOUSE_UP_OFFSET_PX,
      }).filter((node) => {
        return (
          isParentNodeType(node.type) &&
          node.type &&
          canDropIntoParent(dropElementConfig.type, node.type)
        )
      })

      const parentNode = intersectingNodes[intersectingNodes.length - 1]
      const parentId = parentNode ? parentNode.id : undefined

      // Some elements only exist inside a container (a BPMN lane only
      // inside a pool): a drop on the bare canvas is ignored.
      if (!parentId && requiresParent(dropElementConfig.type)) {
        log.debug(`Drop of ${dropElementConfig.type} ignored: it needs a parent`)
        return
      }

      // Adjust node position based on pointer offset
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })

      // Snap position to grid
      position.x -=
        Math.floor(
          clickOffset.x / DROPS.SIDEBAR_PREVIEW_SCALE / CANVAS.SNAP_TO_GRID_PX
        ) * CANVAS.SNAP_TO_GRID_PX
      position.y -=
        Math.floor(
          clickOffset.y / DROPS.SIDEBAR_PREVIEW_SCALE / CANVAS.SNAP_TO_GRID_PX
        ) * CANVAS.SNAP_TO_GRID_PX

      if (parentId) {
        const parentPositionOnCanvas = getPositionOnCanvas(parentNode, nodes)
        position.x -= parentPositionOnCanvas.x
        position.y -= parentPositionOnCanvas.y
      }

      const isLaneIntoPool =
        dropData.type === "bpmnSwimlane" && parentNode?.type === "bpmnPool"

      // Create the new node with a unique ID and calculated position
      const newNode: Node = {
        id: generateUUID(),
        width: dropElementConfig.dropWidth ?? dropElementConfig.width,
        height: dropElementConfig.dropHeight ?? dropElementConfig.height,
        type: dropData.type,
        // Children of a BPMN lane stay out of its header strip.
        position: clampIntoLaneBody({ ...position }, parentNode?.type),
        data: { ...defaultData, ...dropData.data },
        parentId: parentId,
        measured: {
          width: dropElementConfig.dropWidth ?? dropElementConfig.width,
          height: dropElementConfig.dropHeight ?? dropElementConfig.height,
        },
        selected: false,
        // Lanes are pool-driven, not free-dragging (as BPMNPoolEditPopover).
        ...(isLaneIntoPool ? { draggable: false } : {}),
      }

      // Update nodes and resize parent nodes if necessary
      let updatedNodes = structuredClone([...nodes, newNode])
      if (isLaneIntoPool && parentId) {
        // First lane of a pool: the pool's direct children move into it
        // (as BPMNPoolEditPopover's "add lane"). Then re-stack the lanes.
        const hadLanes = nodes.some(
          (n) => n.parentId === parentId && n.type === "bpmnSwimlane"
        )
        if (!hadLanes) {
          updatedNodes = updatedNodes.map((n) =>
            n.parentId === parentId && n.id !== newNode.id
              ? {
                  ...n,
                  parentId: newNode.id,
                  position: clampIntoLaneBody(
                    { x: n.position.x - POOL_HEADER_WIDTH, y: n.position.y },
                    "bpmnSwimlane"
                  ),
                }
              : n
          )
        }
        updatedNodes = stackPoolLanes(updatedNodes, parentId)
      } else if (parentId) {
        resizeAllParents(newNode, updatedNodes)
      }

      setNodes(updatedNodes)
    },
    [
      screenToFlowPosition,
      setNodes,
      getIntersectingNodes,
      diagramStoreApi,
      clickOffset.x,
      clickOffset.y,
      dropElementConfig,
      locale,
    ]
  )

  /* ----------------------------------------------------------------------
     insertOnCanvas: palette click / Enter / Space. Creates the element on
     the visible canvas (cascaded, see `getClickInsertPosition`) at the
     canvas root and makes it the only selection (develop parity).
     ---------------------------------------------------------------------- */
  const insertOnCanvas = useCallback(() => {
    // Lanes only exist inside a pool; a bare-canvas insert is a no-op, as a drop.
    if (requiresParent(dropElementConfig.type)) return
    const canvas = document.getElementById(`react-flow-library-${diagramId}`)
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const left = Math.max(rect.left, 0)
    const top = Math.max(rect.top, 0)
    const right = Math.min(rect.right, window.innerWidth)
    const bottom = Math.min(rect.bottom, window.innerHeight)
    if (right <= left || bottom <= top) return
    const topLeft = screenToFlowPosition({ x: left, y: top })
    const bottomRight = screenToFlowPosition({ x: right, y: bottom })

    const width = dropElementConfig.dropWidth ?? dropElementConfig.width
    const height = dropElementConfig.dropHeight ?? dropElementConfig.height
    const state = diagramStoreApi.getState()
    const position = getClickInsertPosition(
      {
        x: topLeft.x,
        y: topLeft.y,
        width: bottomRight.x - topLeft.x,
        height: bottomRight.y - topLeft.y,
      },
      { width, height },
      state.nodes
    )

    const newNode: Node = {
      id: generateUUID(),
      width,
      height,
      type: dropElementConfig.type,
      position,
      data: cloneDefaultDataWithFreshRowIds(
        resolvePaletteDefaultData(dropElementConfig, locale)
      ),
      measured: { width, height },
      selected: true,
    }

    state.setNodes([
      ...state.nodes.map((n) => (n.selected ? { ...n, selected: false } : n)),
      newNode,
    ])
    if (state.edges.some((e) => e.selected)) {
      state.setEdges(
        state.edges.map((e) => (e.selected ? { ...e, selected: false } : e))
      )
    }
    state.setSelectedElementsId([newNode.id])
  }, [
    diagramId,
    diagramStoreApi,
    dropElementConfig,
    locale,
    screenToFlowPosition,
  ])

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const start = pointerStartRef.current
    pointerStartRef.current = null
    // detail === 0 is a keyboard-generated click; handleKeyDown already handled it.
    if (!start || event.detail === 0) return
    if (
      Math.hypot(event.clientX - start.x, event.clientY - start.y) >
      CLICK_TOLERANCE_PX
    ) {
      return
    }
    insertOnCanvas()
    // Hand focus back to the page: a still-focused item would show its ring
    // on the next keypress and swallow keys meant for the canvas.
    event.currentTarget.blur()
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return
    event.preventDefault()
    event.stopPropagation()
    insertOnCanvas()
  }

  /* ----------------------------------------------------------------------
     Pointer Event Handlers
     ---------------------------------------------------------------------- */
  // Initiate drag: disable scrolling and record click offset
  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    disableScroll()
    pointerStartRef.current = { x: event.clientX, y: event.clientY }

    const elementRect = (event.target as HTMLElement).getBoundingClientRect()
    const offsetX = event.clientX - elementRect.left
    const offsetY = event.clientY - elementRect.top

    setClickOffset({ x: offsetX, y: offsetY })
    setGhostPosition({ x: event.clientX - offsetX, y: event.clientY - offsetY })
    setIsDragging(true)
  }

  // Update ghost position during dragging
  const handlePointerMove = (event: PointerEvent) => {
    if (!isDragging) return
    setGhostPosition({
      x: event.clientX - clickOffset.x,
      y: event.clientY - clickOffset.y,
    })
  }

  // End dragging: re-enable scrolling, reset state, and trigger drop logic
  const handlePointerUp = (event: PointerEvent) => {
    enableScroll()
    setIsDragging(false)
    setGhostPosition({ x: 0, y: 0 })
    onDrop(event)
  }

  /* ----------------------------------------------------------------------
     Attach global pointer event listeners when dragging
     ---------------------------------------------------------------------- */
  useEffect(() => {
    if (isDragging) {
      document.addEventListener("pointermove", handlePointerMove)
      document.addEventListener("pointerup", handlePointerUp)
    } else {
      document.removeEventListener("pointermove", handlePointerMove)
      document.removeEventListener("pointerup", handlePointerUp)
    }
    return () => {
      document.removeEventListener("pointermove", handlePointerMove)
      document.removeEventListener("pointerup", handlePointerUp)
    }
  }, [isDragging, clickOffset, onDrop])

  const paletteName = resolvePaletteDefaultData(dropElementConfig, locale)?.name
  const paletteLabel =
    typeof paletteName === "string" && paletteName
      ? paletteName
      : dropElementConfig.type

  /* ----------------------------------------------------------------------
     Render the ghost element via a portal when dragging
     ---------------------------------------------------------------------- */
  const ghostElement = (
    <div
      style={{
        // The ghost follows client (viewport) coordinates and is portaled to
        // <body>; `fixed` keeps it under the pointer when the host page is
        // scrolled (upstream Apollon #841).
        position: "fixed",
        left: `${ghostPosition.x}px`,
        top: `${ghostPosition.y}px`,
        pointerEvents: "none",
        zIndex: ZINDEX.DRAGGABLE_ELEMENT,
        opacity: 0.8,
      }}
    >
      {children}
    </div>
  )

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        aria-label={paletteLabel}
        className="besser-palette-item"
        onPointerDown={handlePointerDown}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        style={{
          touchAction: "none",
        }}
      >
        {children}
      </div>
      {isDragging && createPortal(ghostElement, document.body)}
    </>
  )
}
