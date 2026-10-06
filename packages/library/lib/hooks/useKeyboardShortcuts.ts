import { useEffect, useRef } from "react"
import { useDiagramStore, usePopoverStore } from "@/store/context"
import { useMetadataStore } from "@/store"
import { BesserMode } from "@/typings"
import { useShallow } from "zustand/shallow"
import { useSelectionForCopyPaste } from "./useSelectionForCopyPaste"
import { useDiagramModifiable } from "./useDiagramModifiable"

const ARROW_NUDGE_PX = 10
const ARROW_NUDGE_SHIFT_PX = 50

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

  const { undo, redo, canUndo, canRedo, undoManager, nodes, setNodes } =
    useDiagramStore(
      useShallow((state) => ({
        undo: state.undo,
        redo: state.redo,
        canUndo: state.canUndo,
        canRedo: state.canRedo,
        undoManager: state.undoManager,
        nodes: state.nodes,
        setNodes: state.setNodes,
      }))
    )
  const setPopOverElementId = usePopoverStore(
    (state) => state.setPopOverElementId
  )
  const { mode, readonly } = useMetadataStore(
    useShallow((state) => ({ mode: state.mode, readonly: state.readonly }))
  )
  const isDiagramModifiable = useDiagramModifiable()
  // Same gate as double-click (`useElementInteractions`).
  const canOpenPopover =
    isDiagramModifiable || (mode === BesserMode.Assessment && !readonly)
  const {
    selectedElementIds,
    hasSelectedElements,
    selectAll,
    clearSelection,
    copySelectedElements,
    pasteElements,
    cutSelectedElements,
    deleteSelectedElements,
  } = useSelectionForCopyPaste()

  useEffect(() => {
    const handleKeyDown = async (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (isTextEntryTarget(target)) {
        return
      }
      const inControl = isControlTarget(target)
      const modifier = event.ctrlKey || event.metaKey
      // Normalize letters so Shift / Caps Lock don't change the shortcut.
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key

      // Let the browser handle Ctrl/Cmd+C when the user has a real text
      // selection (e.g. chat messages, tooltips, SVG labels that aren't
      // editable inputs) instead of intercepting it for diagram-element copy.
      if (modifier && key === "c") {
        const selection = window.getSelection()
        if (selection && selection.toString().length > 0) {
          return
        }
      }

      if (key === "Escape") {
        if (!modifier && !isInPopup(target)) {
          event.preventDefault()
          clearSelection()
        }
        return
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
            pasteCountRef.current += 1
            pasteElements(pasteCountRef.current)
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
              copySelectedElements()
              pasteElements(pasteCountRef.current)
            }
          }
          break

        default:
          break
      }
    }

    // Capture phase, so an arrow nudge runs before React Flow's node handler.
    document.addEventListener("keydown", handleKeyDown, true)
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true)
    }
  }, [
    undo,
    redo,
    canUndo,
    canRedo,
    undoManager,
    selectedElementIds,
    hasSelectedElements,
    selectAll,
    clearSelection,
    copySelectedElements,
    cutSelectedElements,
    pasteElements,
    deleteSelectedElements,
    isDiagramModifiable,
    canOpenPopover,
    setPopOverElementId,
    nodes,
    setNodes,
  ])
}
