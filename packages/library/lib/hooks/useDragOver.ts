import { useCallback, DragEvent } from "react"

export const useDragOver = () => {
  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = "move"
  }, [])

  return onDragOver
}
