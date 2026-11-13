import {
  Box,
  Checkbox,
  FormControl,
  FormControlLabel,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
} from "@mui/material"
import { useReactiveEdge, useReactiveNode } from "@/hooks/useReactiveElement"
import { EdgeStyleEditor, TextField, Typography } from "@/components/ui"
import { useReactFlow } from "@xyflow/react"
import { CustomEdgeProps } from "@/edges/EdgeProps"
import { SwapHorizIcon } from "@/components/Icon"
import { useEdgePopOver } from "@/hooks"
import { PopoverProps } from "../types"
import { useTranslation } from "@/i18n"
import {
  AssociationEnd,
  applyAssociationTypeChange,
  applyNavigabilityToggle,
  canToggleNavigability,
  normalizeAssociationType,
  resolveAssociationNavigability,
  supportsNavigability,
} from "@/utils/uml-association-navigability"

export const EdgeEditPopover: React.FC<PopoverProps> = ({ elementId }) => {
  const { updateEdgeData, updateEdge } = useReactFlow()
  const { t } = useTranslation()

  const edge = useReactiveEdge(elementId)
  const sourceNode = useReactiveNode(edge?.source)
  const targetNode = useReactiveNode(edge?.target)
  const {
    handleSourceRoleChange,
    handleSourceMultiplicityChange,
    handleTargetRoleChange,
    handleTargetMultiplicityChange,
    handleSwap,
  } = useEdgePopOver(elementId)

  if (!edge) {
    return null
  }

  const edgeData = edge.data as CustomEdgeProps | undefined
  const sourceName = (sourceNode?.data?.name as string) ?? t("common.source", "Source")
  const targetName = (targetNode?.data?.name as string) ?? t("common.target", "Target")

  // Only the edge kinds with a BUML metamodel equivalent are pickable.
  // A plain association is always `ClassBidirectional`; one-way navigation
  // is set with the per-end "navigable" checkboxes (smart-gen bb8624cc), so
  // the legacy `ClassUnidirectional` is shown as Association.
  const getEdgeTypeOptions = () => {
    return [
      {
        value: "ClassBidirectional",
        label: t("packages.ClassDiagram.ClassBidirectional", "Association"),
      },
      {
        value: "ClassComposition",
        label: t("packages.ClassDiagram.ClassComposition", "Composition"),
      },
      { value: "ClassInheritance", label: t("popup.class.inheritance", "Inheritance") },
    ]
  }

  const edgeTypeOptions = getEdgeTypeOptions()
  const currentType = normalizeAssociationType(edge.type) ?? "ClassBidirectional"
  const showsNavigability = supportsNavigability(edge.type)
  const navigability = resolveAssociationNavigability(edge)

  // The type and both navigability flags are written in one update, so a
  // change is a single undo step and never breaks the rules.
  const handleEdgeTypeChange = (newType: string) => {
    const next = applyAssociationTypeChange(edge, newType)
    updateEdge(elementId, { type: next.type, data: next.data })
  }

  const handleToggleNavigable = (end: AssociationEnd, checked: boolean) => {
    const next = applyNavigabilityToggle(edge, end, checked)
    if (next !== edge) updateEdge(elementId, { type: next.type, data: next.data })
  }

  const navigableInfoText = (end: AssociationEnd): string => {
    if (edge.type === "ClassComposition" && end === "source") {
      return t(
        "popup.navigableCompositionHint",
        "The composite can always navigate to its parts"
      )
    }
    if (!canToggleNavigability(edge, end)) {
      return t(
        "popup.navigableDisabledHint",
        "At least one end of an association must be navigable"
      )
    }
    return t("popup.navigableInfo", "At least one end must be navigable")
  }

  const renderNavigable = (end: AssociationEnd) =>
    showsNavigability && (
      <Tooltip title={navigableInfoText(end)}>
        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={navigability[end]}
              disabled={!canToggleNavigability(edge, end)}
              onChange={(e) => handleToggleNavigable(end, e.target.checked)}
            />
          }
          label={t("popup.navigable", "Navigable")}
        />
      </Tooltip>
    )

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
          value={currentType}
          label={t("common.edgeType", "Edge Type")}
          onChange={(e) => handleEdgeTypeChange(e.target.value)}
        >
          {edgeTypeOptions.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
          {!edgeTypeOptions.some((o) => o.value === currentType) && (
            <MenuItem value={currentType}>
              {t(`packages.ClassDiagram.${currentType}`, currentType)}
            </MenuItem>
          )}
        </Select>
      </FormControl>

      {
        <>
          {/* Source subheadline */}
          <Typography variant="subtitle1" sx={{ fontWeight: "bold" }}>
            {sourceName}
          </Typography>

          {/* Source Multiplicity */}
          <TextField
            label={t("popup.class.endMultiplicity", "{{name}} Multiplicity", {
              name: sourceName,
            })}
            value={edgeData?.sourceMultiplicity ?? ""}
            onChange={(e) => handleSourceMultiplicityChange(e.target.value)}
            size="small"
            fullWidth
          />

          {/* Source Role */}
          <TextField
            label={t("popup.class.endRole", "{{name}} Role", {
              name: sourceName,
            })}
            value={edgeData?.sourceRole ?? ""}
            onChange={(e) => handleSourceRoleChange(e.target.value)}
            size="small"
            fullWidth
          />
          {renderNavigable("source")}

          {/* Target subheadline */}
          <Typography variant="subtitle1" sx={{ fontWeight: "bold" }}>
            {targetName}
          </Typography>

          {/* Target Multiplicity */}
          <TextField
            label={t("popup.class.endMultiplicity", "{{name}} Multiplicity", {
              name: targetName,
            })}
            value={edgeData?.targetMultiplicity ?? ""}
            onChange={(e) => handleTargetMultiplicityChange(e.target.value)}
            size="small"
            fullWidth
          />

          {/* Target Role */}
          <TextField
            label={t("popup.class.endRole", "{{name}} Role", {
              name: targetName,
            })}
            value={edgeData?.targetRole ?? ""}
            onChange={(e) => handleTargetRoleChange(e.target.value)}
            size="small"
            fullWidth
          />
          {renderNavigable("target")}
        </>
      }
    </Box>
  )
}
