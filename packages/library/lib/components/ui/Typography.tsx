import React from "react"
import { Typography as MUITypography, TypographyProps } from "@mui/material"

// forwardRef so MUI `Tooltip` (which needs a ref on its child) can anchor to it.
export const Typography = React.forwardRef<HTMLElement, TypographyProps>(
  ({ sx, ...props }, ref) => {
    return (
      <MUITypography
        ref={ref}
        sx={{ ...sx, color: "var(--besser-primary-contrast, #000000)" }}
        {...props}
      />
    )
  }
)
Typography.displayName = "Typography"
