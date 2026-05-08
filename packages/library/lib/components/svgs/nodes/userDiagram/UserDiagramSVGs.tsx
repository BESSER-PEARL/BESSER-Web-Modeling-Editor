import { SVGComponentProps } from "@/types/SVG"
import {
  getUserMetaModelClasses,
  type UserMetaModelClass,
} from "@/services/userMetaModel"

/**
 * SA-4 / SA-FIX-User palette previews for UserDiagram.
 *
 * v3's `composeUserModelPreview` rendered ONE drag-source per
 * meta-model class (Personal_Information, Skill, Education,
 * Disability …) by walking `getAvailableClasses()` from the bridge.
 * The previous v4 ship replaced that with a single static "Alice:
 * User" preview, which left the sidebar effectively empty for the
 * user-modelling workflow. This module restores the v3 behaviour by
 * dynamically producing one `UserModelNameSVG` per meta-model class
 * and exposing `getUserModelNamePaletteEntries()` so `constants.ts`
 * can register them all.
 */

/** Generic "name + attribute rows" preview shared by all classes. */
function makeUserModelNameSVG(
  className: string,
  attrNames: string[]
): React.FC<SVGComponentProps> {
  const HEADER = 26
  const ROW = 16
  const Component: React.FC<SVGComponentProps> = ({
    width,
    height,
    SIDEBAR_PREVIEW_SCALE,
    svgAttributes,
  }) => {
    const sw = width * (SIDEBAR_PREVIEW_SCALE ?? 1)
    const sh = height * (SIDEBAR_PREVIEW_SCALE ?? 1)
    return (
      <svg
        width={sw}
        height={sh}
        viewBox={`0 0 ${width} ${height}`}
        overflow="visible"
        {...svgAttributes}
      >
        <rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill="var(--besser-background, white)"
          stroke="var(--besser-primary-contrast, #000)"
          strokeWidth={1.5}
        />
        <text
          x={width / 2}
          y={HEADER - 8}
          textAnchor="middle"
          fontSize={12}
          fontWeight="600"
          textDecoration="underline"
          fill="var(--besser-primary-contrast, #000)"
        >
          {`: ${className}`}
        </text>
        <line
          x1={0}
          x2={width}
          y1={HEADER}
          y2={HEADER}
          stroke="var(--besser-primary-contrast, #000)"
          strokeWidth={1}
        />
        {attrNames.slice(0, 5).map((n, i) => (
          <text
            key={i}
            x={6}
            y={HEADER + ROW * (i + 1) - 4}
            fontSize={10}
            fill="var(--besser-primary-contrast, #000)"
          >
            {n}
          </text>
        ))}
      </svg>
    )
  }
  Component.displayName = `UserModelName_${className}_SVG`
  return Component
}

/**
 * Default "Alice: User" preview kept as a fallback for any code path
 * that imports `UserModelNameSVG` directly (back-compat with the
 * single-static-preview API).
 */
export const UserModelNameSVG = makeUserModelNameSVG("User", [])

export const UserModelIconSVG: React.FC<SVGComponentProps> = ({
  width,
  height,
  SIDEBAR_PREVIEW_SCALE,
  svgAttributes,
}) => {
  const sw = width * (SIDEBAR_PREVIEW_SCALE ?? 1)
  const sh = height * (SIDEBAR_PREVIEW_SCALE ?? 1)
  return (
    <svg
      width={sw}
      height={sh}
      viewBox={`0 0 ${width} ${height}`}
      overflow="visible"
      {...svgAttributes}
    >
      <circle
        cx={width / 2}
        cy={height / 2}
        r={Math.min(width, height) / 2 - 2}
        fill="var(--besser-background, white)"
        stroke="var(--besser-primary-contrast, #000)"
      />
      <text
        x={width / 2}
        y={height / 2 + 4}
        textAnchor="middle"
        fontSize={12}
        fill="var(--besser-primary-contrast, #000)"
      >
        ico
      </text>
    </svg>
  )
}

/**
 * Palette entry descriptor returned by `getUserModelNamePaletteEntries`.
 * Mirrors the shape of `DropElementConfig` (without dragging the
 * `constants.ts` import in — keeps this module a pure visual helper).
 */
export interface UserModelPaletteEntry {
  type: "UserModelName"
  className: string
  attributes: { id: string; name: string; attributeType: string }[]
  svg: React.FC<SVGComponentProps>
}

/**
 * Walk the user meta-model JSON (via `getUserMetaModelClasses`) and
 * produce one palette entry per meta-model class. The webapp / library
 * palette registry consumes this to render N drag-sources rather than
 * the single static "Alice: User" entry.
 */
export function getUserModelNamePaletteEntries(): UserModelPaletteEntry[] {
  const classes: UserMetaModelClass[] = getUserMetaModelClasses()
  return classes.map((c) => ({
    type: "UserModelName" as const,
    className: c.name,
    attributes: c.attributes,
    svg: makeUserModelNameSVG(
      c.name,
      c.attributes.map((a) => a.name)
    ),
  }))
}
