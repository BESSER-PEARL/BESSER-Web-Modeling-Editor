import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react"
import { Tooltip } from "@mui/material"
import { ThemeProvider } from "@mui/material/styles"
import { inspectorTheme } from "@/styles/inspector-theme"
import { keyboardButtonProps } from "./keyboardActivation"

interface ToolbarButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible name and tooltip text. */
  label: string
  danger?: boolean
  children: ReactNode
}

/**
 * 28px icon button for the floating node / edge toolbars (styles in
 * app.css, `.besser-toolbar-button`). Tooltip uses the inspector theme so
 * it matches the properties pane.
 */
export const ToolbarButton = forwardRef<HTMLButtonElement, ToolbarButtonProps>(
  ({ label, danger = false, children, className, style, ...rest }, ref) => (
    <ThemeProvider theme={inspectorTheme}>
      <Tooltip title={label} enterDelay={400} disableInteractive placement="top">
        <button
          ref={ref}
          type="button"
          {...keyboardButtonProps(label)}
          {...rest}
          className={`besser-toolbar-button${danger ? " besser-toolbar-button--danger" : ""}${
            className ? ` ${className}` : ""
          }`}
          // The toolbar box is pointer-transparent; the button captures.
          style={{ pointerEvents: "auto", ...style }}
        >
          {children}
        </button>
      </Tooltip>
    </ThemeProvider>
  )
)
ToolbarButton.displayName = "ToolbarButton"
