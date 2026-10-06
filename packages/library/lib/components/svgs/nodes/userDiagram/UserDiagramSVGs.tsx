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
import { useSettingsStore } from "@/store/settingsStore"
import AssessmentIcon from "@/components/svgs/AssessmentIcon"
import { getCustomColorsFromData } from "@/utils"
import {
  getUserMetaModelClasses,
  type UserMetaModelClass,
} from "@/services/userMetaModel"
import { diagramBridge } from "@/services/diagramBridge"

/**
 * Full v3-parity rewrite of the UserDiagram SVGs.
 *
 * This module owns three concerns:
 *
 *  1. `UserModelNameSVG` — the canvas-side SVG used by `UserModelName.tsx`.
 *     Renders a v3-`UMLUserModelName`-shaped node: underlined header
 *     showing the resolved linked-class name (see
 *     `resolveUserModelHeaderLabel`), then the attribute rows below.
 *     Visibility symbols are NOT rendered (unlike Class rows). Like v3
 *     `UMLUserModelName.render`, the icon view is used only when the
 *     global `showIconView` setting is on AND an icon body is available;
 *     otherwise the attribute table is shown.
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
 *   - `v3 source: user-modeling/uml-user-model-name.ts`
 *   - `v3 source: user-modeling/user-model-preview.ts`
 *   - `v3 source: user-modeling/uml-user-model-icon/uml-user-model-icon.ts`
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
  /** Legacy per-node mode; ignored — the global `showIconView` decides. */
  view?: "icon" | "attributes"
}

interface UserModelNameSVGProps extends SVGComponentProps {
  data: UserModelNameSVGData
}

/**
 * Resolve the SVG body for icon view: the node's own `data.icon`, else the
 * linked meta-class's icon (palette previews). `undefined` when neither
 * exists — v3 then fell back to the attribute table.
 */
export function resolveUserModelIconBody(data: {
  icon?: string
  className?: string
}): string | undefined {
  if (typeof data.icon === "string" && data.icon.trim() !== "") return data.icon
  if (data.className) {
    const match = getUserMetaModelClasses().find(
      (c) => c.name === data.className
    )
    if (match?.icon && match.icon.trim() !== "") return match.icon
  }
  return undefined
}

/**
 * Resolve the canvas header label for a `UserModelName` node — v3
 * parity with `uml-object-name-component.tsx`'s `isUserModelElement`
 * branch: `className || element.className || element.name`.
 *
 * Unlike `resolveObjectHeaderLabel` (plain ObjectName instances render
 * `alice : Person`), a UserModelName header shows ONLY the resolved
 * class label — the instance name is the last-resort fallback, not a
 * prefix. The class name resolves live from the diagram bridge (so a
 * class rename in the sibling ClassDiagram is reflected on next
 * render), falling back to the cached `data.className`, then `data.name`.
 */
export function resolveUserModelHeaderLabel(data: {
  name: string
  classId?: string
  className?: string
}): string {
  let resolvedClassName: string | undefined
  if (data.classId) {
    try {
      resolvedClassName = diagramBridge.getClassById(data.classId)?.name
    } catch {
      resolvedClassName = undefined
    }
  }
  return resolvedClassName || data.className || data.name
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
  const { attributes } = data
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

  // v3 parity (`UMLUserModelName.render`): icon view only when the global
  // setting is on and an icon body exists; otherwise the attribute table.
  const showIconView = useSettingsStore((s) => s.showIconView)
  const iconBody = resolveUserModelIconBody(data)
  const iconViewActive = showIconView && iconBody !== undefined
  // v3 parity: header shows the resolved class name, not the instance
  // name — see `resolveUserModelHeaderLabel`.
  const headerLabel = resolveUserModelHeaderLabel(data)

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

        {/* Header band (white fill, underlined resolved class name — see
            `resolveUserModelHeaderLabel`). */}
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

        {/* When icon view is active, drop a person /
            class glyph into the body of the node. The icon body is
            resolved from `data.icon` → linked meta-class icon (see
            `resolveUserModelIconBody`). The v3 fork
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
              // Scale child SVG to fit the foreignObject bounds — the
              // raw markup carries fixed `width="96" height="96"`, which
              // cropped against smaller node bounds before this rule.
              ref={(node) => {
                if (!node) return
                const inner = node.querySelector("svg")
                if (!inner) return
                inner.setAttribute("width", "100%")
                inner.setAttribute("height", "100%")
                inner.setAttribute("preserveAspectRatio", "xMidYMid meet")
                inner.style.maxWidth = "100%"
                inner.style.maxHeight = "100%"
              }}
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
  /**
   * Meta-model class node id (stable — baked into `usermetamodel.json`).
   * Dropped nodes carry it as `data.classId` so
   * `diagramBridge.getAvailableAssociations(classId)` resolves — v3's
   * per-metaclass palette instances carried the same binding.
   */
  classId: string
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
    classId: c.id,
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
