import React from "react"
import { Button, ButtonProps } from "@mui/material"

interface AddRowButtonProps extends Omit<ButtonProps, "onClick" | "children"> {
  onClick: () => void
  /** Short verb / target. Rendered as `+ {label}`. Defaults to `add`. */
  label?: string
}

/**
 * SA-FINAL-3 #11 — uniform `+ add` affordance used by every inspector
 * panel that needs to grow a list.
 *
 * Replaces the inconsistent mix of `IconButton`, free-form text link,
 * and `<Button variant="text">+ add</Button>` previously coexisting
 * across inspector bodies.
 *
 * Visual: thin MUI text-link button (`size="small"`, `variant="text"`),
 * primary-themed via the BESSER CSS variable.
 */
export const AddRowButton: React.FC<AddRowButtonProps> = ({
  onClick,
  label = "add",
  sx,
  ...rest
}) => {
  return (
    <Button
      size="small"
      variant="text"
      onClick={onClick}
      {...rest}
      sx={{
        minWidth: 0,
        padding: "0 6px",
        textTransform: "none",
        color: "var(--besser-primary, #3e8acc)",
        ...sx,
      }}
    >
      + {label}
    </Button>
  )
}
