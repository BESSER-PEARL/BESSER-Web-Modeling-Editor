import {
  Box,
  Button,
  IconButton,
  Stack,
  TextField as MuiTextField,
} from "@mui/material"
import React from "react"
import { useShallow } from "zustand/shallow"
import { useDiagramStore } from "@/store/context"
import { AgentIntentNodeProps } from "@/types"
import { DividerLine, NodeStyleEditor, Typography } from "@/components/ui"
import { PopoverProps } from "@/components/popovers/types"
import { DeleteIcon } from "@/components/Icon"

/**
 * SA-UX-FIX-2 (B1) — consolidated parent-intent inspector.
 *
 * v3 used to surface ALL intent fields (name + description + every
 * training phrase + every entity/slot mapping) in a single form opened
 * from the parent `AgentIntent`. SA-4 split each child onto its own
 * inspector, but users reported they could not "find" the description
 * or training phrases, because clicking the parent only exposed the
 * name. This panel restores the v3 one-stop form by walking the
 * `parentId` chain to enumerate the intent's children and editing them
 * in place. Children retain their own inspectors as well (SA-4 wiring
 * preserved) for direct-edit workflows.
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

  const update = (patch: Partial<AgentIntentNodeProps>) => {
    setNodes((all) =>
      all.map((n) =>
        n.id === elementId ? { ...n, data: { ...n.data, ...patch } } : n
      )
    )
  }

  const handleDataFieldUpdate = (key: string, value: string) => {
    update({ [key]: value } as Partial<AgentIntentNodeProps>)
  }

  // Children of this intent (training phrases, description, slot bindings)
  const trainingPhrases = nodes.filter(
    (n) => n.parentId === elementId && n.type === "AgentIntentBody"
  )
  const descriptionNodes = nodes.filter(
    (n) => n.parentId === elementId && n.type === "AgentIntentDescription"
  )
  const objectComponents = nodes.filter(
    (n) => n.parentId === elementId && n.type === "AgentIntentObjectComponent"
  )

  // The v3 model held a single description per intent. Use the first one if
  // present and mirror the value onto `data.intent_description` for the
  // round-trip.
  const descriptionNode = descriptionNodes[0] ?? null
  const descriptionValue =
    (descriptionNode?.data as { name?: string } | undefined)?.name ??
    data.intent_description ??
    ""

  const setChildField = (
    childId: string,
    patch: Record<string, unknown>
  ) => {
    setNodes((all) =>
      all.map((n) =>
        n.id === childId ? { ...n, data: { ...n.data, ...patch } } : n
      )
    )
  }

  const setDescription = (value: string) => {
    if (descriptionNode) {
      setChildField(descriptionNode.id, { name: value })
    }
    // Always mirror onto the parent so the v3 wire shape is preserved.
    update({ intent_description: value })
  }

  const setPhrase = (childId: string, value: string) => {
    setChildField(childId, { name: value })
  }

  const removeChild = (childId: string) => {
    setNodes((all) => all.filter((n) => n.id !== childId))
  }

  const addPhrase = () => {
    // Stack a new AgentIntentBody under the intent. Position is computed by
    // appending below the existing rows; layout normalisation runs on the
    // next React-Flow render via the parent's auto-grow logic.
    const lastY = Math.max(
      0,
      ...trainingPhrases.map((n) => (n.position?.y ?? 0) + (Number(n.height) || 30))
    )
    const newId = `${elementId}-phrase-${Date.now().toString(36)}`
    const intentWidth = Math.max(120, Number(intent.width) || 200)
    setNodes((all) => [
      ...all,
      {
        id: newId,
        type: "AgentIntentBody",
        parentId: elementId,
        position: { x: 0, y: Math.max(40, lastY + 4) },
        width: intentWidth,
        height: 30,
        data: { name: "" },
        // Match other body rows: extents constrained to the parent.
        extent: "parent",
        draggable: false,
        selectable: true,
      } as never,
    ])
  }

  const addObjectComponent = () => {
    const newId = `${elementId}-slot-${Date.now().toString(36)}`
    const intentWidth = Math.max(120, Number(intent.width) || 200)
    const lastY = Math.max(
      0,
      ...objectComponents.map(
        (n) => (n.position?.y ?? 0) + (Number(n.height) || 30)
      )
    )
    setNodes((all) => [
      ...all,
      {
        id: newId,
        type: "AgentIntentObjectComponent",
        parentId: elementId,
        position: { x: 0, y: Math.max(40, lastY + 4) },
        width: intentWidth,
        height: 30,
        data: { name: "", entity: "", slot: "", value: "" },
        extent: "parent",
        draggable: false,
        selectable: true,
      } as never,
    ])
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
        label="intent name"
        value={data.name ?? ""}
        onChange={(e) => update({ name: e.target.value })}
      />

      <DividerLine width="100%" />
      <Typography variant="caption">description</Typography>
      <MuiTextField
        size="small"
        variant="outlined"
        fullWidth
        multiline
        minRows={2}
        value={descriptionValue}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description of what this intent represents"
      />

      <DividerLine width="100%" />
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
      >
        <Typography variant="caption">training phrases</Typography>
        <Button
          size="small"
          variant="text"
          onClick={addPhrase}
        >
          + add
        </Button>
      </Stack>
      {trainingPhrases.length === 0 ? (
        <Typography variant="caption" sx={{ opacity: 0.6 }}>
          no training phrases yet
        </Typography>
      ) : (
        trainingPhrases.map((p) => (
          <Stack key={p.id} direction="row" spacing={0.5} alignItems="center">
            <MuiTextField
              size="small"
              variant="outlined"
              fullWidth
              value={(p.data as { name?: string }).name ?? ""}
              onChange={(e) => setPhrase(p.id, e.target.value)}
              placeholder="e.g. hello"
            />
            <IconButton
              size="small"
              aria-label="delete training phrase"
              onClick={() => removeChild(p.id)}
            >
              <DeleteIcon />
            </IconButton>
          </Stack>
        ))
      )}

      <DividerLine width="100%" />
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
      >
        <Typography variant="caption">entity slots</Typography>
        <Button
          size="small"
          variant="text"
          onClick={addObjectComponent}
        >
          + add
        </Button>
      </Stack>
      {objectComponents.length === 0 ? (
        <Typography variant="caption" sx={{ opacity: 0.6 }}>
          no entity slots yet
        </Typography>
      ) : (
        objectComponents.map((oc) => {
          const ocData = oc.data as {
            name?: string
            entity?: string
            slot?: string
            value?: string
          }
          return (
            <Stack key={oc.id} spacing={0.5} sx={{ mb: 0.5 }}>
              <Stack direction="row" spacing={0.5} alignItems="center">
                <MuiTextField
                  size="small"
                  variant="outlined"
                  fullWidth
                  label="name"
                  value={ocData.name ?? ""}
                  onChange={(e) =>
                    setChildField(oc.id, { name: e.target.value })
                  }
                />
                <IconButton
                  size="small"
                  aria-label="delete entity slot"
                  onClick={() => removeChild(oc.id)}
                >
                  <DeleteIcon />
                </IconButton>
              </Stack>
              <Stack direction="row" spacing={0.5}>
                <MuiTextField
                  size="small"
                  variant="outlined"
                  label="entity"
                  value={ocData.entity ?? ""}
                  onChange={(e) =>
                    setChildField(oc.id, { entity: e.target.value })
                  }
                  sx={{ flex: 1 }}
                />
                <MuiTextField
                  size="small"
                  variant="outlined"
                  label="slot"
                  value={ocData.slot ?? ""}
                  onChange={(e) =>
                    setChildField(oc.id, { slot: e.target.value })
                  }
                  sx={{ flex: 1 }}
                />
              </Stack>
              <MuiTextField
                size="small"
                variant="outlined"
                fullWidth
                label="value"
                value={ocData.value ?? ""}
                onChange={(e) =>
                  setChildField(oc.id, { value: e.target.value })
                }
                placeholder="optional fixed value"
              />
            </Stack>
          )
        })
      )}
    </Box>
  )
}
