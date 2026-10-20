import { FC, useId } from "react"
import { iconImageHref, iconUsesCurrentColor } from "@/utils/iconImage"

interface Props {
  icon: string
  x: number
  y: number
  width: number
  height: number
  /** Paint for `currentColor` icons (a theme token works, unlike in an image). */
  color: string
}

/**
 * Renders a model's icon as an image, never as markup (see `iconImageHref`).
 * A `currentColor` icon becomes an alpha mask over a rect in `color`, so it
 * still follows the theme.
 */
export const IconImage: FC<Props> = ({ icon, x, y, width, height, color }) => {
  const maskId = `besser-icon-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`
  const image = (
    <image
      href={iconImageHref(icon)}
      x={x}
      y={y}
      width={width}
      height={height}
      preserveAspectRatio="xMidYMid meet"
    />
  )
  if (!iconUsesCurrentColor(icon)) return <g pointerEvents="none">{image}</g>
  return (
    <g pointerEvents="none">
      <mask id={maskId} style={{ maskType: "alpha" }}>
        {image}
      </mask>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={color}
        mask={`url(#${maskId})`}
      />
    </g>
  )
}
