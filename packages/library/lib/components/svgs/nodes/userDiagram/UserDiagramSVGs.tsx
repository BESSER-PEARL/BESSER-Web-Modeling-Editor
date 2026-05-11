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
import { useSettingsStore } from "@/store/settingsStore"
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
  /**
   * SA-FIX-USER-ICON: per-node render mode. `"icon"` (default) renders
   * the person/class icon — mirrors the v3 preferred UserDiagram view.
   * `"attributes"` shows the underlined header + attribute table.
   */
  view?: "icon" | "attributes"
}

interface UserModelNameSVGProps extends SVGComponentProps {
  data: UserModelNameSVGData
}

/**
 * SA-FIX-USER-ICON: hardcoded fallback person SVG used when the linked
 * class has no `icon` and the node hasn't been seeded with one (e.g. an
 * `Alice : User` node where the `User` meta-class supplies its own icon
 * is preferred — this fallback fires only when nothing is available).
 *
 * Ported verbatim from the v3 user-metamodel `User` class entry at
 * `packages/editor/src/main/packages/user-modeling/usermetamodel_buml_short.json`
 * (the `fluent` person glyph).
 */
const FALLBACK_PERSON_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 20 20"><g fill="none"><path fill="url(#fluentColorPerson200)" d="M5.009 11A2 2 0 0 0 3 13c0 1.691.833 2.966 2.135 3.797C6.417 17.614 8.145 18 10 18s3.583-.386 4.865-1.203C16.167 15.967 17 14.69 17 13a2 2 0 0 0-2-2z" /><path fill="url(#fluentColorPerson201)" d="M5.009 11A2 2 0 0 0 3 13c0 1.691.833 2.966 2.135 3.797C6.417 17.614 8.145 18 10 18s3.583-.386 4.865-1.203C16.167 15.967 17 14.69 17 13a2 2 0 0 0-2-2z" /><path fill="url(#fluentColorPerson202)" d="M10 2a4 4 0 1 0 0 8a4 4 0 0 0 0-8" /><defs><linearGradient id="fluentColorPerson200" x1="6.329" x2="8.591" y1="11.931" y2="19.153" gradientUnits="userSpaceOnUse"><stop offset=".125" stop-color="#5baad0" /><stop offset="1" stop-color="#282233" /></linearGradient><linearGradient id="fluentColorPerson201" x1="10" x2="13.167" y1="10.167" y2="22" gradientUnits="userSpaceOnUse"><stop stop-color="#537fff" stop-opacity="0" /><stop offset="1" stop-color="#e362f8" /></linearGradient><linearGradient id="fluentColorPerson202" x1="7.902" x2="11.979" y1="3.063" y2="9.574" gradientUnits="userSpaceOnUse"><stop offset=".125" stop-color="#5baad0" /><stop offset="1" stop-color="#282233" /></linearGradient></defs></g></svg>`

/**
 * Resolve the SVG body to render in icon view. Preference order:
 *   1. The node's own `data.icon` (set by the inspector, migrator, or
 *      seeded by a palette drop).
 *   2. The linked meta-class's icon, looked up by `className` from the
 *      user-meta-model JSON — keeps icon parity when the user picks a
 *      class but no icon body has been frozen onto the node yet.
 *   3. The hardcoded fallback person glyph.
 */
function resolveIconBody(data: UserModelNameSVGData): string {
  const direct = typeof data.icon === "string" ? data.icon.trim() : ""
  if (direct) return data.icon as string
  if (data.className) {
    const match = getUserMetaModelClasses().find(
      (c) => c.name === data.className
    )
    if (match?.icon) return match.icon
  }
  return FALLBACK_PERSON_ICON_SVG
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
  const { name, className, attributes } = data
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

  // SA-FIX-USER-ICON: per-node `data.view` selects between the icon
  // body (default — mirrors the v3 preferred preview where a UserDiagram
  // card shows a person/class glyph) and the v3 "normal" attribute
  // table. Unset → `"icon"`. The legacy global `showIconView` toggle is
  // still read by other diagrams; on the user diagram the per-node
  // setting wins so v4-authored fixtures behave deterministically.
  // Touch the settings store once so call sites that flipped it before
  // SA-FIX-USER-ICON don't accidentally bring down the subscription.
  useSettingsStore((s) => s.showIconView)
  const view = data.view ?? "icon"
  const iconViewActive = view === "icon"
  // Header label per v3: instance name plus optional ` : className`.
  const headerLabel = className ? `${name} : ${className}` : name
  const iconBody = iconViewActive ? resolveIconBody(data) : ""

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

        {/* SA-FIX-USER-ICON: when icon view is active, drop a person /
            class glyph into the body of the node. The icon body is
            resolved from `data.icon` → linked meta-class icon →
            hardcoded fallback (see `resolveIconBody`). The v3 fork
            stored inline SVG markup, so `dangerouslySetInnerHTML` is
            still the right path. */}
        {iconViewActive && (
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
              dangerouslySetInnerHTML={{ __html: iconBody }}
            />
          </foreignObject>
        )}

        {!iconViewActive && attributes.length > 0 && (
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
 *
 * SA-FIX-USER-ICON: defaults to `view: "icon"` so the palette ghost
 * shows the person glyph (matches the v3 fork's preferred preview).
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
      view: "icon",
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
        // SA-FIX-USER-ICON: palette ghosts render the icon view so the
        // user sees the person/class glyph at drag time, matching the
        // v3 preferred preview.
        view: "icon",
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
