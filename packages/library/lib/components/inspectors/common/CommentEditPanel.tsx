import { Box, TextField as MuiTextField } from "@mui/material"
import React from "react"
import { useShallow } from "zustand/shallow"
import { useDiagramStore } from "@/store/context"
import { CommentNodeProps } from "@/types"
import { DividerLine, NodeStyleEditor } from "@/components/ui"
import { PopoverProps } from "@/components/popovers/types"

/**
 * Inspector body for the free-form Comment sticky-note
 * node. Single multiline TextField bound to `data.name` (parity with the
 * v3 `comments-update.tsx` editor, which also bound a textarea to
 * `element.name`). Exposes the standard `NodeStyleEditor` so authors
 * can recolour the sticky note (fill / stroke / text) while keeping the
 * defaults as the canonical yellow-on-amber look.
 */
export const CommentEditPanel: React.FC<PopoverProps> = ({ elementId }) => {
  const { nodes, setNodes } = useDiagramStore(
    useShallow((state) => ({
      nodes: state.nodes,
      setNodes: state.setNodes,
    }))
  )

  const node = nodes.find((n) => n.id === elementId)
  if (!node) return null
  const data = node.data as CommentNodeProps

  const updateData = (patch: Partial<CommentNodeProps>) => {
    setNodes((all) =>
      all.map((n) =>
        n.id === elementId ? { ...n, data: { ...n.data, ...patch } } : n
      )
    )
  }

  const handleStyleFieldUpdate = (key: string, value: string) => {
    updateData({ [key]: value } as Partial<CommentNodeProps>)
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <NodeStyleEditor
        nodeData={data}
        handleDataFieldUpdate={handleStyleFieldUpdate}
      />
      <DividerLine width="100%" />
      <MuiTextField
        size="small"
        variant="outlined"
        multiline
        minRows={4}
        maxRows={20}
        placeholder="Comment text…"
        value={data.name ?? ""}
        onChange={(e) => updateData({ name: e.target.value })}
        autoFocus
      />
    </Box>
  )
}
