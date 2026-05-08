import { Box, TextField as MuiTextField } from "@mui/material"
import React from "react"
import { useShallow } from "zustand/shallow"
import { useDiagramStore } from "@/store/context"
import { ClassOCLConstraintNodeProps } from "@/types"
import { DividerLine, NodeStyleEditor } from "@/components/ui"
import { PopoverProps } from "@/components/popovers/types"

/**
 * Inspector body for the free-standing OCL constraint node. Per user
 * request, only two fields are surfaced: the OCL expression itself and
 * an optional description. `name` and `kind` are intentionally NOT shown
 * here — they remain on `data` and round-trip via the migrator, but are
 * managed elsewhere (or left as defaults).
 *
 * Owned constraints (collapsed onto a class via `data.oclConstraints`)
 * are still edited via the `OCLConstraintRow` block inside
 * `ClassEditPanel`.
 */
export const ClassOCLConstraintEditPanel: React.FC<PopoverProps> = ({
  elementId,
}) => {
  const { nodes, setNodes } = useDiagramStore(
    useShallow((state) => ({
      nodes: state.nodes,
      setNodes: state.setNodes,
    }))
  )

  const node = nodes.find((n) => n.id === elementId)
  if (!node) return null
  const data = node.data as ClassOCLConstraintNodeProps

  const updateData = (patch: Partial<ClassOCLConstraintNodeProps>) => {
    setNodes((all) =>
      all.map((n) =>
        n.id === elementId ? { ...n, data: { ...n.data, ...patch } } : n
      )
    )
  }

  const handleStyleFieldUpdate = (key: string, value: string) => {
    updateData({ [key]: value } as Partial<ClassOCLConstraintNodeProps>)
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
        minRows={3}
        maxRows={12}
        placeholder="OCL expression…"
        value={data.expression ?? ""}
        onChange={(e) => updateData({ expression: e.target.value })}
      />
      <MuiTextField
        size="small"
        variant="outlined"
        multiline
        minRows={2}
        maxRows={6}
        placeholder="Description (optional)"
        value={data.description ?? ""}
        onChange={(e) =>
          updateData({ description: e.target.value || undefined })
        }
      />
    </Box>
  )
}
