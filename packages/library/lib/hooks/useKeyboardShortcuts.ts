import { useEffect, useRef } from "react"
import { useDiagramStore } from "@/store/context"
import { useShallow } from "zustand/shallow"
import { useSelectionForCopyPaste } from "./useSelectionForCopyPaste"
import { useDiagramModifiable } from "./useDiagramModifiable"

const ARROW_NUDGE_PX = 10

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
  const isDiagramModifiable = useDiagramModifiable()
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
      // Check if we're in an input field or textarea
      const target = event.target as HTMLElement
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return
      }

      if (event.key === "Escape") {
        event.preventDefault()
        clearSelection()
        return
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        if (!isDiagramModifiable) return
        event.preventDefault()
        if (hasSelectedElements()) {
          deleteSelectedElements()
        }
        return
      }

      if (
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !event.shiftKey &&
        (event.key === "ArrowUp" ||
          event.key === "ArrowDown" ||
          event.key === "ArrowLeft" ||
          event.key === "ArrowRight")
      ) {
        if (!isDiagramModifiable) return
        if (!hasSelectedElements()) return
        event.preventDefault()
        const dx =
          event.key === "ArrowLeft"
            ? -ARROW_NUDGE_PX
            : event.key === "ArrowRight"
              ? ARROW_NUDGE_PX
              : 0
        const dy =
          event.key === "ArrowUp"
            ? -ARROW_NUDGE_PX
            : event.key === "ArrowDown"
              ? ARROW_NUDGE_PX
              : 0
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

      const isModifierPressed = event.ctrlKey || event.metaKey

      if (!isModifierPressed) return

      if (!isDiagramModifiable) return

      switch (event.key.toLowerCase()) {
        case "z":
          event.preventDefault()
          if (event.shiftKey) {
            redo()
          } else {
            undo()
          }
          break

        case "y":
          if (!event.shiftKey) {
            event.preventDefault()
            redo()
          }
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

    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
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
    nodes,
    setNodes,
  ])
}
