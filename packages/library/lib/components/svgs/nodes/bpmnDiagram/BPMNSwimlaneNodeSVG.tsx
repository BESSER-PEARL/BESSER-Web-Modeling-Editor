import { CustomText, StyledRect } from "@/components"
import { useDiagramStore } from "@/store"
import { SVGComponentProps } from "@/types/SVG"
import { useShallow } from "zustand/shallow"
import AssessmentIcon from "../../AssessmentIcon"
import { BPMNSwimlaneProps } from "@/types"
import { getCustomColorsFromData } from "@/utils"

interface BPMNSwimlaneNodeSVGProps extends SVGComponentProps {
  data: BPMNSwimlaneProps
}

/**
 * Swimlane (a pool subdivision). A plain rect plus the lane name drawn
 * vertically along the left edge, ported from develop's
 * bpmn-swimlane-component.tsx (rotated Multiline: `transform="rotate(270)"`,
 * `x={-(height / 2)}`, `y={20}`, centered). Single rotated line — not the
 * generic multiline wrap machinery.
 */
export const BPMNSwimlaneNodeSVG: React.FC<BPMNSwimlaneNodeSVGProps> = ({
  width,
  height,
  data,
  svgAttributes,
  SIDEBAR_PREVIEW_SCALE,
  id,
  showAssessmentResults = false,
}) => {
  const { name } = data
  const assessments = useDiagramStore(useShallow((state) => state.assessments))
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
      <StyledRect
        x={0}
        y={0}
        width={width}
        height={height}
        fill={fillColor}
        stroke={strokeColor}
      />
      <CustomText
        x={-(height / 2)}
        y={20}
        transform="rotate(270)"
        textAnchor="middle"
        fill={textColor}
      >
        {name}
      </CustomText>

      {showAssessmentResults && (
        <AssessmentIcon x={width - 15} y={-15} score={nodeScore} />
      )}
    </svg>
  )
}
