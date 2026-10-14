import { useRef } from "react"
import { useReactFlow } from "@xyflow/react"

export function useToolbar({ id }: { id: string }) {
  const reactFlow = useReactFlow()
  const svgRef = useRef<SVGSVGElement | null>(null)

  const handleDelete = () => {
    reactFlow.deleteElements({
      edges: [{ id }],
    })
  }
  return {
    svgRef,
    handleDelete,
  }
}
