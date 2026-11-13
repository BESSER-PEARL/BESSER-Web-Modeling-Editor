import { useDiagramStore } from "@/store"
import { CommunicationObjectNodeProps } from "@/types"
import { useShallow } from "zustand/shallow"
import { EditableAttributeList } from "../classDiagram/EditableAttributesList"
import { EditableMethodsList } from "../classDiagram/EditableMethodsList"
import { PopoverProps } from "../types"
import { DividerLine, NodeStyleEditor } from "@/components/ui"

export const CommunicationObjectNameEditPopover: React.FC<PopoverProps> = ({
  elementId,
}) => {
  const { nodes, setNodes } = useDiagramStore(
    useShallow((state) => ({
      nodes: state.nodes,
      setNodes: state.setNodes,
    }))
  )

  const node = nodes.find((node) => node.id === elementId)
  if (!node) {
    return null
  }

  const nodeData = node.data as CommunicationObjectNodeProps

  const handleDataFieldUpdate = (key: string, value: string) => {
    setNodes((nodes) =>
      nodes.map((node) => {
        if (node.id === elementId) {
          return {
            ...node,
            data: {
              ...node.data,
              [key]: value,
            },
          }
        }
        return node
      })
    )
  }

  return (
    <>
      <NodeStyleEditor
        nodeData={nodeData}
        handleDataFieldUpdate={handleDataFieldUpdate}
      />
      <DividerLine width="100%" />
      <EditableAttributeList nodeId={elementId} />
      <DividerLine width="100%" />
      <EditableMethodsList nodeId={elementId} />
    </>
  )
}
