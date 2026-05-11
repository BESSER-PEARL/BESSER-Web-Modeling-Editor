import {
  Box,
  IconButton,
  Stack,
  TextField as MuiTextField,
} from "@mui/material"
import React from "react"
import { useShallow } from "zustand/shallow"
import { useDiagramStore } from "@/store/context"
import {
  AgentIntentNodeProps,
  AgentIntentTrainingPhrase,
} from "@/types"
import { DividerLine, NodeStyleEditor, Typography } from "@/components/ui"
import { PopoverProps } from "@/components/popovers/types"
import { DeleteIcon } from "@/components/Icon"
import { generateUUID } from "@/utils"
import { InspectorSectionHeader, AddRowButton } from "../_shared"

/**
 * Inspector that edits the parent `AgentIntent`'s
 * inline arrays (`training_phrases[]` / `entity_slots[]`) plus the
 * single-string `intent_description`.
 *
 * v3 originally surfaced every intent field on the parent form.
 * split each child onto its own popover/node; users reported they could
 * not find description / training phrases from the parent.
 * restored the one-stop form by walking the `parentId` chain over
 * separate React-Flow child nodes. folds those
 * children back onto the parent's `data` arrays so the inspector is now
 * a straight read/write over the parent node — no more child-node
 * traversal, no more `extent`/`draggable` housekeeping.
 */
export const AgentIntentEditPanel: React.FC<PopoverProps> = ({ elementId }) => {
  const { nodes, setNodes } = useDiagramStore(
    useShallow((state) => ({
      nodes: state.nodes,
      setNodes: state.setNodes,
    }))
  )
  const intent = nodes.find((n) => n.id === elementId)
  if (!intent) return null

  const data = intent.data as AgentIntentNodeProps
  const phrases = data.training_phrases ?? []

  const updateData = (patch: Partial<AgentIntentNodeProps>) => {
    setNodes((all) =>
      all.map((n) =>
        n.id === elementId ? { ...n, data: { ...n.data, ...patch } } : n
      )
    )
  }

  const handleDataFieldUpdate = (key: string, value: string) => {
    updateData({ [key]: value } as Partial<AgentIntentNodeProps>)
  }

  const setDescription = (value: string) => {
    updateData({ intent_description: value })
  }

  const setPhrase = (rowId: string, value: string) => {
    updateData({
      training_phrases: phrases.map((p) =>
        p.id === rowId ? { ...p, name: value } : p
      ),
    })
  }

  const removePhrase = (rowId: string) => {
    updateData({
      training_phrases: phrases.filter((p) => p.id !== rowId),
    })
  }

  const addPhrase = () => {
    const next: AgentIntentTrainingPhrase = {
      id: generateUUID(),
      name: "",
    }
    updateData({ training_phrases: [...phrases, next] })
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      {/*
       * Match v3 fork: intent inspector exposes only intent name +
       * description + training phrases. The duplicate name field that
       * `NodeStyleEditor` would render is suppressed via
       * `showNameInputChange={false}`; the style controls (fill / line /
       * text color) remain.
       */}
      <NodeStyleEditor
        nodeData={data}
        handleDataFieldUpdate={handleDataFieldUpdate}
        showNameInputChange={false}
      />
      <DividerLine width="100%" />

      <MuiTextField
        size="small"
        variant="outlined"
        fullWidth
        label="intent name"
        value={data.name ?? ""}
        onChange={(e) => updateData({ name: e.target.value })}
      />

      <DividerLine width="100%" />
      <InspectorSectionHeader>description</InspectorSectionHeader>
      <MuiTextField
        size="small"
        variant="outlined"
        fullWidth
        multiline
        minRows={2}
        value={data.intent_description ?? ""}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description of what this intent represents"
      />

      <DividerLine width="100%" />
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
      >
        <InspectorSectionHeader>training phrases</InspectorSectionHeader>
        <AddRowButton onClick={addPhrase} />
      </Stack>
      {phrases.length === 0 ? (
        <Typography variant="caption" sx={{ opacity: 0.6 }}>
          no training phrases yet
        </Typography>
      ) : (
        phrases.map((p) => (
          <Stack key={p.id} direction="row" spacing={0.5} alignItems="center">
            <MuiTextField
              size="small"
              variant="outlined"
              fullWidth
              value={p.name ?? ""}
              onChange={(e) => setPhrase(p.id, e.target.value)}
              placeholder="e.g. hello"
            />
            <IconButton
              size="small"
              aria-label="delete training phrase"
              onClick={() => removePhrase(p.id)}
            >
              <DeleteIcon />
            </IconButton>
          </Stack>
        ))
      )}

      {/*
       * Entity-slots section removed: v3 fork's intent inspector exposed
       * only intent name + description + training phrases. The
       * `entity_slots[]` data field still exists on `AgentIntentNodeProps`
       * for round-trip preservation, but is not editable from this
       * inspector.
       */}
    </Box>
  )
}
