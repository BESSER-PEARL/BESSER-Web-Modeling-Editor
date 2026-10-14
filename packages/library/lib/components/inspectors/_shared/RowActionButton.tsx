import React from "react"
import { Tooltip } from "@mui/material"

export interface RowActionButtonProps {
  /** Tooltip text; also the accessible name unless `ariaLabel` is given. */
  label: string
  ariaLabel?: string
  onClick: () => void
  /** Red hover for destructive actions. */
  danger?: boolean
  /** For disclosure toggles: rendered as `aria-expanded`. */
  expanded?: boolean
  disabled?: boolean
  children: React.ReactNode
}

/**
 * Compact (24px) icon button for inspector row actions. Rows reveal their
 * actions on hover / focus-within (`.bp-member__actions`), so every action
 * stays reachable by keyboard.
 */
export const RowActionButton: React.FC<RowActionButtonProps> = ({
  label,
  ariaLabel,
  onClick,
  danger = false,
  expanded,
  disabled = false,
  children,
}) => (
  // `describeChild` keeps the tooltip as a description, so the button's
  // own aria-label stays the single accessible name.
  <Tooltip title={label} enterDelay={400} disableInteractive describeChild>
    <span style={{ display: "inline-flex" }}>
      <button
        type="button"
        className={`bp-icon-btn bp-icon-btn--sm${danger ? " bp-icon-btn--danger" : ""}`}
        aria-label={ariaLabel ?? label}
        aria-expanded={expanded}
        disabled={disabled}
        onClick={onClick}
      >
        {children}
      </button>
    </span>
  </Tooltip>
)
