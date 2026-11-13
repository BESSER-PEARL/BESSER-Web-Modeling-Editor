import { Box } from "@mui/material"
import { useReactiveEdge } from "@/hooks/useReactiveElement"
import { EdgeStyleEditor, TextField } from "@/components/ui"
import { useReactFlow } from "@xyflow/react"
import { CustomEdgeProps } from "@/edges/EdgeProps"
import { SwapHorizIcon } from "@/components/Icon"
import { useEdgePopOver } from "@/hooks"
import { PopoverProps } from "../types"
import { useTranslation } from "@/i18n"

export const PetriNetEdgeEditPopover: React.FC<PopoverProps> = ({
  elementId,
}) => {
  const { t } = useTranslation()
  const { updateEdgeData } = useReactFlow()
  const edge = useReactiveEdge(elementId)

  const { handleLabelChange, handleSwap } = useEdgePopOver(elementId)

  if (!edge) {
    return null
  }

  const edgeData = edge.data as CustomEdgeProps | undefined

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <EdgeStyleEditor
        edgeData={edgeData}
        handleDataFieldUpdate={(key, value) =>
          updateEdgeData(elementId, { ...edge.data, [key]: value })
        }
        label={t("popup.petriNet.arc", "Petri Net Arc")}
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

      {/* Label update */}
      <TextField
        value={edgeData?.label ?? ""}
        onChange={(e) => {
          const value = e.target.value
          handleLabelChange(value)
        }}
        size="small"
        fullWidth
      />
    </Box>
  )
}
