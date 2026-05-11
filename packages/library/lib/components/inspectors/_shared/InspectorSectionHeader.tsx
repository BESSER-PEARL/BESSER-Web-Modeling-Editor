import React from "react"
import { Typography as MUITypography, TypographyProps } from "@mui/material"

/**
 * Uniform section header used by every inspector body.
 *
 * Mirrors the v3 `SectionHeader` styled-component at
 * `packages/editor/src/main/packages/common/uml-classifier/uml-classifier-update.tsx:56-62`:
 *
 *   - 11px font size
 *   - uppercase
 *   - opacity 0.6
 *   - letter-spacing 0.5px
 *
 * Replaces the inconsistent drift of `Typography variant="h6"`,
 * `subtitle2`, and `caption` previously used across inspector panels.
 */
export const InspectorSectionHeader: React.FC<TypographyProps> = ({
  sx,
  children,
  ...rest
}) => {
  return (
    <MUITypography
      component="div"
      {...rest}
      sx={{
        fontSize: "11px",
        textTransform: "uppercase",
        opacity: 0.6,
        letterSpacing: "0.5px",
        color: "var(--besser-primary-contrast, #000000)",
        ...sx,
      }}
    >
      {children}
    </MUITypography>
  )
}
