import { ClassNodeElement } from "@/types"
import { CustomText } from "./CustomText"
import { FC, useId } from "react"
import AssessmentIcon from "../AssessmentIcon"
import { FeedbackDropzone } from "@/components/wrapper/FeedbackDropzone"
import { AssessmentSelectableElement } from "@/components/AssessmentSelectableElement"
import { getCustomColorsFromData } from "@/utils"
import { LAYOUT } from "@/constants"

interface RowBlockSectionProps {
  items: (ClassNodeElement & { score?: number })[]
  padding: number
  itemHeight: number
  width: number
  offsetFromTop: number
  showAssessmentResults?: boolean
  itemElementType?: string
}
export const RowBlockSection: FC<RowBlockSectionProps> = ({
  items,
  padding,
  itemHeight,
  offsetFromTop,
  width,
  showAssessmentResults = false,
  itemElementType,
}) => {
  // Per-row clip base. Each attribute/method row clips its text to the
  // row's box bounds so a long `name = value` (or `+ name: LongType`)
  // truncates at the node's right edge instead of spilling OUTSIDE the
  // node — the root <svg> uses overflow="visible" (for resize handles),
  // so without this the label escapes the box, most visibly in the
  // fixed-size sidebar palette preview. Mirrors the header clip in
  // `HeaderSection.tsx`. The clip geometry is in the same translated
  // user space as the text, so it scales with `SIDEBAR_PREVIEW_SCALE`
  // in the preview render path too. SVG ids must not contain the colons
  // React's useId emits.
  const clipBaseId = `row-clip-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`
  return (
    <g transform={`translate(0, ${offsetFromTop})`}>
      {items.map((item, index) => {
        const y = index * itemHeight
        const iconY = y - 12
        const iconX = width - 15
        const { fillColor, textColor } = getCustomColorsFromData(item)
        const rowClipId = `${clipBaseId}-${index}`
        // Reserve room on the right for the per-row assessment badge so a
        // long label doesn't run under it; otherwise clip to the full
        // inner box width.
        const rightReserve =
          showAssessmentResults && typeof item.score === "number" ? 20 : 0
        return (
          <AssessmentSelectableElement
            key={item.id}
            elementId={item.id}
            width={width}
            itemHeight={itemHeight}
            yOffset={y}
          >
            <FeedbackDropzone elementId={item.id} elementType={itemElementType}>
              <rect
                x={LAYOUT.LINE_WIDTH / 2}
                y={y + LAYOUT.LINE_WIDTH / 2}
                width={width - LAYOUT.LINE_WIDTH}
                height={itemHeight - LAYOUT.LINE_WIDTH}
                fill={fillColor}
              />
              <clipPath id={rowClipId}>
                <rect
                  x={LAYOUT.LINE_WIDTH / 2}
                  y={y + LAYOUT.LINE_WIDTH / 2}
                  width={Math.max(0, width - LAYOUT.LINE_WIDTH - rightReserve)}
                  height={itemHeight - LAYOUT.LINE_WIDTH}
                />
              </clipPath>
              {/* Id / external-id markers paint
                  the row name with an underline (and italic for
                  external-id) — mirrors v3
                  `uml-classifier-member-component.tsx:91` which set
                  `textDecoration='underline'` on the SVG <text> when
                  `isId` was true. The canonical text already carries
                  `/` (derived) and `?` (optional) inline via
                  `formatDisplayName`, so those are not duplicated here. */}
              <CustomText
                clipPath={`url(#${rowClipId})`}
                x={padding}
                y={15 + index * itemHeight}
                dominantBaseline="middle"
                textAnchor="start"
                fill={textColor}
                textDecoration={
                  item.isId || item.isExternalId ? "underline" : undefined
                }
                fontStyle={item.isExternalId ? "italic" : undefined}
              >
                {item.name}
              </CustomText>
            </FeedbackDropzone>
            {showAssessmentResults && typeof item.score === "number" && (
              <AssessmentIcon score={item.score} x={iconX} y={iconY} />
            )}
          </AssessmentSelectableElement>
        )
      })}
    </g>
  )
}
