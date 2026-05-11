import { Box, MenuItem, Select, Stack } from "@mui/material"
import React from "react"
import { useShallow } from "zustand/shallow"
import { useDiagramStore } from "@/store/context"
import { NNReferenceNodeProps } from "@/types"
import { DividerLine, NodeStyleEditor, Typography } from "@/components/ui"
import { PopoverProps } from "@/components/popovers/types"

/**
 * Inspector for `NNReference`. Shows:
 *  - `name` — display label on the card
 *  - `referenceTarget` — id of the `NNContainer` this reference points
 *    at. Picker is filtered to NNContainer nodes only (the reference
 *    represents "use the layers from this container here"); selecting
 *    one keeps both `referenceTarget` (id) and `name` (display label)
 *    in sync with the container's current name.
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

  // Available containers in the same diagram (exclude this reference's
  // own parent container — referencing your own parent isn't meaningful).
  const containers = nodes
    .filter((n) => n.type === "NNContainer" && n.id !== node.parentId)
    .map((n) => ({
      id: n.id,
      name: (n.data as { name?: string }).name ?? n.id,
    }))

  const selectedTargetId =
    data.referenceTarget &&
    containers.some((c) => c.id === data.referenceTarget)
      ? data.referenceTarget
      : ""

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <NodeStyleEditor
        nodeData={data as never}
        handleDataFieldUpdate={handleDataFieldUpdate}
        showNameInputChange={false}
      />
      <DividerLine width="100%" />

      {/* `name` field removed: the card displays the referenced
          container's name live, so a user-editable name on the
          reference itself isn't meaningful. */}

      <Stack direction="row" alignItems="center" spacing={0.5}>
        <Typography variant="caption" sx={{ minWidth: 70 }}>
          references
        </Typography>
        <Select
          size="small"
          value={selectedTargetId}
          displayEmpty
          onChange={(e) => {
            const newId = String(e.target.value)
            if (!newId) {
              update({ referenceTarget: undefined })
              return
            }
            const picked = containers.find((c) => c.id === newId)
            if (!picked) return
            update({
              referenceTarget: picked.id,
              // Sync the display name to the picked container's name.
              name: picked.name,
            })
          }}
          sx={{ flex: 1 }}
        >
          <MenuItem value="">— no container —</MenuItem>
          {containers.map((c) => (
            <MenuItem key={c.id} value={c.id}>
              {c.name}
            </MenuItem>
          ))}
        </Select>
      </Stack>
      {containers.length === 0 && (
        <Typography variant="caption" sx={{ opacity: 0.6 }}>
          no other NNContainer in this diagram yet
        </Typography>
      )}
    </Box>
  )
}
