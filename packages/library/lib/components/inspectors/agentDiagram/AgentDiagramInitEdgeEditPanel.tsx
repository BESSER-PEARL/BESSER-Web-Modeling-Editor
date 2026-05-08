import { Box } from "@mui/material"
import React from "react"
import { Typography } from "@/components/ui"
import { PopoverProps } from "@/components/popovers/types"

/**
 * SA-4 inspector body for `AgentStateTransitionInit`. The init edge is a
 * pure marker — no editable fields. Render a one-line note so the
 * properties panel doesn't appear empty when the user selects it.
 */
export const AgentDiagramInitEdgeEditPanel: React.FC<PopoverProps> = () => (
  <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
    <Typography variant="caption">
      Initial-state marker. No editable fields.
    </Typography>
  </Box>
)
