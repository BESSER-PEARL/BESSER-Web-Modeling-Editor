import { ClassNodeElement } from "@/types"
import { CustomText } from "./CustomText"
import { FC } from "react"
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
  return (
    <g transform={`translate(0, ${offsetFromTop})`}>
      {items.map((item, index) => {
        const y = index * itemHeight
        const iconY = y - 12
        const iconX = width - 15
        const { fillColor, textColor } = getCustomColorsFromData(item)
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
              {/* SA-FIX-CLASS-FUND #6: id / external-id markers paint
                  the row name with an underline (and italic for
                  external-id) — mirrors v3
                  `uml-classifier-member-component.tsx:91` which set
                  `textDecoration='underline'` on the SVG <text> when
                  `isId` was true. The canonical text already carries
                  `/` (derived) and `?` (optional) inline via
                  `formatDisplayName`, so those are not duplicated here. */}
              <CustomText
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
