import { Box } from "@mui/material"
import React from "react"
import { useShallow } from "zustand/shallow"
import { useDiagramStore } from "@/store/context"
import { EdgeStyleEditor } from "@/components/ui"
import { CustomEdgeProps } from "@/edges/EdgeProps"
import { PopoverProps } from "@/components/popovers/types"

/**
 * Inspector body for the `CommentLink` tether edge — the v4 spelling of
 * v3's `GeneralRelationshipType.Link` (`uml-link.ts`, drawn dashed by
 * the association component).
 *
 * Intentionally minimal: the canonical wire shape is plain
 * `{id, source, target, sourceHandle?, targetHandle?, data:{points?}}` —
 * no roles / multiplicities / labels exist on a comment tether, so the
 * only meaningful control is the stroke styling exposed by
 * `EdgeStyleEditor` (matching what other simple edges expose).
 */
export const CommentLinkEditPanel: React.FC<PopoverProps> = ({
  elementId,
}) => {
  const { edges, setEdges } = useDiagramStore(
    useShallow((state) => ({
      edges: state.edges,
      setEdges: state.setEdges,
    }))
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

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <EdgeStyleEditor
        edgeData={data}
        handleDataFieldUpdate={handleStyleFieldUpdate}
        label="Comment Link"
      />
    </Box>
  )
}
