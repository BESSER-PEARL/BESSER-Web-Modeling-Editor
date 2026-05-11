import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  MenuItem,
  Select,
  Stack,
  TextField as MuiTextField,
} from "@mui/material"
import React from "react"
import { useShallow } from "zustand/shallow"
import { useDiagramStore } from "@/store/context"
import { NNContainerNodeProps } from "@/types"
import { DividerLine, NodeStyleEditor, Typography } from "@/components/ui"
import { PopoverProps } from "@/components/popovers/types"
import { InspectorSectionHeader } from "../_shared"

/**
 * SA-5 inspector for `NNContainer`. Edits the model name + the
 * optional entry-layer reference (which child layer is the input
 * side, if v3 carried that field). The dropdown lists this
 * container's children resolved from the React-Flow node list via
 * `parentId`.
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

  const update = (patch: Partial<NNContainerNodeProps>) => {
    setNodes((all) =>
      all.map((n) =>
        n.id === elementId ? { ...n, data: { ...n.data, ...patch } } : n
      )
    )
  }
  const handleDataFieldUpdate = (key: string, value: string) => {
    update({ [key]: value } as Partial<NNContainerNodeProps>)
  }

  const childLayers = nodes
    .filter(
      (n) =>
        n.parentId === elementId &&
        typeof n.type === "string" &&
        n.type.endsWith("Layer")
    )
    .map((n) => ({
      id: n.id,
      name: (n.data as { name?: string }).name ?? n.id,
    }))

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <NodeStyleEditor
        nodeData={data as never}
        handleDataFieldUpdate={handleDataFieldUpdate}
      />
      <DividerLine width="100%" />
      <MuiTextField
        size="small"
        variant="outlined"
        fullWidth
        label="name"
        value={data.name ?? ""}
        onChange={(e) => update({ name: e.target.value })}
      />
      {/* SA-FINAL-3 #7 — description collapsed behind a Metadata
          Accordion when empty. */}
      <Accordion
        defaultExpanded={!!data.description}
        disableGutters
        elevation={0}
        sx={{
          background: "transparent",
          "&:before": { display: "none" },
          border: "1px solid var(--besser-gray, #e9ecef)",
          borderRadius: 1,
        }}
      >
        <AccordionSummary
          sx={{
            minHeight: 32,
            "& .MuiAccordionSummary-content": { margin: "4px 0" },
          }}
        >
          <InspectorSectionHeader>Metadata</InspectorSectionHeader>
        </AccordionSummary>
        <AccordionDetails
          sx={{ display: "flex", flexDirection: "column", gap: 1, pt: 0 }}
        >
          <MuiTextField
            size="small"
            variant="outlined"
            fullWidth
            multiline
            minRows={2}
            label="description"
            value={data.description ?? ""}
            onChange={(e) => update({ description: e.target.value })}
          />
        </AccordionDetails>
      </Accordion>
      <Stack direction="row" alignItems="center" spacing={0.5}>
        <Typography variant="caption" sx={{ minWidth: 100 }}>
          entryLayerId
        </Typography>
        <Select
          size="small"
          value={data.entryLayerId ?? ""}
          onChange={(e) => update({ entryLayerId: String(e.target.value) })}
          displayEmpty
          sx={{ flex: 1 }}
        >
          <MenuItem value="">— none —</MenuItem>
          {childLayers.map((c) => (
            <MenuItem key={c.id} value={c.id}>
              {c.name}
            </MenuItem>
          ))}
        </Select>
      </Stack>
    </Box>
  )
}
