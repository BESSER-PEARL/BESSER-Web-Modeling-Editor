import { Box, IconButton, Tooltip } from "@mui/material"
import React from "react"
import { useShallow } from "zustand/shallow"
import { useDiagramStore, usePopoverStore } from "@/store/context"
import { EdgeStyleEditor } from "@/components/ui"
import { DeleteIcon, SwapHorizIcon } from "@/components/Icon"
import { CustomEdgeProps } from "@/edges/EdgeProps"
import { PopoverProps } from "@/components/popovers/types"

/**
 * Inspector body for `AgentStateTransitionInit`.
 *
 * Develop parity: the init transition resolves to
 * `DefaultRelationshipPopup` (`packages/popups.ts`), whose surface is
 * header + style pane (line color) + delete (trash). Ported here as:
 *
 *   - `EdgeStyleEditor` for the line / text colors (the init edge
 *     renders its optional `name` / `params` text with `textColor`, so
 *     both swatches stay live),
 *   - flip (swap source / target + handles), mirroring
 *     `AgentDiagramEdgeEditPanel.handleSwap`,
 *   - delete, which removes the edge and closes the popover — develop's
 *     popup dismisses itself the same way once the relationship is gone.
 *
 * The edge carries no trigger semantics (pure initial-state marker), so
 * there are no further editable fields.
 */
export const AgentDiagramInitEdgeEditPanel: React.FC<PopoverProps> = ({
  elementId,
}) => {
  const { edges, setEdges } = useDiagramStore(
    useShallow((state) => ({
      edges: state.edges,
      setEdges: state.setEdges,
    }))
  )
  const setPopOverElementId = usePopoverStore(
    useShallow((state) => state.setPopOverElementId)
  )
  const edge = edges.find((e) => e.id === elementId)
  if (!edge) return null

  const data = (edge.data ?? {}) as CustomEdgeProps

  const handleStyleFieldUpdate = (
    key: "strokeColor" | "textColor",
    value: string
  ) => {
    setEdges((all) =>
      all.map((e) =>
        e.id === elementId ? { ...e, data: { ...e.data, [key]: value } } : e
      )
    )
  }

  // Flip swaps source/target/handle pairs on the edge, mirroring
  // `AgentDiagramEdgeEditPanel.handleSwap`.
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

  // Delete removes the edge and closes the popover so it doesn't linger
  // anchored to a removed element.
  const handleDelete = () => {
    setEdges((all) => all.filter((e) => e.id !== elementId))
    setPopOverElementId(null)
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <EdgeStyleEditor
        edgeData={data}
        handleDataFieldUpdate={handleStyleFieldUpdate}
        label="Init Transition"
        sideElements={[
          <Tooltip key="flip" title="Flip source / target">
            <IconButton
              size="small"
              onClick={handleSwap}
              aria-label="Flip source / target"
            >
              <SwapHorizIcon />
            </IconButton>
          </Tooltip>,
          <Tooltip key="delete" title="Delete init transition">
            <IconButton
              size="small"
              onClick={handleDelete}
              aria-label="Delete init transition"
            >
              <DeleteIcon width={16} height={16} />
            </IconButton>
          </Tooltip>,
        ]}
      />
    </Box>
  )
}
