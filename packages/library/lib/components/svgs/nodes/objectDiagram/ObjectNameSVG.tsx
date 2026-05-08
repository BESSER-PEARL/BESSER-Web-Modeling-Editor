import { ClassNodeElement, ObjectNodeProps } from "@/types"
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
  const { name, attributes, methods, icon } = data
  const headerHeight = LAYOUT.DEFAULT_HEADER_HEIGHT
  const attributeHeight = LAYOUT.DEFAULT_ATTRIBUTE_HEIGHT
  const methodHeight = LAYOUT.DEFAULT_METHOD_HEIGHT
  const padding = LAYOUT.DEFAULT_PADDING

  const assessments = useDiagramStore(useShallow((state) => state.assessments))

  // SA-2.1: respect the global icon-view toggle (settingsService key
  // `showIconView`). When enabled and the node has a stored icon body,
  // we render an icon view (header + inline SVG) instead of the
  // attributes / methods table — mirrors v3
  // `uml-object-name.ts:146-204`.
  const showIconView = useSettingsStore((s) => s.showIconView)
  const hasIcon = typeof icon === "string" && icon.trim() !== ""
  const iconViewActive = showIconView && hasIcon

  const processElements = (elements: ClassNodeElement[]) =>
    elements.map((el) => {
      const score = assessments[el.id]?.score
      return { ...el, score }
    })

  const processedAttributes = processElements(attributes)
  const processedMethods = processElements(methods)
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

        {/* Header Section - Object name with underline */}
        <HeaderSection
          showStereotype={false}
          stereotype={undefined}
          name={name}
          width={width}
          headerHeight={headerHeight}
          isUnderlined={true}
          fill={fillColor}
          textColor={textColor}
        />

        {/* SA-2.1: icon view replaces attributes/methods sections. The
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

        {/* Attributes Section */}
        {!iconViewActive && attributes.length > 0 && (
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

        {/* Methods Section */}
        {!iconViewActive && methods.length > 0 && (
          <>
            <SeparationLine
              y={headerHeight + attributes.length * attributeHeight}
              width={width}
              strokeColor={strokeColor}
            />
            <RowBlockSection
              items={processedMethods}
              padding={padding}
              itemHeight={methodHeight}
              width={width}
              offsetFromTop={headerHeight + attributes.length * methodHeight}
              showAssessmentResults={showAssessmentResults}
              itemElementType="method"
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
