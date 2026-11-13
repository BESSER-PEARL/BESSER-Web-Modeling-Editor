import React from "react"
import { TextField as MUITextField, TextFieldProps } from "@mui/material"

// Our theme layer: background + input text + placeholder colors that
// track the BESSER WME CSS variables, so the field adapts to light/dark
// without any explicit mode-switching logic. Targets `.MuiInputBase-input`
// so the same rules cover `<input>` (single-line) and `<textarea>`
// (when the consumer sets `multiline`). The outline border color is
// handled globally by `.besser-editor .MuiOutlinedInput-notchedOutline`
// in `app.css` (with `!important`), so it's not duplicated here.
const besserTextFieldSx = {
  bgcolor: "var(--besser-background, white)",
  "& .MuiInputBase-input": {
    color: "var(--besser-primary-contrast, #000000)",
    caretColor: "var(--besser-primary-contrast, #000000)",
    border: "none",
  },
  "& .MuiInputBase-input::placeholder": {
    color: "var(--besser-gray-variant, #495057)",
    opacity: 0.7,
  },
} as const

export const TextField: React.FC<TextFieldProps> = ({ sx, ...props }) => {
  // Use MUI's array form so `sx` prop from the caller — which may itself be
  // an object, an array, or a theme-callback — composes cleanly without the
  // brittle object spread that would break non-object shapes.
  const composedSx = Array.isArray(sx)
    ? [besserTextFieldSx, ...sx]
    : [besserTextFieldSx, sx]
  return <MUITextField sx={composedSx} {...props} />
}
