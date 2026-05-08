import {
  Box,
  MenuItem,
  Select,
  Stack,
  TextField as MuiTextField,
} from "@mui/material"
import React from "react"
import { useShallow } from "zustand/shallow"
import { useDiagramStore } from "@/store/context"
import { ClassOCLConstraintNodeProps } from "@/types"
import { DividerLine, NodeStyleEditor, Typography } from "@/components/ui"
import { PopoverProps } from "@/components/popovers/types"

/**
 * SA-UX-FIX B1: Inspector body for the free-standing OCL constraint node.
 * Used when a v3 `ClassOCLConstraint` element has no owner class — keeps
 * the field set minimal: name, kind, expression body, description.
 *
 * Owned constraints (collapsed onto a class) are still edited via the
 * `OCLConstraintRow` block inside `ClassEditPanel`.
 */
const KIND_OPTIONS = [
  { value: "", label: "(auto)" },
  { value: "inv", label: "inv (invariant)" },
  { value: "pre", label: "pre (precondition)" },
  { value: "post", label: "post (postcondition)" },
] as const

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
      <Stack direction="row" spacing={0.5} alignItems="center">
        <Typography variant="caption" sx={{ minWidth: 80 }}>
          name
        </Typography>
        <MuiTextField
          size="small"
          variant="outlined"
          fullWidth
          placeholder="constraint name"
          value={data.name ?? ""}
          onChange={(e) => updateData({ name: e.target.value })}
        />
      </Stack>
      <Stack direction="row" spacing={0.5} alignItems="center">
        <Typography variant="caption" sx={{ minWidth: 80 }}>
          kind
        </Typography>
        <Select
          size="small"
          value={data.kind ?? ""}
          displayEmpty
          onChange={(e) =>
            updateData({ kind: String(e.target.value) || undefined })
          }
          sx={{ flex: 1 }}
        >
          {KIND_OPTIONS.map((k) => (
            <MenuItem key={k.value} value={k.value}>
              {k.label}
            </MenuItem>
          ))}
        </Select>
      </Stack>
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
