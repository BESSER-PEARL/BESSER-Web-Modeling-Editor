import { ClassNodeElement, ClassType, ObjectNodeProps } from "@/types"
import { LAYOUT } from "@/constants"
import { SeparationLine } from "@/components/svgs/nodes/SeparationLine"
import { HeaderSection } from "../HeaderSection"
import { RowBlockSection } from "../RowBlockSection"
import { useDiagramStore } from "@/store"
import { useSettingsStore } from "@/store/settingsStore"
import { useShallow } from "zustand/shallow"
import AssessmentIcon from "../../AssessmentIcon"
import { SVGComponentProps } from "@/types/SVG"
import { StyledRect } from "@/components"
import { getCustomColorsFromData } from "@/utils"

interface Props extends SVGComponentProps {
  data: ObjectNodeProps
}

export const ObjectNameSVG = ({
  id,
  width,
  height,
  data,
  SIDEBAR_PREVIEW_SCALE,
  svgAttributes,
  showAssessmentResults = false,
}: Props) => {
  const { name, attributes, icon, stereotype } = data
  // V3 ObjectName extends UMLClassifier and renders a
  // `«stereotype»` band above the underlined name when set (see
  // `uml-object-name-component.tsx:104-120`). Falsy => no band.
  const hasStereotype = !!stereotype
  const headerHeight = hasStereotype
    ? LAYOUT.DEFAULT_HEADER_HEIGHT_WITH_STEREOTYPE
    : LAYOUT.DEFAULT_HEADER_HEIGHT
  const attributeHeight = LAYOUT.DEFAULT_ATTRIBUTE_HEIGHT
  const padding = LAYOUT.DEFAULT_PADDING

  const assessments = useDiagramStore(useShallow((state) => state.assessments))

  // Respect the global icon-view toggle (settingsService key
  // `showIconView`). When enabled and the node has a stored icon body,
  // we render an icon view (header + inline SVG) instead of the
  // attributes table — mirrors v3 `uml-object-name.ts:146-204`.
  const showIconView = useSettingsStore((s) => s.showIconView)
  const hasIcon = typeof icon === "string" && icon.trim() !== ""
  const iconViewActive = showIconView && hasIcon

  // Wire `showInstancedObjects` — v3's "preview
  // instances" toggle. When the setting is off we suppress the
  // attribute rows so the node renders as just the name band. The
  // header (with the underlined object name) is always kept so the
  // object remains identifiable on the canvas; turning the toggle off
  // collapses the body, mirroring the v3 instance-preview behaviour.
  // Object instances never render a methods
  // section — UML object diagrams show data values, not types.
  // `showInstancedObjects` is a *palette-preview only*
  // toggle in v3. On the actual canvas, attributes are always shown
  // when present. Detect palette context via `SIDEBAR_PREVIEW_SCALE`,
  // which is only set by the sidebar/preview wrappers.
  const showInstancedObjects = useSettingsStore(
    (s) => s.showInstancedObjects
  )
  const isPalettePreview = SIDEBAR_PREVIEW_SCALE !== undefined
  const showAttributes =
    attributes.length > 0 && (!isPalettePreview || showInstancedObjects)

  const processElements = (elements: ClassNodeElement[]) =>
    elements.map((el) => {
      const score = assessments[el.id]?.score
      return { ...el, score }
    })

  const processedAttributes = processElements(attributes)
  const nodeScore = assessments[id]?.score

  const scaledWidth = width * (SIDEBAR_PREVIEW_SCALE ?? 1)
  const scaledHeight = height * (SIDEBAR_PREVIEW_SCALE ?? 1)
  const { fillColor, strokeColor, textColor } = getCustomColorsFromData(data)

  return (
    <svg
      width={scaledWidth}
      height={scaledHeight}
      viewBox={`0 0 ${width} ${height}`}
      overflow="visible"
      {...svgAttributes}
    >
      <g>
        {/* Outer Rectangle */}
        <StyledRect
          x={0}
          y={0}
          width={width}
          height={height}
          stroke={strokeColor}
        />

        {/* Header Section - Object name with underline. Stereotype band
            renders only when `data.stereotype` is set. The
            HeaderSection prop expects ClassType, but v3 stored arbitrary
            string stereotypes on object instances — cast through. */}
        <HeaderSection
          showStereotype={hasStereotype}
          stereotype={hasStereotype ? (stereotype as unknown as ClassType) : undefined}
          name={name}
          width={width}
          headerHeight={headerHeight}
          isUnderlined={true}
          fill={fillColor}
          textColor={textColor}
        />

        {/* Icon view replaces attributes/methods sections. The
            stored `icon` is an SVG markup string from the v3 fork — we
            embed it via foreignObject so embedded styles / namespaces
            survive. */}
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
              // Icon SVG body from v3 (e.g., `<svg>…</svg>`); rendered
              // inline. Trusted authoring-time input — same trust model
              // as v3, which used the string verbatim.
              dangerouslySetInnerHTML={{ __html: icon as string }}
            />
          </foreignObject>
        )}

        {/* Attributes Section. object instances
            don't render methods — UML object diagrams show data
            values, not types. */}
        {!iconViewActive && showAttributes && (
          <>
            {/* Separation Line After Header */}
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
