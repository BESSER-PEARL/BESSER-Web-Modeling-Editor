import React from "react"
import { useAssessmentSelectionStore } from "@/store"
import { useShallow } from "zustand/shallow"
import { Box, Chip } from "@mui/material"
import { Typography } from "@/components/ui"

/**
 * Debug component to show currently selected elements in assessment mode
 * This can be useful for testing and demonstration purposes
 */
export const AssessmentSelectionDebug: React.FC = () => {
  const {
    selectedElementIds,
    highlightedElementId,
    isAssessmentSelectionMode,
  } = useAssessmentSelectionStore(
    useShallow((state) => ({
      selectedElementIds: state.selectedElementIds,
      highlightedElementId: state.highlightedElementId,
      isAssessmentSelectionMode: state.isAssessmentSelectionMode,
    }))
  )

  if (!isAssessmentSelectionMode) {
    return null
  }

  const selectedArray = Array.from(selectedElementIds)

  return (
    <Box
      sx={{
        position: "fixed",
        top: 10,
        right: 10,
        backgroundColor: "white",
        border: "1px solid #ccc",
        borderRadius: 2,
        padding: 2,
        minWidth: 200,
        maxWidth: 300,
        zIndex: 1000,
        boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
      }}
    >
      <Typography variant="h6" gutterBottom>
        Assessment Selection Debug
      </Typography>

      <Typography variant="subtitle2" gutterBottom>
        Mode: {isAssessmentSelectionMode ? "Active" : "Inactive"}
      </Typography>

      <Typography variant="subtitle2" gutterBottom>
        Highlighted: {highlightedElementId || "None"}
      </Typography>

      <Typography variant="subtitle2" gutterBottom>
        Selected ({selectedArray.length}):
      </Typography>

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
        {selectedArray.length === 0 ? (
          <Typography variant="body2" color="textSecondary">
            No elements selected
          </Typography>
        ) : (
          selectedArray.map((id) => (
            <Chip
              key={id}
              label={id.substring(0, 8) + "..."}
              size="small"
              variant="outlined"
              color="primary"
            />
          ))
        )}
      </Box>
    </Box>
  )
}
