import {
  Box,
  Checkbox,
  FormControlLabel,
  IconButton,
  Stack,
  TextField as MuiTextField,
} from "@mui/material"
import React from "react"
import { useShallow } from "zustand/shallow"
import { useDiagramStore } from "@/store/context"
import { StateBodyRow, StateNodeProps } from "@/types"
import { DividerLine, NodeStyleEditor, Typography } from "@/components/ui"
import { PopoverProps } from "@/components/popovers/types"
import { DeleteIcon } from "@/components/Icon"
import { generateUUID } from "@/utils"
import { InspectorSectionHeader, AddRowButton } from "../_shared"

/**
 * Inspector body for the `State` parent node. v3 parity: body and
 * fallback-body rows live inline on `data.bodies` / `data.fallbackBodies`
 * (mirrors AgentState and Class attribute rows). Editable here.
 */
export const StateEditPanel: React.FC<PopoverProps> = ({ elementId }) => {
  const { nodes, setNodes } = useDiagramStore(
    useShallow((state) => ({
      nodes: state.nodes,
      setNodes: state.setNodes,
    }))
  )
  const node = nodes.find((n) => n.id === elementId)
  if (!node) return null

  const data = node.data as StateNodeProps
  const bodies: StateBodyRow[] = data.bodies ?? []
  const fallbackBodies: StateBodyRow[] = data.fallbackBodies ?? []

  const update = (patch: Partial<StateNodeProps>) => {
    setNodes((all) =>
      all.map((n) =>
        n.id === elementId ? { ...n, data: { ...n.data, ...patch } } : n
      )
    )
  }

  const handleDataFieldUpdate = (key: string, value: string) => {
    update({ [key]: value } as Partial<StateNodeProps>)
  }

  type Section = "main" | "fallback"
  const sectionRows = (s: Section) => (s === "fallback" ? fallbackBodies : bodies)
  const replaceSection = (
    s: Section,
    mapper: (rows: StateBodyRow[]) => StateBodyRow[]
  ) => {
    if (s === "fallback") update({ fallbackBodies: mapper(fallbackBodies) })
    else update({ bodies: mapper(bodies) })
  }
  const sectionForRow = (rowId: string): Section =>
    bodies.some((r) => r.id === rowId) ? "main" : "fallback"

  const setRowName = (rowId: string, name: string) =>
    replaceSection(sectionForRow(rowId), (rows) =>
      rows.map((r) => (r.id === rowId ? { ...r, name } : r))
    )
  const removeRow = (rowId: string) =>
    replaceSection(sectionForRow(rowId), (rows) =>
      rows.filter((r) => r.id !== rowId)
    )
  const addRow = (s: Section) =>
    replaceSection(s, (rows) => [...rows, { id: generateUUID(), name: "" }])

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <NodeStyleEditor
        nodeData={data}
        handleDataFieldUpdate={handleDataFieldUpdate}
        showNameInputChange={false}
      />
      <DividerLine width="100%" />

      <Stack direction="row" spacing={1}>
        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={!!data.italic}
              onChange={(e) => update({ italic: e.target.checked })}
            />
          }
          label="italic"
        />
        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={!!data.underline}
              onChange={(e) => update({ underline: e.target.checked })}
            />
          }
          label="underline"
        />
      </Stack>

      <MuiTextField
        size="small"
        variant="outlined"
        fullWidth
        label="name"
        value={data.name}
        onChange={(e) => update({ name: e.target.value })}
      />

      <DividerLine width="100%" />
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <InspectorSectionHeader>body</InspectorSectionHeader>
        <AddRowButton onClick={() => addRow("main")} />
      </Stack>
      {bodies.length === 0 ? (
        <Typography variant="caption" sx={{ opacity: 0.6 }}>
          no body rows yet
        </Typography>
      ) : (
        sectionRows("main").map((r) => (
          <Stack key={r.id} direction="row" spacing={0.5} alignItems="center">
            <MuiTextField
              size="small"
              variant="outlined"
              fullWidth
              value={r.name ?? ""}
              onChange={(e) => setRowName(r.id, e.target.value)}
              placeholder="entry / do / exit / on"
            />
            <IconButton
              size="small"
              aria-label="delete body"
              onClick={() => removeRow(r.id)}
            >
              <DeleteIcon />
            </IconButton>
          </Stack>
        ))
      )}

      <DividerLine width="100%" />
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <InspectorSectionHeader>fallback body</InspectorSectionHeader>
        <AddRowButton onClick={() => addRow("fallback")} />
      </Stack>
      {fallbackBodies.length === 0 ? (
        <Typography variant="caption" sx={{ opacity: 0.6 }}>
          no fallback body rows yet
        </Typography>
      ) : (
        sectionRows("fallback").map((r) => (
          <Stack key={r.id} direction="row" spacing={0.5} alignItems="center">
            <MuiTextField
              size="small"
              variant="outlined"
              fullWidth
              value={r.name ?? ""}
              onChange={(e) => setRowName(r.id, e.target.value)}
              placeholder="fallback action"
            />
            <IconButton
              size="small"
              aria-label="delete fallback body"
              onClick={() => removeRow(r.id)}
            >
              <DeleteIcon />
            </IconButton>
          </Stack>
        ))
      )}
    </Box>
  )
}
