import { useEffect, useRef } from "react"
import { useReactFlow, useStoreApi, type XYPosition } from "@xyflow/react"
import {
  useDiagramStore,
  useDiagramStoreApi,
  usePopoverStore,
} from "@/store/context"
import { useMetadataStore } from "@/store"
import { BesserMode } from "@/typings"
import { useShallow } from "zustand/shallow"
import { useSelectionForCopyPaste } from "./useSelectionForCopyPaste"
import { useDiagramModifiable } from "./useDiagramModifiable"

const ARROW_NUDGE_PX = 10
const ARROW_NUDGE_SHIFT_PX = 50
const ZOOM_DURATION_MS = 200
// Zoom to selection stops here so a single small element is not blown up to 500 %.
const ZOOM_TO_SELECTION_MAX = 2

// Focused controls keep their own keys: Backspace on a colour swatch must not
// delete the element, arrows in a listbox must not move it.
const CONTROL_SELECTOR = [
  "button",
  '[role="button"]',
  '[role="option"]',
  '[role="listbox"]',
  '[role="menuitem"]',
  '[role="slider"]',
  '[contenteditable]:not([contenteditable="false"])',
].join(",")

// React Flow gives focusable nodes/edges role="button"; they are the canvas, not a control.
const CANVAS_ELEMENT_SELECTOR =
  ".react-flow__node, .react-flow__edge, .react-flow__nodesselection-rect"

// The properties panel and popovers own every key pressed inside them.
const POPUP_SELECTOR = '.besser-properties-panel, .MuiPopover-root, [role="dialog"]'
// Pointer travel (px) after which a repeated paste starts a new cascade.
const PASTE_POINTER_MOVE_PX = 4

export const isTextEntryTarget = (target: HTMLElement): boolean =>
  target.tagName === "INPUT" ||
  target.tagName === "TEXTAREA" ||
  target.tagName === "SELECT" ||
  target.isContentEditable

export const isInPopup = (target: HTMLElement): boolean =>
  !!target.closest?.(POPUP_SELECTOR)

export const isControlTarget = (target: HTMLElement): boolean => {
  if (isInPopup(target)) return true
  const control = target.closest?.(CONTROL_SELECTOR)
  return !!control && !control.matches(CANVAS_ELEMENT_SELECTOR)
}

export const useKeyboardShortcuts = () => {
  const pasteCountRef = useRef(0)
  // Last pointer position (client px) and where the previous paste happened.
  const pointerRef = useRef<XYPosition | null>(null)
  const lastPastePointerRef = useRef<XYPosition | null>(null)

  const { undo, redo, undoManager, setNodes } = useDiagramStore(
    useShallow((state) => ({
      undo: state.undo,
      redo: state.redo,
      undoManager: state.undoManager,
      setNodes: state.setNodes,
    }))
  )
  const { popoverElementId, setPopOverElementId } = usePopoverStore(
    useShallow((state) => ({
      popoverElementId: state.popoverElementId,
      setPopOverElementId: state.setPopOverElementId,
    }))
  )
  const { mode, readonly } = useMetadataStore(
    useShallow((state) => ({ mode: state.mode, readonly: state.readonly }))
  )
  const diagramStoreApi = useDiagramStoreApi()
  const { zoomIn, zoomOut, zoomTo, fitView, screenToFlowPosition } =
    useReactFlow()
  const flowStoreApi = useStoreApi()
  const isDiagramModifiable = useDiagramModifiable()
  // Same gate as double-click (`useElementInteractions`).
  const canOpenPopover =
    isDiagramModifiable || (mode === BesserMode.Assessment && !readonly)
  const {
    hasSelectedElements,
    selectAll,
    clearSelection,
    copySelectedElements,
    pasteElements,
    duplicateSelectedElements,
    cutSelectedElements,
    deleteSelectedElements,
  } = useSelectionForCopyPaste()

  useEffect(() => {
    // One undo step per user gesture: every press / key starts a new step.
    // Typing in a field keeps merging (captureTimeout), and so do the
    // auto-repeats of a held arrow key (one nudge burst).
    const handlePointerDown = () => undoManager?.stopCapturing()
    const handlePointerMove = (event: PointerEvent) => {
      pointerRef.current = { x: event.clientX, y: event.clientY }
    }

    /**
     * Paste target in flow coordinates: the pointer when it is over the
     * canvas, else the centre of the visible canvas.
     */
    const getPasteAnchor = (): XYPosition | undefined => {
      const flowDom = flowStoreApi.getState().domNode
      if (!flowDom) return undefined
      const rect = flowDom.getBoundingClientRect()
      const pointer = pointerRef.current
      const overCanvas =
        !!pointer &&
        pointer.x >= rect.left &&
        pointer.x <= rect.right &&
        pointer.y >= rect.top &&
        pointer.y <= rect.bottom
      return screenToFlowPosition(
        overCanvas
          ? pointer
          : { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
      )
    }

    // Escape is only the canvas's while focus is on it (or nowhere): menus,
    // dialogs and drawers of the host close on it themselves. Only closing the
    // inspector consumes it (preventDefault), so one press closes one layer.
    const handleEscape = (event: KeyboardEvent, target: HTMLElement) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return
      const flowDom = flowStoreApi.getState().domNode
      if (target.closest?.(".besser-properties-panel")) {
        // An open select / autocomplete inside the panel closes first.
        if (target.getAttribute("aria-expanded") === "true") return
        if (!popoverElementId) return
        // Blur first so fields that commit on blur keep the typed value.
        if (isTextEntryTarget(target)) target.blur()
        const editedId = popoverElementId
        event.preventDefault()
        setPopOverElementId(null)
        flowDom
          ?.querySelector<HTMLElement>(
            `.react-flow__node[data-id="${CSS.escape(editedId)}"]`
          )
          ?.focus({ preventScroll: true })
        return
      }
      // A container around the canvas counts too (a focusable host <main>
      // keeps focus after a pane click).
      const onCanvas =
        target === document.body ||
        (!!flowDom && (flowDom.contains(target) || target.contains?.(flowDom)))
      if (!onCanvas || isTextEntryTarget(target) || isInPopup(target)) return
      // React Flow's own Escape handler on a focused node / edge toggles its
      // selection (and re-selects it after a clear); this handler owns Escape.
      const onCanvasElement = !!target.matches?.(CANVAS_ELEMENT_SELECTOR)
      if (onCanvasElement) event.stopPropagation()
      // First Escape closes the open inspector, the next clears the selection.
      if (popoverElementId) {
        event.preventDefault()
        setPopOverElementId(null)
        return
      }
      clearSelection()
      if (onCanvasElement) target.blur()
    }

    const handleKeyDown = async (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (event.key === "Escape") {
        handleEscape(event, target)
        return
      }
      if (isTextEntryTarget(target)) {
        return
      }
      if (!event.repeat) undoManager?.stopCapturing()
      const inControl = isControlTarget(target)
      const modifier = event.ctrlKey || event.metaKey
      // Normalize letters so Shift / Caps Lock don't change the shortcut.
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key

      // Viewport zoom, only from this canvas or a container around it (the
      // page body, a focusable host <main>): elsewhere Ctrl/Cmd +/-/0 stays
      // the browser's page zoom.
      const flowDom = flowStoreApi.getState().domNode
      const zoomFromCanvas =
        target === document.body ||
        (!!flowDom && (flowDom.contains(target) || target.contains?.(flowDom)))
      if (zoomFromCanvas && !inControl && !event.altKey) {
        const zoom = getZoomShortcut(event, modifier)
        if (zoom) {
          event.preventDefault()
          // Steps are instant so quick repeated presses compound.
          if (zoom === "in") void zoomIn()
          else if (zoom === "out") void zoomOut()
          else if (zoom === "reset") void zoomTo(1)
          else if (zoom === "fit")
            void fitView({ padding: 0.1, duration: ZOOM_DURATION_MS })
          else {
            const { nodes: allNodes, edges } = diagramStoreApi.getState()
            const ids = new Set(allNodes.filter((n) => n.selected).map((n) => n.id))
            edges.forEach((e) => {
              if (e.selected) ids.add(e.source).add(e.target)
            })
            if (ids.size > 0) {
              void fitView({
                nodes: [...ids].map((id) => ({ id })),
                padding: 0.2,
                maxZoom: ZOOM_TO_SELECTION_MAX,
                duration: ZOOM_DURATION_MS,
              })
            }
          }
          return
        }
      }

      // Let the browser handle Ctrl/Cmd+C when the user has a real text
      // selection (e.g. chat messages, tooltips, SVG labels that aren't
      // editable inputs) instead of intercepting it for diagram-element copy.
      if (modifier && key === "c") {
        const selection = window.getSelection()
        if (selection && selection.toString().length > 0) {
          return
        }
      }

      if (!modifier && !event.altKey && !inControl) {
        if (key === "Delete" || key === "Backspace") {
          if (!isDiagramModifiable) return
          event.preventDefault()
          if (hasSelectedElements()) {
            deleteSelectedElements()
          }
          return
        }

        if (
          key === "ArrowUp" ||
          key === "ArrowDown" ||
          key === "ArrowLeft" ||
          key === "ArrowRight"
        ) {
          if (!isDiagramModifiable) return
          if (!hasSelectedElements()) return
          event.preventDefault()
          // This listener runs in the capture phase; stop React Flow's own
          // focused-node arrow handler from moving the selection a second time.
          event.stopPropagation()
          const step = event.shiftKey ? ARROW_NUDGE_SHIFT_PX : ARROW_NUDGE_PX
          const dx =
            key === "ArrowLeft" ? -step : key === "ArrowRight" ? step : 0
          const dy = key === "ArrowUp" ? -step : key === "ArrowDown" ? step : 0
          const { nodes, selectedElementIds } = diagramStoreApi.getState()
          const selected = new Set(selectedElementIds)
          setNodes(
            nodes.map((n) =>
              selected.has(n.id)
                ? {
                    ...n,
                    position: { x: n.position.x + dx, y: n.position.y + dy },
                  }
                : n
            )
          )
          return
        }

        // Same as double-click: open the single selected element's
        // properties. Only from the page body or the canvas, so Enter on
        // other controls keeps its meaning.
        if (key === "Enter" && !event.shiftKey) {
          const fromCanvas =
            target === document.body || !!target.closest?.(".react-flow")
          const { selectedElementIds } = diagramStoreApi.getState()
          if (fromCanvas && canOpenPopover && selectedElementIds.length === 1) {
            event.preventDefault()
            setPopOverElementId(selectedElementIds[0])
          }
          return
        }
      }

      if (!modifier) return

      if (!isDiagramModifiable) return

      switch (key) {
        case "z":
          event.preventDefault()
          if (event.shiftKey) {
            redo()
          } else {
            undo()
          }
          break

        case "y":
          event.preventDefault()
          redo()
          break

        case "a":
          if (!event.shiftKey && !event.altKey) {
            event.preventDefault()
            selectAll()
          }
          break

        case "c":
          if (!event.shiftKey && !event.altKey) {
            event.preventDefault()
            if (hasSelectedElements()) {
              pasteCountRef.current = 0
              copySelectedElements()
            }
          }
          break

        case "x":
          if (!event.shiftKey && !event.altKey) {
            event.preventDefault()
            if (hasSelectedElements()) {
              pasteCountRef.current = 0
              cutSelectedElements()
            }
          }
          break

        case "v":
          if (!event.shiftKey && !event.altKey) {
            event.preventDefault()
            // Repeated pastes at the same spot cascade; moving the pointer
            // starts again at the pointer.
            const pointer = pointerRef.current
            const last = lastPastePointerRef.current
            const pointerMoved =
              !!pointer &&
              (!last ||
                Math.hypot(pointer.x - last.x, pointer.y - last.y) >
                  PASTE_POINTER_MOVE_PX)
            pasteCountRef.current = pointerMoved ? 1 : pasteCountRef.current + 1
            lastPastePointerRef.current = pointer
            pasteElements(pasteCountRef.current, getPasteAnchor())
          }
          break

        case "d":
          // Cmd/Ctrl+D duplicates the selection (copy + immediate paste)
          // matching the v3 fork. Browsers default this to "bookmark
          // page" so preventDefault is mandatory.
          if (!event.shiftKey && !event.altKey) {
            event.preventDefault()
            if (hasSelectedElements()) {
              pasteCountRef.current = 1
              void duplicateSelectedElements(pasteCountRef.current)
            }
          }
          break

        default:
          break
      }
    }

    // Capture phase, so an arrow nudge runs before React Flow's node handler.
    document.addEventListener("keydown", handleKeyDown, true)
    document.addEventListener("pointerdown", handlePointerDown, true)
    document.addEventListener("pointermove", handlePointerMove, true)
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true)
      document.removeEventListener("pointerdown", handlePointerDown, true)
      document.removeEventListener("pointermove", handlePointerMove, true)
    }
  }, [
    undo,
    redo,
    undoManager,
    hasSelectedElements,
    selectAll,
    clearSelection,
    copySelectedElements,
    cutSelectedElements,
    pasteElements,
    duplicateSelectedElements,
    deleteSelectedElements,
    isDiagramModifiable,
    canOpenPopover,
    popoverElementId,
    setPopOverElementId,
    setNodes,
    diagramStoreApi,
    flowStoreApi,
    zoomIn,
    zoomOut,
    zoomTo,
    fitView,
    screenToFlowPosition,
  ])
}

type ZoomShortcut = "in" | "out" | "reset" | "fit" | "selection"

// `code` covers the numpad and layouts where Shift changes the produced key.
const getZoomShortcut = (
  event: KeyboardEvent,
  modifier: boolean
): ZoomShortcut | null => {
  if (modifier) {
    if (event.key === "=" || event.key === "+" || event.code === "NumpadAdd")
      return "in"
    if (event.key === "-" || event.key === "_" || event.code === "NumpadSubtract")
      return "out"
    if (event.key === "0" || event.code === "Numpad0") return "reset"
    return null
  }
  if (event.shiftKey && event.code === "Digit1") return "fit"
  if (event.shiftKey && event.code === "Digit2") return "selection"
  return null
}
