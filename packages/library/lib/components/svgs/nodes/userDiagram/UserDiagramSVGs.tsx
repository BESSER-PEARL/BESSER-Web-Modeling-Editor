import { FC } from "react"
import { SVGComponentProps } from "@/types/SVG"
import {
  ClassNodeElement,
  UserModelAttributeRow,
} from "@/types"
import { LAYOUT } from "@/constants"
import { StyledRect } from "@/components/svgs/StyledElements"
import { SeparationLine } from "@/components/svgs/nodes/SeparationLine"
import { CustomText } from "@/components/svgs/nodes/CustomText"
import { RowBlockSection } from "@/components/svgs/nodes/RowBlockSection"
import { useDiagramStore } from "@/store"
import { useShallow } from "zustand/shallow"
import AssessmentIcon from "@/components/svgs/AssessmentIcon"
import { getCustomColorsFromData } from "@/utils"
import {
  getUserMetaModelClasses,
  type UserMetaModelClass,
} from "@/services/userMetaModel"

/**
 * SA-FIX-USER-COMPLETE — full v3-parity rewrite of the UserDiagram SVGs.
 *
 * This module owns three concerns:
 *
 *  1. `UserModelNameSVG` — the canvas-side SVG used by `UserModelName.tsx`.
 *     Renders a v3-`UMLUserModelName`-shaped node: underlined header
 *     showing `name : className`, then the attribute rows below.
 *     Visibility symbols are NOT rendered (unlike Class rows).
 *
 *  2. `UserModelIconSVG` — small icon preview (legacy palette entry).
 *
 *  3. `getUserModelNamePaletteEntries()` — the v3
 *     `composeUserModelPreview` equivalent: walks the user-meta-model
 *     JSON and emits one drag-source per Personal_Information / Skill /
 *     Education / Disability class. Each preview pre-populates the
 *     dropped node's `attributes` rows so the user lands on a wired card.
 *
 * v3 sources of truth:
 *   - `packages/editor/.../user-modeling/uml-user-model-name.ts`
 *   - `packages/editor/.../user-modeling/user-model-preview.ts`
 *   - `packages/editor/.../user-modeling/uml-user-model-icon/uml-user-model-icon.ts`
 */

interface UserModelNameSVGData {
  name: string
  className?: string
  classId?: string
  icon?: string
  fillColor?: string
  strokeColor?: string
  textColor?: string
  attributes: ClassNodeElement[]
}

interface UserModelNameSVGProps extends SVGComponentProps {
  data: UserModelNameSVGData
}

/**
 * The canvas-side SVG. Built from primitives directly (no ObjectNameSVG
 * coupling) so the user-model visual is owned by this module.
 */
export const UserModelNameSVG: FC<UserModelNameSVGProps> = ({
  id,
  width,
  height,
  data,
  SIDEBAR_PREVIEW_SCALE,
  svgAttributes,
  showAssessmentResults = false,
}) => {
  const { name, className, attributes, icon } = data
  const headerHeight = LAYOUT.DEFAULT_HEADER_HEIGHT
  const attributeHeight = LAYOUT.DEFAULT_ATTRIBUTE_HEIGHT
  const padding = LAYOUT.DEFAULT_PADDING

  const assessments = useDiagramStore(useShallow((state) => state.assessments))

  const processedAttributes = attributes.map((el) => {
    const score = (assessments as Record<string, { score?: number }>)[el.id]
      ?.score
    return { ...el, score }
  })
  const nodeScore = (assessments as Record<string, { score?: number }>)[id]
    ?.score

  const scaledWidth = width * (SIDEBAR_PREVIEW_SCALE ?? 1)
  const scaledHeight = height * (SIDEBAR_PREVIEW_SCALE ?? 1)
  const { fillColor, strokeColor, textColor } = getCustomColorsFromData(data)

  const hasIcon = typeof icon === "string" && icon.trim() !== ""

  // Header label per v3: instance name plus optional ` : className`.
  const headerLabel = className ? `${name} : ${className}` : name

  return (
    <svg
      width={scaledWidth}
      height={scaledHeight}
      viewBox={`0 0 ${width} ${height}`}
      overflow="visible"
      {...svgAttributes}
    >
      <g>
        {/* Outer rectangle. */}
        <StyledRect
          x={0}
          y={0}
          width={width}
          height={height}
          stroke={strokeColor}
        />

        {/* Header band (white fill, underlined name). v3 visual:
            `:className` rendered alongside the instance name. */}
        <rect
          x={LAYOUT.LINE_WIDTH / 2}
          y={LAYOUT.LINE_WIDTH / 2}
          width={width - LAYOUT.LINE_WIDTH}
          height={headerHeight - LAYOUT.LINE_WIDTH / 2}
          fill={fillColor}
        />
        <CustomText
          x={width / 2}
          y={headerHeight / 2}
          dominantBaseline="middle"
          textAnchor="middle"
          fontWeight="bold"
          textDecoration="underline"
          fill={textColor}
        >
          <tspan
            x={width / 2}
            dy="0"
            textDecoration="underline"
          >
            {headerLabel}
          </tspan>
        </CustomText>

        {/* If the model carries an icon body (rare; the v3 fork stored
            inline SVG markup), embed it via foreignObject instead of
            attributes. */}
        {hasIcon && (
          <foreignObject
            x={0}
            y={headerHeight + 4}
            width={width}
            height={Math.max(40, height - headerHeight - 8)}
          >
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                pointerEvents: "none",
              }}
              // Trusted authoring-time SVG markup, mirrors v3's behaviour.
              dangerouslySetInnerHTML={{ __html: icon as string }}
            />
          </foreignObject>
        )}

        {!hasIcon && attributes.length > 0 && (
          <>
            <SeparationLine
              y={headerHeight}
              width={width}
              strokeColor={strokeColor}
            />
            <RowBlockSection
              items={processedAttributes}
              padding={padding}
              itemHeight={attributeHeight}
              width={width}
              offsetFromTop={headerHeight}
              showAssessmentResults={showAssessmentResults}
              itemElementType="attribute"
            />
          </>
        )}

        {showAssessmentResults && (
          <AssessmentIcon score={nodeScore} x={width - 15} y={-15} />
        )}
      </g>
    </svg>
  )
}

/**
 * Static palette preview (kept for backward compat with code paths that
 * import `UserModelNameSVG` directly). The dynamic palette entries below
 * are the primary path; this is the fallback "Alice : User" card.
 */
export const UserModelStaticPreviewSVG: FC<SVGComponentProps> = ({
  width,
  height,
  SIDEBAR_PREVIEW_SCALE,
  svgAttributes,
}) => (
  <UserModelNameSVG
    id="__preview__"
    width={width}
    height={height}
    SIDEBAR_PREVIEW_SCALE={SIDEBAR_PREVIEW_SCALE}
    svgAttributes={svgAttributes}
    data={{
      name: "Alice",
      className: "User",
      attributes: [],
    }}
  />
)

/** Small circle icon preview (palette `UserModelIcon`). */
export const UserModelIconSVG: FC<SVGComponentProps> = ({
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
 * Build a per-class palette preview SVG. v3's
 * `composeUserModelPreview` rendered ONE drag-source per meta-model
 * class — we replicate that by stamping a `UserModelNameSVG` with the
 * class's attributes pre-populated as the row labels.
 */
function makeUserModelPaletteSVG(
  className: string,
  attrNames: string[]
): FC<SVGComponentProps> {
  const Component: FC<SVGComponentProps> = ({
    width,
    height,
    SIDEBAR_PREVIEW_SCALE,
    svgAttributes,
  }) => (
    <UserModelNameSVG
      id={`__preview_${className}__`}
      width={width}
      height={height}
      SIDEBAR_PREVIEW_SCALE={SIDEBAR_PREVIEW_SCALE}
      svgAttributes={svgAttributes}
      data={{
        name: `${className.charAt(0).toLowerCase() + className.slice(1)}_1`,
        className,
        attributes: attrNames.map((n, i) => ({
          id: `__preview_${className}_${i}__`,
          name: `${n} =`,
        })),
      }}
    />
  )
  Component.displayName = `UserModelName_${className}_SVG`
  return Component
}

/**
 * Palette entry descriptor returned by `getUserModelNamePaletteEntries`.
 */
export interface UserModelPaletteEntry {
  type: "UserModelName"
  className: string
  attributes: { id: string; name: string; attributeType: string }[]
  svg: FC<SVGComponentProps>
}

/**
 * Walk the user meta-model JSON via `getUserMetaModelClasses` and produce
 * one palette entry per meta-model class. Mirrors v3
 * `composeUserModelPreview` exactly (`Personal_Information`, `Skill`,
 * `Education`, `Disability`, ...).
 */
export function getUserModelNamePaletteEntries(): UserModelPaletteEntry[] {
  const classes: UserMetaModelClass[] = getUserMetaModelClasses()
  return classes.map((c) => ({
    type: "UserModelName" as const,
    className: c.name,
    attributes: c.attributes,
    svg: makeUserModelPaletteSVG(
      c.name,
      c.attributes.map((a) => a.name)
    ),
  }))
}

// Touch the type alias so TypeScript's noUnusedLocals doesn't flag it
// when this module is imported only for its side-effect helpers.
export type { UserModelAttributeRow }
