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
import { formatDisplayName } from "@/utils/classifierMemberDisplay"
import { useClassNotation } from "@/store/settingsStore"

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
  // Enumeration must NOT draw a methods compartment.
  const isEnumeration = stereotype === ClassType.Enumeration
  // ER (Chen) mode hides the methods compartment for entity-capable
  // classifiers — plain Class and Abstract. Interfaces define operations
  // (their whole purpose) and Enumerations are already handled above, so
  // both are excluded from this rule. Mirrors v3
  // `uml-classifier-component.tsx` ER_CAPABLE_CLASSIFIER_TYPES.
  const classNotation = useClassNotation()
  const isERHidesMethods =
    classNotation === "ER" &&
    stereotype !== ClassType.Interface &&
    stereotype !== ClassType.Enumeration
  const headerHeight = showStereotype
    ? LAYOUT.DEFAULT_HEADER_HEIGHT_WITH_STEREOTYPE
    : LAYOUT.DEFAULT_HEADER_HEIGHT
  const attributeHeight = LAYOUT.DEFAULT_ATTRIBUTE_HEIGHT
  const methodHeight = LAYOUT.DEFAULT_METHOD_HEIGHT
  const padding = LAYOUT.DEFAULT_PADDING
  // Explicit italic / underline from data.
  const isItalic = italic ?? stereotype === ClassType.Abstract
  const isUnderlined = !!underline

  const assessments = useDiagramStore(useShallow((state) => state.assessments))

  // Format a row's display name using the canonical UML formatter when the
  // row carries structured BESSER fields (`attributeType`, `visibility`, …).
  // This is what makes the palette sidebar preview render rows like
  // `+ name: str` (matching v3) instead of just the raw `name`. The canvas
  // node renderer (`nodes/classDiagram/Class.tsx`) pre-formats rows before
  // they hit this SVG; `formatDisplayName` is idempotent (its strip-prefix
  // / strip-suffix logic detects and removes legacy formatting), so the
  // canvas flow stays correct even when this re-formats already-formatted
  // rows. Enumeration literals are force-formatted (bare name) regardless
  // of structured fields.
  const isEnumerationStereotype = stereotype === ClassType.Enumeration
  const formatRowName = (row: ClassNodeElement): ClassNodeElement => {
    const hasStructuredFields =
      row.attributeType !== undefined ||
      row.visibility !== undefined ||
      row.isOptional !== undefined ||
      row.isDerived !== undefined ||
      row.isId !== undefined ||
      row.isExternalId !== undefined ||
      row.defaultValue !== undefined
    if (!hasStructuredFields && !isEnumerationStereotype) return row
    // Palette sidebar previews always render in UML mode so the visibility
    // symbol (`+`/`-`/`#`/`~`) is visible on the drag source regardless of
    // the user's live ER/UML toggle. The toggle is a canvas-only rendering
    // setting; previews are a static reference of what a node looks like.
    const isPalettePreview = SIDEBAR_PREVIEW_SCALE !== undefined
    const formatted = formatDisplayName(
      {
        name: row.name,
        attributeType: row.attributeType,
        visibility: row.visibility,
        isOptional: row.isOptional,
        isDerived: row.isDerived,
        isId: row.isId,
        isExternalId: row.isExternalId,
        defaultValue: row.defaultValue,
      },
      isPalettePreview ? "UML" : classNotation,
      stereotype ?? undefined
    )
    return { ...row, name: formatted }
  }

  const processElements = (elements: ClassNodeElement[]) =>
    elements.map((el) => {
      const score = assessments[el.id]?.score
      return { ...formatRowName(el), score }
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
          </>
        )}

        {/* Methods Section fix: skip for Enumeration;
            fix offsetFromTop to use attributeHeight (was methodHeight).
            ER mode also hides the methods compartment for entity-capable
            classifiers (Class / Abstract) — ER notation has no concept of
            operations on entities. Mirrors v3 `uml-classifier-component.tsx`
            ER branch. */}
        {!isEnumeration && !isERHidesMethods && methods.length >= 0 && (
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
              offsetFromTop={headerHeight + attributes.length * attributeHeight}
              showAssessmentResults={showAssessmentResults}
              itemElementType="method"
            />
          </>
        )}

        {showAssessmentResults && (
          <AssessmentIcon score={nodeScore} x={width - 15} y={-15} />
        )}
      </AssessmentSelectableElement>
    </svg>
  )
}
