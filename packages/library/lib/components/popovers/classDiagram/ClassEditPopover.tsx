import {
  DividerLine,
  StereotypeButtonGroup,
  NodeStyleEditor,
} from "@/components"
import { useDiagramStore } from "@/store"
import { ClassNodeProps } from "@/types"
import { useShallow } from "zustand/shallow"
import { EditableAttributeList } from "./EditableAttributesList"
import { EditableMethodsList } from "./EditableMethodsList"
import { PopoverProps } from "../types"

export const ClassEditPopover: React.FC<PopoverProps> = ({ elementId }) => {
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

  const nodeData = node.data as ClassNodeProps

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
      <StereotypeButtonGroup
        nodeId={elementId}
        selectedStereotype={nodeData.stereotype}
      />
      <DividerLine width="100%" />
      <EditableAttributeList nodeId={elementId} />
      <DividerLine width="100%" />
      <EditableMethodsList nodeId={elementId} />
    </>
  )
}
