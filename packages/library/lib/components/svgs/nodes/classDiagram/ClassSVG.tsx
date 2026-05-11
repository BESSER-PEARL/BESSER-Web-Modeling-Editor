import { ClassNodeElement, ClassNodeProps, ClassType } from "@/types"
import { LAYOUT } from "@/constants"
import { SeparationLine } from "@/components/svgs/nodes/SeparationLine"
import { HeaderSection } from "../HeaderSection"
import { RowBlockSection } from "../RowBlockSection"
import { useDiagramStore } from "@/store"
import { useShallow } from "zustand/shallow"
import AssessmentIcon from "../../AssessmentIcon"
import { SVGComponentProps } from "@/types/SVG"
import { AssessmentSelectableElement } from "@/components/AssessmentSelectableElement"
import { StyledRect } from "../../StyledElements"
import { getCustomColorsFromData } from "@/utils/layoutUtils"

export interface MinSize {
  minWidth: number
  minHeight: number
}

export type ClassSVGProps = SVGComponentProps & {
  data: ClassNodeProps
}

export const ClassSVG = ({
  id,
  width,
  height,
  SIDEBAR_PREVIEW_SCALE,
  svgAttributes,
  showAssessmentResults = false,
  data,
}: ClassSVGProps) => {
  // Layout constants
  const { attributes, methods, name, stereotype, italic, underline } = data
  const showStereotype = !!stereotype
  // PC-1 fix (SA-FIX-Class): Enumeration must NOT draw a methods compartment.
  const isEnumeration = stereotype === ClassType.Enumeration
  const headerHeight = showStereotype
    ? LAYOUT.DEFAULT_HEADER_HEIGHT_WITH_STEREOTYPE
    : LAYOUT.DEFAULT_HEADER_HEIGHT
  const attributeHeight = LAYOUT.DEFAULT_ATTRIBUTE_HEIGHT
  const methodHeight = LAYOUT.DEFAULT_METHOD_HEIGHT
  const padding = LAYOUT.DEFAULT_PADDING
  // PC-1 fix: explicit italic / underline from data.
  const isItalic = italic ?? stereotype === ClassType.Abstract
  const isUnderlined = !!underline

  const assessments = useDiagramStore(useShallow((state) => state.assessments))

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

  // Palette-preview hint: when the ghost has no rows, render "+ attribute"
  // / "+ method" as muted placeholder text so the sidebar entry reads as
  // an invitation to add, not an empty box. On canvas (no
  // SIDEBAR_PREVIEW_SCALE) empty sections stay empty.
  const isPreview = !!SIDEBAR_PREVIEW_SCALE
  const showAttributeHint = isPreview && attributes.length === 0
  const showMethodHint =
    isPreview && !isEnumeration && methods.length === 0
  const hintFill =
    typeof textColor === "string"
      ? `color-mix(in srgb, ${textColor} 55%, transparent)`
      : textColor

  return (
    <svg
      width={scaledWidth}
      height={scaledHeight}
      viewBox={`0 0 ${width} ${height}`}
      overflow="visible"
      {...svgAttributes}
    >
      <AssessmentSelectableElement
        elementId={id}
        width={width}
        itemHeight={headerHeight}
        yOffset={0}
      >
        <StyledRect
          x={0}
          y={0}
          width={width}
          height={height}
          stroke={strokeColor}
        />

        {/* Header Section */}
        <HeaderSection
          showStereotype={showStereotype}
          stereotype={stereotype}
          name={name}
          width={width}
          headerHeight={headerHeight}
          isItalic={isItalic}
          isUnderlined={isUnderlined}
          textColor={textColor}
          fill={fillColor}
        />

        {/* Attributes Section */}
        {attributes.length >= 0 && (
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
            {showAttributeHint && (
              <text
                x={padding}
                y={headerHeight + 15}
                dominantBaseline="middle"
                fontStyle="italic"
                fill={hintFill}
              >
                + attribute
              </text>
            )}
          </>
        )}

        {/* Methods Section — PC-1 fix (SA-FIX-Class): skip for Enumeration;
            fix offsetFromTop to use attributeHeight (was methodHeight). */}
        {!isEnumeration && methods.length >= 0 && (
          <>
            <SeparationLine
              y={
                headerHeight +
                Math.max(attributes.length, showAttributeHint ? 1 : 0) *
                  attributeHeight
              }
              width={width}
              strokeColor={strokeColor}
            />
            <RowBlockSection
              items={processedMethods}
              padding={padding}
              itemHeight={methodHeight}
              width={width}
              offsetFromTop={
                headerHeight +
                Math.max(attributes.length, showAttributeHint ? 1 : 0) *
                  attributeHeight
              }
              showAssessmentResults={showAssessmentResults}
              itemElementType="method"
            />
            {showMethodHint && (
              <text
                x={padding}
                y={
                  headerHeight +
                  Math.max(attributes.length, showAttributeHint ? 1 : 0) *
                    attributeHeight +
                  15
                }
                dominantBaseline="middle"
                fontStyle="italic"
                fill={hintFill}
              >
                + method
              </text>
            )}
          </>
        )}

        {showAssessmentResults && (
          <AssessmentIcon score={nodeScore} x={width - 15} y={-15} />
        )}
      </AssessmentSelectableElement>
    </svg>
  )
}
