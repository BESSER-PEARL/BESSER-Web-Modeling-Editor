import React from "react"
import { Box, Tooltip } from "@mui/material"

export interface RowColorSwatchProps {
  /** Tooltip label, e.g. `Row fill color`. */
  label: string
  /** Current color (hex) or `undefined` for the theme default. */
  value?: string
  /** CSS shown in the swatch when `value` is unset (theme variable). */
  fallbackCss: string
  /** Called with the picked hex, or `undefined` on right-click reset. */
  onChange: (color?: string) => void
}

/**
 * Per-row color swatch — an 18×18 circular
 * `label` wrapping an invisible native `<input type="color">`. Click
 * opens the OS picker, right-click resets to the theme default.
 *
 * Mirrors develop's per-member `ColorButton` + `StylePane` workflow
 * (`uml-classifier-attribute-update.tsx` / `-method-update.tsx`): each
 * attribute / method / enum-literal row carries an independent
 * `fillColor` / `textColor`. Extracted from the swatch that first
 * shipped in `UserModelNameEditPanel` so the class- and object-diagram
 * inspectors share one definition.
 */
export const RowColorSwatch: React.FC<RowColorSwatchProps> = ({
  label,
  value,
  fallbackCss,
  onChange,
}) => (
  <Tooltip title={`${label} (right-click to reset)`}>
    <Box
      component="label"
      sx={{
        width: 18,
        height: 18,
        borderRadius: "50%",
        border: "1px solid var(--besser-gray, #ccc)",
        backgroundColor: value || fallbackCss,
        cursor: "pointer",
        display: "inline-block",
        flexShrink: 0,
        overflow: "hidden",
      }}
      onContextMenu={(e: React.MouseEvent) => {
        e.preventDefault()
        onChange(undefined)
      }}
    >
      <input
        type="color"
        aria-label={label}
        value={typeof value === "string" && value ? value : "#000000"}
        onChange={(e) => onChange(e.target.value)}
        style={{
          opacity: 0,
          width: "100%",
          height: "100%",
          cursor: "pointer",
          border: "none",
          padding: 0,
        }}
      />
    </Box>
  </Tooltip>
)
