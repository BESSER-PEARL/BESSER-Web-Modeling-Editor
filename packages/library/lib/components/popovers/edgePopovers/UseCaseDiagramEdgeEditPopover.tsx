import { Box, FormControl, Select, MenuItem, InputLabel } from "@mui/material"
import { useReactiveEdge, useReactiveNode } from "@/hooks/useReactiveElement"
import { EdgeStyleEditor, TextField, Typography } from "@/components/ui"
import { SwapHorizIcon } from "@/components/Icon"
import { useReactFlow } from "@xyflow/react"
import { CustomEdgeProps } from "@/edges/EdgeProps"
import { useEdgePopOver } from "@/hooks"
import { PopoverProps } from "../types"
import { useTranslation } from "@/i18n"

export const UseCaseEdgeEditPopover: React.FC<PopoverProps> = ({
  elementId,
}) => {
  const { t } = useTranslation()
  const { updateEdgeData } = useReactFlow()

  const edge = useReactiveEdge(elementId)
  const sourceNode = useReactiveNode(edge?.source)
  const targetNode = useReactiveNode(edge?.target)
  const { handleEdgeTypeChange, handleLabelChange, handleSwap } =
    useEdgePopOver(elementId)

  if (!edge) {
    return null
  }

  const edgeData = edge.data as CustomEdgeProps | undefined
  const sourceName =
    (sourceNode?.data?.name as string) ?? t("common.source", "Source")
  const targetName =
    (targetNode?.data?.name as string) ?? t("common.target", "Target")

  const useCaseEdgeTypeOptions = [
    {
      value: "UseCaseAssociation",
      label: t("packages.UseCaseDiagram.UseCaseAssociation", "Association"),
    },
    {
      value: "UseCaseInclude",
      label: t("packages.UseCaseDiagram.UseCaseInclude", "Include"),
    },
    {
      value: "UseCaseExtend",
      label: t("packages.UseCaseDiagram.UseCaseExtend", "Extend"),
    },
    {
      value: "UseCaseGeneralization",
      label: t(
        "packages.UseCaseDiagram.UseCaseGeneralization",
        "Generalization"
      ),
    },
  ]

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <EdgeStyleEditor
        edgeData={edgeData}
        handleDataFieldUpdate={(key, value) =>
          updateEdgeData(elementId, { ...edge.data, [key]: value })
        }
        label={t("common.edgeType", "Edge Type")}
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
          {useCaseEdgeTypeOptions.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Connection info */}
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        {sourceName} → {targetName}
      </Typography>

      {/* Show label input only for associations */}
      {edge.type === "UseCaseAssociation" && (
        <TextField
          label={t("common.edgeLabel", "Edge Label")}
          value={edgeData?.label ?? ""}
          onChange={(e) => handleLabelChange(e.target.value)}
          size="small"
          fullWidth
          placeholder={t(
            "popup.useCase.optionalAssociationLabel",
            "Optional label for association"
          )}
        />
      )}
    </Box>
  )
}
