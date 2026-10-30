import { CustomText, StyledRect } from "@/components"
import { useDiagramStore } from "@/store"
import { SVGComponentProps } from "@/types/SVG"
import { useShallow } from "zustand/shallow"
import AssessmentIcon from "../../AssessmentIcon"
import { BPMNSwimlaneProps } from "@/types"
import { getCustomColorsFromData } from "@/utils"
import { LAYOUT } from "@/constants"
import { AGENTIC_LANE_HEADER_WIDTH, LANE_HEADER_WIDTH } from "@/utils/bpmnConstraints"
import { AgenticBotIcon } from "@/components/svgs/icons/agentic"
import {
  displayLaneCopies,
  displayTrustScore,
  migrateLegacyRole,
} from "@/types/bpmnAgentic"
// The agentic markers stack centred in the column between the two widths.
// Their text uses the name size: develop's 9-11px attributes were overridden
// to 16px by its canvas stylesheet, which is what users saw.
const MARKER_X = (LANE_HEADER_WIDTH + AGENTIC_LANE_HEADER_WIDTH) / 2
const BOT_ICON_HALF_WIDTH = 9
const ROLE_BADGE: Record<string, string> = { solution: "S", supervision: "Sv" }

/** Badge text for a lane role: the preset abbreviations, else its first two letters. */
export const laneRoleBadge = (role: unknown): string => {
  const migrated = migrateLegacyRole(role)
  return ROLE_BADGE[migrated] ?? migrated.slice(0, 2).toUpperCase()
}

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
  const { name, isAgentic } = data
  const multiplicity = displayLaneCopies(data.multiplicity)
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

      {/* Agentic: bot, role badge, trust score and (when > 1) copies stack
          right of the rotated name. */}
      {isAgentic && (
        <g data-testid="agentic-lane-markers">
          <AgenticBotIcon
            x={MARKER_X - BOT_ICON_HALF_WIDTH}
            y={height / 2 - 23}
            color={strokeColor}
          />
          <CustomText
            x={MARKER_X}
            y={height / 2 + 8}
            dominantBaseline="auto"
            fontSize={LAYOUT.NAME_FONT_SIZE}
            fontWeight="bold"
            fill={textColor}
          >
            {laneRoleBadge(data.role)}
          </CustomText>
          <CustomText
            x={MARKER_X}
            y={height / 2 + 23}
            dominantBaseline="auto"
            fontSize={LAYOUT.NAME_FONT_SIZE}
            fill={textColor}
          >
            {displayTrustScore(data.trustScore)}
          </CustomText>
          {multiplicity > 1 && (
            <CustomText
              x={MARKER_X}
              y={height / 2 + 38}
              dominantBaseline="auto"
              fontSize={LAYOUT.NAME_FONT_SIZE}
              fontWeight="bold"
              fill={textColor}
            >
              {`×${multiplicity}`}
            </CustomText>
          )}
        </g>
      )}

      {showAssessmentResults && (
        <AssessmentIcon x={width - 15} y={-15} score={nodeScore} />
      )}
    </svg>
  )
}
