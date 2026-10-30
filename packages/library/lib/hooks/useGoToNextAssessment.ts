import { useDiagramStore } from "@/store"
import { useShallow } from "zustand/shallow"
import { usePopoverStore } from "@/store/context"
import { useReactFlow } from "@xyflow/react"

export const useGoToNextAssessment = (elementId: string) => {
  const { updateNode } = useReactFlow()
  const { nodes, edges } = useDiagramStore(
    useShallow((state) => ({
      nodes: state.nodes,
      edges: state.edges,
    }))
  )
  const setPopOverElementId = usePopoverStore(
    useShallow((state) => state.setPopOverElementId)
  )

  const handleGoToNextAssessment = () => {
    const elements = [...nodes, ...edges]
    const currentIndex = elements.findIndex((el) => el.id === elementId)
    const totalElements = elements.length
    const nextIndex = (currentIndex + 1) % totalElements
    const nextElement = elements[nextIndex]
    updateNode(elementId, { selected: false })
    updateNode(nextElement.id, { selected: true })
    setPopOverElementId(nextElement.id)
  }

  return handleGoToNextAssessment
}
