import { MultilineText, StyledRect } from "@/components"
import { maxLinesForHeight } from "@/utils/svgTextLayout"
import { LAYOUT } from "@/constants"
import { useDiagramStore } from "@/store"
import { SVGComponentProps } from "@/types/SVG"
import { useShallow } from "zustand/shallow"
import AssessmentIcon from "../../AssessmentIcon"
import { getCustomColorsFromData } from "@/utils/layoutUtils"
import { DefaultNodeProps } from "@/types/nodes/NodeProps"

interface BPMNSubprocessNodeSVGProps extends SVGComponentProps {
  // Shared by Subprocess / Transaction (carry `isExpanded`) and Call
  // Activity (carries `calledElement`); the component only reads `name`
  // and narrows `isExpanded` off `data`, so the base shape is enough.
  data: DefaultNodeProps
  variant?: "subprocess" | "transaction" | "call"
}
export const BPMNSubprocessNodeSVG: React.FC<BPMNSubprocessNodeSVGProps> = ({
  width,
  height,
  data,
  svgAttributes,
  SIDEBAR_PREVIEW_SCALE,
  id,
  showAssessmentResults = false,
  variant = "subprocess",
}) => {
  const { name } = data
  const assessments = useDiagramStore(useShallow((state) => state.assessments))
  const nodeScore = assessments[id]?.score
  const scaledWidth = width * (SIDEBAR_PREVIEW_SCALE ?? 1)
  const scaledHeight = height * (SIDEBAR_PREVIEW_SCALE ?? 1)
  const isTransaction = variant === "transaction"
  const isCall = variant === "call"
  const isSubprocess = !isTransaction && !isCall
  // Subprocess & Transaction carry a collapse/expand marker; CallActivity
  // does not. When expanded, the [+] marker becomes a [−] (vertical bar
  // dropped) and the name top-anchors, mirroring develop's
  // `nameY = element.isExpanded ? 20 : height / 2`.
  const showCollapseMarker = isSubprocess || isTransaction
  const isExpanded = (data as { isExpanded?: boolean }).isExpanded ?? false

  const { fillColor, strokeColor, textColor } = getCustomColorsFromData(data)
  return (
    <svg
      width={scaledWidth}
      height={scaledHeight}
      viewBox={`0 0 ${width} ${height}`}
      overflow="visible"
      {...svgAttributes}
    >
      {/* Transaction: double border */}
      {isTransaction && (
        <>
          <StyledRect
            x={0}
            y={0}
            width={width}
            height={height}
            rx={10}
            ry={10}
            fill={fillColor}
            stroke={strokeColor}
          />
          <StyledRect
            x={3}
            y={3}
            width={width - 6}
            height={height - 6}
            rx={7}
            ry={7}
            fill="none"
            stroke={strokeColor}
          />
        </>
      )}
      {/* Call Activity: single thick border */}
      {isCall && (
        <StyledRect
          x={0}
          y={0}
          width={width}
          height={height}
          strokeWidth={LAYOUT.LINE_WIDTH * 3}
          rx={10}
          ry={10}
          fill={fillColor}
          stroke={strokeColor}
        />
      )}
      {/* Subprocess: single border */}
      {isSubprocess && (
        <StyledRect
          x={0}
          y={0}
          width={width}
          height={height}
          rx={10}
          ry={10}
          fill={fillColor}
          stroke={strokeColor}
        />
      )}
      {/* Collapse/expand marker (Subprocess & Transaction). Horizontal
          bar always drawn; vertical bar only when collapsed → [+] vs [−]. */}
      {showCollapseMarker && (
        <>
          <rect
            x={width / 2 - 7}
            y={height - 14}
            width={14}
            height={14}
            fill="none"
            stroke={strokeColor}
            strokeWidth={LAYOUT.LINE_WIDTH}
          />
          <line
            x1={width / 2 - 4}
            y1={height - 7}
            x2={width / 2 + 4}
            y2={height - 7}
            stroke={strokeColor}
            strokeWidth={LAYOUT.LINE_WIDTH}
          />
          {!isExpanded && (
            <line
              x1={width / 2}
              y1={height - 11}
              x2={width / 2}
              y2={height - 3}
              stroke={strokeColor}
              strokeWidth={LAYOUT.LINE_WIDTH}
            />
          )}
        </>
      )}
      <MultilineText
        text={name}
        x={width / 2}
        y={isExpanded ? 20 : height / 2}
        verticalAnchor={isExpanded ? "top" : "middle"}
        maxWidth={width - 16}
        fontSize={LAYOUT.NAME_FONT_SIZE}
        fontWeight="bold"
        fill={textColor}
        maxLines={maxLinesForHeight(
          height - (showCollapseMarker ? 28 : 16),
          LAYOUT.NAME_LINE_HEIGHT
        )}
      />

      {showAssessmentResults && (
        <AssessmentIcon x={width - 15} y={-15} score={nodeScore} />
      )}
    </svg>
  )
}
