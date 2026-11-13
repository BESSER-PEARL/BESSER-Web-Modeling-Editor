import { Box, Stack, TextField as MuiTextField } from "@mui/material"
import React from "react"
import { useShallow } from "zustand/shallow"
import { useDiagramStore } from "@/store/context"
import { DefaultNodeProps } from "@/types"
import { DividerLine, NodeStyleEditor, Typography } from "@/components/ui"
import { PopoverProps } from "@/components/popovers/types"
import { useTranslation } from "@/i18n"
import { InspectorSectionHeader } from "../_shared"

/**
 * Inspector for the ActivityDiagram decision / merge node
 * (`activityMergeNode`). Port of v3 `UMLActivityMergeNodeUpdate`
 * (`uml-activity-diagram/uml-activity-merge-node/uml-activity-merge-node-update.tsx`):
 *
 *   - name + fill / line / text colours (the `DefaultPopup` fields), and
 *   - a "Conditions" section listing every OUTGOING control flow with an
 *     editable guard (the flow's `data.label`, which is the v3 relationship
 *     `name`) followed by "→ <target name>" (read-only, like v3).
 *
 * The section is hidden when the node has no outgoing flow (v3 rendered
 * it only for `decisions.length > 0`). Modelled on `StateMergeNodeEditPanel`.
 */
export const ActivityMergeNodeEditPanel: React.FC<PopoverProps> = ({
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
  const { t } = useTranslation()
  const node = nodes.find((n) => n.id === elementId)
  if (!node) return null

  const data = node.data as DefaultNodeProps

  const handleDataFieldUpdate = (key: string, value: string) => {
    setNodes((all) =>
      all.map((n) =>
        n.id === elementId ? { ...n, data: { ...n.data, [key]: value } } : n
      )
    )
  }

  const outgoingFlows = edges.filter((e) => e.source === elementId)

  const updateCondition = (edgeId: string, label: string) => {
    setEdges((all) =>
      all.map((e) =>
        e.id === edgeId ? { ...e, data: { ...e.data, label } } : e
      )
    )
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <NodeStyleEditor
        nodeData={data}
        handleDataFieldUpdate={handleDataFieldUpdate}
      />

      {outgoingFlows.length > 0 && (
        <>
          <DividerLine width="100%" />
          <InspectorSectionHeader>
            {t("popup.condition", "Conditions")}
          </InspectorSectionHeader>
          {outgoingFlows.map((edge) => {
            const condition =
              ((edge.data ?? {}) as { label?: string }).label ?? ""
            const target = nodes.find((n) => n.id === edge.target)
            const targetName =
              ((target?.data ?? {}) as { name?: string }).name?.trim() || "—"
            return (
              <Stack
                key={edge.id}
                direction="row"
                alignItems="center"
                spacing={0.5}
                sx={{ padding: "2px 0" }}
              >
                <MuiTextField
                  size="small"
                  variant="outlined"
                  fullWidth
                  value={condition}
                  inputProps={{
                    "aria-label": t("popup.condition", "Conditions"),
                  }}
                  onChange={(e) => updateCondition(edge.id, e.target.value)}
                />
                <Typography
                  variant="caption"
                  sx={{ minWidth: 18, textAlign: "center" }}
                >
                  {"→"}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    flex: 1,
                    minWidth: 60,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={targetName}
                >
                  {targetName}
                </Typography>
              </Stack>
            )
          })}
        </>
      )}
    </Box>
  )
}
