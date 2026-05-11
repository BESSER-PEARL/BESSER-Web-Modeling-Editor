import { Background, BackgroundVariant } from "@xyflow/react"

/**
 * Canvas background pattern, matching the v3 fork:
 *   - 10 px minor grid rendered as DOTS (radial gradient in v3).
 *   - 50 px major grid rendered as LINES (linear gradient in v3).
 * Colors mirror v3's `theme.color.gridMinor` (0.2 alpha dots) and
 * `theme.color.grid` (0.08 alpha lines).
 */
export const CustomBackground = () => {
  return (
    <>
      <Background
        id="1"
        gap={10}
        size={1}
        color="var(--besser-grid-minor, rgba(0, 0, 0, 0.2))"
        variant={BackgroundVariant.Dots}
      />

      <Background
        id="2"
        gap={50}
        color="var(--besser-grid, rgba(0, 0, 0, 0.08))"
        variant={BackgroundVariant.Lines}
      />
    </>
  )
}
