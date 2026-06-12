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
import { diagramBridge } from "@/services/diagramBridge"

interface Props extends SVGComponentProps {
  data: ObjectNodeProps
}

/**
 * Resolve the canvas header label for an object instance — v3 parity
 * with `uml-object-name-component.tsx`:
 *
 *   `${element.name}${className ? ` : ${className}` : ''}`
 *
 * The class name resolves **live** from the diagram bridge (so a class
 * rename in the sibling ClassDiagram is reflected the next time the
 * object diagram renders), falling back to the cached `data.className`
 * when the bridge has no data for the linked id (e.g. standalone
 * diagrams imported without their ClassDiagram).
 */
export function resolveObjectHeaderLabel(data: {
  name: string
  classId?: string
  className?: string
}): string {
  let className: string | undefined
  if (data.classId) {
    try {
      className = diagramBridge.getClassById(data.classId)?.name
    } catch {
      className = undefined
    }
  }
  className = className ?? data.className
  return className ? `${data.name} : ${className}` : data.name
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
  const { attributes, icon, stereotype } = data
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

  // `showInstancedObjects` is a *palette composition*
  // toggle in v3 (`object-preview.ts` gates which cards the sidebar
  // composes) — it never hides rows on an already-rendered card.
  // The palette gate now lives in `objectDiagramPalette.ts`
  // (`getObjectDiagramPaletteEntries`), restoring the setting's
  // original meaning; attribute rows render whenever present. Object
  // instances never render a methods section — UML object diagrams
  // show data values, not types.
  const showAttributes = attributes.length > 0

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

        {/* Header Section - Object name with underline, shown as
            `name : ClassName` when the instance links a class (v3
            `uml-object-name-component.tsx` displayLabel). Stereotype
            band renders only when `data.stereotype` is set. The
            HeaderSection prop expects ClassType, but v3 stored arbitrary
            string stereotypes on object instances — cast through. */}
        <HeaderSection
          showStereotype={hasStereotype}
          stereotype={hasStereotype ? (stereotype as unknown as ClassType) : undefined}
          name={resolveObjectHeaderLabel(data)}
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
