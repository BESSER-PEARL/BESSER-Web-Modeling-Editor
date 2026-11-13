import React from "react"
import { Typography as MUITypography, TypographyProps } from "@mui/material"

/**
 * Uniform section header used by every inspector body: 12px, semibold,
 * muted, sentence case — the same voice as the webapp sidebar's group
 * titles. Styling lives in `.bp-section-title` (app.css) so the header
 * follows the panel tokens in light and dark mode.
 */
export const InspectorSectionHeader: React.FC<TypographyProps> = ({
  className,
  children,
  ...rest
}) => {
  return (
    <MUITypography
      component="div"
      {...rest}
      className={["bp-section-title", className].filter(Boolean).join(" ")}
    >
      {children}
    </MUITypography>
  )
}
