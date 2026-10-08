import { Box, FormControl, Select, MenuItem, InputLabel } from "@mui/material"
import { useReactiveEdge, useReactiveNode } from "@/hooks/useReactiveElement"
import { EdgeStyleEditor, TextField, Typography } from "@/components/ui"
import { SwapHorizIcon } from "@/components/Icon"
import { useReactFlow } from "@xyflow/react"
import { CustomEdgeProps } from "@/edges/EdgeProps"
import { useEdgePopOver } from "@/hooks"
import { PopoverProps } from "../types"
import { useTranslation } from "@/i18n"
import { useDiagramStore } from "@/store/context"
import { LineageSourceLink } from "@/components/inspectors/shared"

export const DeploymentEdgeEditPopover: React.FC<PopoverProps> = ({
  elementId,
}) => {
  const { t } = useTranslation()
  const { updateEdgeData } = useReactFlow()

  const edge = useReactiveEdge(elementId)
  const sourceNode = useReactiveNode(edge?.source)
  const targetNode = useReactiveNode(edge?.target)
  const { handleEdgeTypeChange, handleLabelChange, handleSwap } =
    useEdgePopOver(elementId)
  const setEdges = useDiagramStore((state) => state.setEdges)

  if (!edge) {
    return null
  }

  const edgeData = edge.data as CustomEdgeProps | undefined
  const sourceName =
    (sourceNode?.data?.name as string) ?? t("common.source", "Source")
  const targetName =
    (targetNode?.data?.name as string) ?? t("common.target", "Target")

  const deploymentEdgeTypeOptions = [
    {
      value: "DeploymentAssociation",
      label: t(
        "packages.DeploymentDiagram.DeploymentAssociation",
        "Deployment Association"
      ),
    },
    {
      value: "DeploymentDependency",
      label: t(
        "packages.DeploymentDiagram.DeploymentDependency",
        "Deployment Dependency"
      ),
    },
    {
      value: "DeploymentProvidedInterface",
      label: t(
        "packages.DeploymentDiagram.DeploymentInterfaceProvided",
        "Provided Interface"
      ),
    },
    {
      value: "DeploymentRequiredInterface",
      label: t(
        "packages.DeploymentDiagram.DeploymentInterfaceRequired",
        "Required Interface"
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
            <Box key="swap" sx={{ display: "flex", justifyContent: "flex-end" }}>
              <SwapHorizIcon
                style={{ cursor: "pointer" }}
                onClick={handleSwap}
              />
            </Box>
          ),
        ]}
      />
      {/* Edge type selection */}
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
          {deploymentEdgeTypeOptions.map((option) => (
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

      {/* Label and stereotype belong to associations only */}
      {edge.type === "DeploymentAssociation" && (
        <>
          <TextField
            label={t("popup.label", "Label")}
            value={edgeData?.label ?? ""}
            onChange={(e) => handleLabelChange(e.target.value)}
            size="small"
            fullWidth
            placeholder={t(
              "packages.DeploymentDiagram.DeploymentAssociationLabelPlaceholder",
              "e.g. kv-store-conn"
            )}
          />
          <TextField
            label={t("popup.stereotype", "Stereotype")}
            value={edgeData?.stereotype ?? ""}
            onChange={(e) => {
              const stereotype = e.target.value
              setEdges((edges) =>
                edges.map((edge) =>
                  edge.id === elementId
                    ? { ...edge, data: { ...edge.data, stereotype } }
                    : edge
                )
              )
            }}
            size="small"
            fullWidth
            placeholder={t(
              "packages.DeploymentDiagram.DeploymentAssociationStereotypePlaceholder",
              "e.g. HTTPS, gRPC, device"
            )}
          />
        </>
      )}
      <LineageSourceLink elementId={elementId} />
    </Box>
  )
}
