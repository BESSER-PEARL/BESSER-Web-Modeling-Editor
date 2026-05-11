import {
  Box,
  IconButton,
  MenuItem,
  Select,
  Stack,
  TextField as MuiTextField,
  Tooltip,
} from "@mui/material"
import React, { useMemo } from "react"
import { useShallow } from "zustand/shallow"
import { useDiagramStore } from "@/store/context"
import { DividerLine, EdgeStyleEditor, Typography } from "@/components/ui"
import { CustomEdgeProps } from "@/edges/EdgeProps"
import { PopoverProps } from "@/components/popovers/types"
import { SwapHorizIcon } from "@/components/Icon"
import {
  diagramBridge,
  IAssociationInfo,
} from "@/services/diagramBridge"
import { ObjectNodeProps } from "@/types"

/**
 * ObjectLinkEditPanel — single inspector body for the v4
 * `ObjectLink` edge.
 *
 * Source-of-truth port: `packages/editor/.../uml-object-link-update.tsx`.
 *
 * Fields:
 *
 *   - `name` text field
 *   - flip action — swaps source/target/handle pairs in the store.
 *   - association picker driven by
 *     `diagramBridge.getAvailableAssociations(sourceClassId,
 *     targetClassId)`. The class IDs come from the link's source /
 *     target ObjectName nodes' `data.classId`. Empty list when either
 *     side has no `classId` set.
 *   - color editor (`strokeColor`, `textColor`).
 */
export const ObjectLinkEditPanel: React.FC<PopoverProps> = ({ elementId }) => {
  const { edges, nodes, setEdges } = useDiagramStore(
    useShallow((state) => ({
      edges: state.edges,
      nodes: state.nodes,
      setEdges: state.setEdges,
    }))
  )

  const edge = edges.find((e) => e.id === elementId)

  // Resolve source / target class IDs by walking the ObjectName nodes
  // at each end of the link. Either may be undefined (unlinked
  // instance), which empties the association picker.
  const associations: IAssociationInfo[] = useMemo(() => {
    if (!edge) return []
    const sourceNode = nodes.find((n) => n.id === edge.source)
    const targetNode = nodes.find((n) => n.id === edge.target)
    const sourceClassId = (sourceNode?.data as ObjectNodeProps | undefined)
      ?.classId
    const targetClassId = (targetNode?.data as ObjectNodeProps | undefined)
      ?.classId
    if (!sourceClassId || !targetClassId) return []
    try {
      return diagramBridge.getAvailableAssociations(
        sourceClassId,
        targetClassId
      )
    } catch {
      return []
    }
  }, [edge, nodes])

  if (!edge) return null

  const data = (edge.data ?? {}) as CustomEdgeProps & {
    name?: string
    associationId?: string
  }

  const updateData = (
    patch: Partial<CustomEdgeProps & { name?: string; associationId?: string }>
  ) => {
    setEdges((all) =>
      all.map((e) =>
        e.id === elementId ? { ...e, data: { ...e.data, ...patch } } : e
      )
    )
  }

  const handleSwap = () => {
    setEdges((all) =>
      all.map((e) => {
        if (e.id !== elementId) return e
        return {
          ...e,
          source: e.target,
          sourceHandle: e.targetHandle,
          target: e.source,
          targetHandle: e.sourceHandle,
        }
      })
    )
  }

  const handleStyleFieldUpdate = (
    key: "strokeColor" | "textColor",
    value: string
  ) => {
    updateData({ [key]: value })
  }

  const handleAssociationChange = (associationId: string) => {
    if (!associationId) {
      updateData({ associationId: undefined, name: data.name })
      return
    }
    const selected = associations.find((a) => a.id === associationId)
    if (!selected) return
    // Mirror v3 `uml-object-link-update.tsx:79-95`: pin the association
    // and pre-fill the link name from the chosen association's
    // canonical display name when present.
    const displayName = diagramBridge.getRelationshipDisplayName(selected)
    updateData({
      associationId: selected.id,
      name: displayName ?? data.name,
    })
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <EdgeStyleEditor
        edgeData={data}
        handleDataFieldUpdate={handleStyleFieldUpdate}
        label="Link"
        sideElements={[
          <Tooltip key="flip" title="Flip source / target">
            <IconButton size="small" onClick={handleSwap}>
              <SwapHorizIcon />
            </IconButton>
          </Tooltip>,
        ]}
      />

      <DividerLine width="100%" />

      <MuiTextField
        size="small"
        variant="outlined"
        fullWidth
        label="name"
        value={data.name ?? ""}
        onChange={(e) => updateData({ name: e.target.value })}
      />

      <Stack direction="row" alignItems="center" spacing={0.5}>
        {/* Caption col 80 → 70 for sibling consistency. */}
        <Typography variant="caption" sx={{ minWidth: 70 }}>
          association
        </Typography>
        <Select
          size="small"
          value={data.associationId ?? ""}
          displayEmpty
          onChange={(e) => handleAssociationChange(String(e.target.value))}
          sx={{ flex: 1 }}
        >
          <MenuItem value="">— Unlinked —</MenuItem>
          {associations.map((a) => (
            <MenuItem key={a.id} value={a.id}>
              {diagramBridge.getRelationshipDisplayName(a)}
            </MenuItem>
          ))}
        </Select>
      </Stack>
      {associations.length === 0 && (
        <Typography variant="caption" sx={{ color: "var(--besser-gray-700)" }}>
          No associations available — link source / target objects to
          classes first.
        </Typography>
      )}
    </Box>
  )
}
