import {
  Autocomplete,
  Box,
  Stack,
  TextField as MuiTextField,
} from "@mui/material"
import React from "react"
import { useShallow } from "zustand/shallow"
import { useDiagramStore } from "@/store/context"
import { NNReferenceNodeProps } from "@/types"
import { DividerLine, NodeStyleEditor, Typography } from "@/components/ui"
import { PopoverProps } from "@/components/popovers/types"

/**
 * SA-5 inspector for `NNReference`. Edits the visible label + the
 * `referenceTarget` id (chosen from layers in the same NNContainer
 * scope; falls back to a free-text input for cross-container
 * references).
 */
export const NNReferenceEditPanel: React.FC<PopoverProps> = ({ elementId }) => {
  const { nodes, setNodes } = useDiagramStore(
    useShallow((state) => ({
      nodes: state.nodes,
      setNodes: state.setNodes,
    }))
  )
  const node = nodes.find((n) => n.id === elementId)
  if (!node) return null
  const data = node.data as NNReferenceNodeProps

  const update = (patch: Partial<NNReferenceNodeProps>) => {
    setNodes((all) =>
      all.map((n) =>
        n.id === elementId ? { ...n, data: { ...n.data, ...patch } } : n
      )
    )
  }

  const handleDataFieldUpdate = (key: string, value: string) => {
    update({ [key]: value } as Partial<NNReferenceNodeProps>)
  }

  // Same-parent layer candidates (typical case: this NNReference points
  // at a layer in the same container as itself).
  const candidates = nodes
    .filter(
      (n) =>
        n.id !== elementId &&
        n.parentId === node.parentId &&
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
      {/*
        SA-FINAL-3 #2: single `Autocomplete` (freeSolo) replaces the
        previous Select + free-text override pair, which both edited
        the same `referenceTarget` value and made the inspector
        feel duplicated. The dropdown lists same-container Layer
        siblings; users can still type a free-form id for
        cross-container references.
      */}
      <Stack direction="row" alignItems="center" spacing={0.5}>
        <Typography variant="caption" sx={{ minWidth: 100 }}>
          referenceTarget
        </Typography>
        <Autocomplete<{ id: string; name: string }, false, false, true>
          size="small"
          freeSolo
          options={candidates}
          getOptionLabel={(option) =>
            typeof option === "string" ? option : option.name
          }
          // The committed value is always the underlying `id` for
          // recognised siblings; for free-form input we commit the raw
          // string verbatim.
          value={
            candidates.find((c) => c.id === data.referenceTarget) ??
            data.referenceTarget ??
            ""
          }
          onChange={(_, picked) => {
            if (picked == null) {
              update({ referenceTarget: undefined })
              return
            }
            if (typeof picked === "string") {
              update({ referenceTarget: picked })
              return
            }
            update({ referenceTarget: picked.id })
          }}
          onInputChange={(_, input, reason) => {
            // Treat raw typing as a free-form override so the user
            // can target cross-container ids.
            if (reason === "input") {
              update({ referenceTarget: input || undefined })
            }
          }}
          isOptionEqualToValue={(opt, val) => {
            if (typeof val === "string") return opt.id === val
            return opt.id === (val as { id: string }).id
          }}
          renderInput={(params) => (
            <MuiTextField
              {...params}
              variant="outlined"
              placeholder="— none —"
              helperText="Pick a sibling layer or type a free-form id."
            />
          )}
          sx={{ flex: 1 }}
        />
      </Stack>
    </Box>
  )
}
