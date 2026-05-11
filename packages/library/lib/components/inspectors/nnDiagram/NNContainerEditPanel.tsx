import { Box } from "@mui/material"
import React from "react"
import { useShallow } from "zustand/shallow"
import { useDiagramStore } from "@/store/context"
import { NNContainerNodeProps } from "@/types"
import { NodeStyleEditor } from "@/components/ui"
import { PopoverProps } from "@/components/popovers/types"

/**
 * Inspector for `NNContainer`. v3 parity (strict): only the name is
 * editable here. The style editor renders the name plus the fill /
 * stroke / text color controls; no description, no entryLayerId
 * (invented field) — those were not in the v3 BESSER metamodel.
 */
export const NNContainerEditPanel: React.FC<PopoverProps> = ({ elementId }) => {
  const { nodes, setNodes } = useDiagramStore(
    useShallow((state) => ({
      nodes: state.nodes,
      setNodes: state.setNodes,
    }))
  )
  const node = nodes.find((n) => n.id === elementId)
  if (!node) return null
  const data = node.data as NNContainerNodeProps

  const handleDataFieldUpdate = (key: string, value: string) => {
    setNodes((all) =>
      all.map((n) =>
        n.id === elementId
          ? { ...n, data: { ...n.data, [key]: value } }
          : n
      )
    )
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <NodeStyleEditor
        nodeData={data as never}
        handleDataFieldUpdate={handleDataFieldUpdate}
      />
    </Box>
  )
}
