import {
  Box,
  IconButton,
  MenuItem,
  Select,
  Stack,
  TextField as MuiTextField,
} from "@mui/material"
import React from "react"
import { useShallow } from "zustand/shallow"
import { useDiagramStore } from "@/store/context"
import { StateMarkerNodeProps } from "@/types"
import { DividerLine, NodeStyleEditor, Typography } from "@/components/ui"
import { DeleteIcon } from "@/components/Icon"
import { PopoverProps } from "@/components/popovers/types"
import { InspectorSectionHeader } from "../_shared"

/**
 * Inline decisions editor for `StateMergeNode`.
 *
 * v3 listed each outgoing transition with an editable name plus an
 * arrow + target dropdown so users could re-route decision branches
 * straight from the inspector. The new library lost that surface area
 * — the merge node was sharing `StateLabelEditPanel` (label-only).
 *
 * This panel walks `useDiagramStore(s => s.edges).filter(e => e.source
 * === node.id)` and renders one row per outgoing edge with:
 *
 *   - editable transition `name`
 *   - dropdown to change `target` (sourced from the live `nodes` list)
 *   - delete button (removes the edge entirely)
 *
 * Plus the standard `name` field + colors, for parity with the other
 * marker panels.
 *
 * Registered against `StateMergeNode` in
 * `inspectors/stateMachineDiagram/index.ts` (replaces the previous
 * `StateLabelEditPanel` registration for that type).
 */
export const StateMergeNodeEditPanel: React.FC<PopoverProps> = ({
  elementId,
}) => {
  const { nodes, edges, setNodes, setEdges } = useDiagramStore(
    useShallow((state) => ({
      nodes: state.nodes,
      edges: state.edges,
      setNodes: state.setNodes,
      setEdges: state.setEdges,
    }))
  )
  const node = nodes.find((n) => n.id === elementId)
  if (!node) return null

  const data = node.data as StateMarkerNodeProps

  const update = (patch: Partial<StateMarkerNodeProps>) => {
    setNodes((all) =>
      all.map((n) =>
        n.id === elementId ? { ...n, data: { ...n.data, ...patch } } : n
      )
    )
  }

  const handleDataFieldUpdate = (key: string, value: string) => {
    update({ [key]: value } as Partial<StateMarkerNodeProps>)
  }

  const outgoingEdges = edges.filter((e) => e.source === elementId)

  // Targets: every other node (you can't loop a merge back to itself).
  const targetOptions = nodes.filter((n) => n.id !== elementId)

  const updateEdge = (
    edgeId: string,
    patch: { name?: string; target?: string }
  ) => {
    setEdges((all) =>
      all.map((e) => {
        if (e.id !== edgeId) return e
        const next = { ...e }
        if (patch.target !== undefined) {
          next.target = patch.target
          // clear targetHandle when re-routing — the new target's
          // handles aren't necessarily compatible with the old id.
          next.targetHandle = null
        }
        if (patch.name !== undefined) {
          next.data = { ...next.data, name: patch.name }
        }
        return next
      })
    )
  }

  const removeEdge = (edgeId: string) => {
    setEdges((all) => all.filter((e) => e.id !== edgeId))
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <NodeStyleEditor
        nodeData={data}
        handleDataFieldUpdate={handleDataFieldUpdate}
      />
      <DividerLine width="100%" />

      <MuiTextField
        size="small"
        variant="outlined"
        fullWidth
        label="label"
        value={data.name ?? ""}
        onChange={(e) => update({ name: e.target.value })}
      />

      <DividerLine width="100%" />
      <InspectorSectionHeader>decisions</InspectorSectionHeader>
      {outgoingEdges.length === 0 && (
        <Typography variant="caption" sx={{ color: "var(--besser-gray, #888)" }}>
          No outgoing transitions yet.
        </Typography>
      )}
      {outgoingEdges.map((edge) => {
        const edgeName =
          ((edge.data ?? {}) as { name?: string }).name ?? ""
        return (
          <Stack
            key={edge.id}
            direction="row"
            alignItems="center"
            spacing={0.5}
            sx={{ padding: "4px 0" }}
          >
            <MuiTextField
              size="small"
              variant="outlined"
              fullWidth
              placeholder="name"
              value={edgeName}
              onChange={(e) => updateEdge(edge.id, { name: e.target.value })}
            />
            <Typography
              variant="caption"
              sx={{ minWidth: 18, textAlign: "center" }}
            >
              {"→"}
            </Typography>
            <Select
              size="small"
              value={edge.target}
              onChange={(e) =>
                updateEdge(edge.id, { target: String(e.target.value) })
              }
              sx={{ flex: 1, minWidth: 100 }}
            >
              {targetOptions.map((n) => {
                const label =
                  ((n.data ?? {}) as { name?: string }).name?.trim() ||
                  `${n.type ?? "Node"} (${n.id.slice(0, 6)})`
                return (
                  <MenuItem key={n.id} value={n.id}>
                    {label}
                  </MenuItem>
                )
              })}
            </Select>
            <IconButton size="small" onClick={() => removeEdge(edge.id)}>
              <DeleteIcon width={14} height={14} />
            </IconButton>
          </Stack>
        )
      })}
    </Box>
  )
}
