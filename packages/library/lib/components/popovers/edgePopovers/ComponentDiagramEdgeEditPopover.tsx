import { Box, FormControl, Select, MenuItem, InputLabel } from "@mui/material"
import { useReactiveEdge, useReactiveNode } from "@/hooks/useReactiveElement"
import { EdgeStyleEditor, Typography } from "@/components/ui"
import { useReactFlow } from "@xyflow/react"
import { SwapHorizIcon } from "@/components/Icon"
import { useEdgePopOver } from "@/hooks"
import { PopoverProps } from "../types"
import { CustomEdgeProps } from "@/edges"
import { useTranslation } from "@/i18n"

export const ComponentEdgeEditPopover: React.FC<PopoverProps> = ({
  elementId,
}) => {
  const { t } = useTranslation()
  const { updateEdgeData } = useReactFlow()

  const edge = useReactiveEdge(elementId)
  const sourceNode = useReactiveNode(edge?.source)
  const targetNode = useReactiveNode(edge?.target)
  const { handleEdgeTypeChange, handleSwap } = useEdgePopOver(elementId)

  if (!edge) {
    return null
  }
  const sourceName =
    (sourceNode?.data?.name as string) ?? t("common.source", "Source")
  const targetName =
    (targetNode?.data?.name as string) ?? t("common.target", "Target")

  const componentEdgeTypeOptions = [
    {
      value: "ComponentDependency",
      label: t("packages.ComponentDiagram.ComponentDependency", "Dependency"),
    },
    {
      value: "ComponentProvidedInterface",
      label: t(
        "packages.ComponentDiagram.ComponentInterfaceProvided",
        "Provided Interface"
      ),
    },
    {
      value: "ComponentRequiredInterface",
      label: t(
        "packages.ComponentDiagram.ComponentInterfaceRequired",
        "Required Interface"
      ),
    },
  ]

  const edgeData = edge.data as CustomEdgeProps | undefined

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <EdgeStyleEditor
        edgeData={edgeData}
        handleDataFieldUpdate={(key, value) =>
          updateEdgeData(elementId, { ...edge.data, [key]: value })
        }
        label={t("popup.association", "Association")}
        sideElements={[
          handleSwap && (
            <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
              <SwapHorizIcon
                style={{ cursor: "pointer" }}
                onClick={handleSwap}
              />
            </Box>
          ),
        ]}
      />

      <FormControl fullWidth size="small">
        <InputLabel id="edge-type-label">
          {t("common.edgeType", "Edge Type")}
        </InputLabel>
        <Select
          labelId="edge-type-label"
          id="edge-type-select"
          value={edge.type}
          label={t("common.edgeType", "Edge Type")}
          onChange={(e) => handleEdgeTypeChange(e.target.value)}
        >
          {componentEdgeTypeOptions.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        {sourceName} → {targetName}
      </Typography>
    </Box>
  )
}
