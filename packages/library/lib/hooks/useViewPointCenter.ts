import { useMemo } from "react"
import { useViewport, XYPosition } from "@xyflow/react"
import { useDiagramStore } from "@/store"
import { useShallow } from "zustand/shallow"

export const useViewportCenter = (): XYPosition => {
  const viewPort = useViewport()
  const diagramId = useDiagramStore(useShallow((state) => state.diagramId))

  return useMemo((): XYPosition => {
    const pointOfViewportLeftTop = {
      x: (viewPort.x * -1) / viewPort.zoom,
      y: (viewPort.y * -1) / viewPort.zoom,
    }

    const canvasElement = window.document.getElementById(
      `react-flow-library-${diagramId}`
    )
    const center = {
      x:
        pointOfViewportLeftTop.x +
        (canvasElement?.clientWidth || 0) / 2 / viewPort.zoom,
      y:
        pointOfViewportLeftTop.y +
        (canvasElement?.clientHeight || 0) / 2 / viewPort.zoom,
    }

    return center
  }, [viewPort])
}
