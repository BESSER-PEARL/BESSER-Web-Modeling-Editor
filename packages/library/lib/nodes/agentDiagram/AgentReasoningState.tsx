import { NodeProps, NodeResizer, type Node } from "@xyflow/react"
import { useRef } from "react"
import { DefaultNodeWrapper } from "../wrappers"
import { useDiagramModifiable } from "@/hooks/useDiagramModifiable"
import { PopoverManager } from "@/components/popovers/PopoverManager"
import { NodeToolbar } from "@/components/toolbars/NodeToolbar"
import { AgentReasoningStateNodeProps } from "@/types"
import { LAYOUT } from "@/constants"
import { getCustomColorsFromData } from "@/utils/layoutUtils"
import { AGENT_PRIMITIVE_COLORS } from "./agentPrimitiveColors"

/**
 * `AgentReasoningState` — autonomous reasoning-loop state. Develop
 * source: `agent-state-diagram/agent-reasoning-state/
 * agent-reasoning-state-component.tsx`.
 *
 * Silhouette: rounded rectangle with a purple accent border, a
 * `▷ «reasoning»` stereotype line over the bold state name, an accent
 * divider under the 50px header, and the resolved LLM label
 * (`LLM: <name>` / `LLM: (use default)`) in the body.
 */
const HEADER_HEIGHT = 50

export function AgentReasoningState({
  id,
  width,
  height,
  data,
}: NodeProps<Node<AgentReasoningStateNodeProps>>) {
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const isDiagramModifiable = useDiagramModifiable()

  if (!width || !height) return null

  const { fillColor, textColor } = getCustomColorsFromData(data)
  const accent = data.strokeColor || AGENT_PRIMITIVE_COLORS.reasoning.accent
  const llmLabel = data.llm_name ? `LLM: ${data.llm_name}` : "LLM: (use default)"
  const cornerRadius = 8

  return (
    <DefaultNodeWrapper width={width} height={height} elementId={id}>
      <NodeToolbar elementId={id} />
      <NodeResizer
        isVisible={isDiagramModifiable}
        minWidth={120}
        minHeight={80}
        handleStyle={{ width: 8, height: 8 }}
      />
      <div ref={wrapperRef}>
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          overflow="visible"
        >
          <rect
            x={0}
            y={0}
            width={width}
            height={height}
            rx={cornerRadius}
            ry={cornerRadius}
            fill={fillColor}
            stroke={accent}
            strokeWidth={LAYOUT.LINE_WIDTH}
          />
          <text
            x={width / 2}
            y={20}
            textAnchor="middle"
            fontSize={LAYOUT.STEREOTYPE_LINE_HEIGHT}
            fontWeight="bold"
            fill={accent}
          >
            {"▷ «reasoning»"}
          </text>
          <text
            x={width / 2}
            y={40}
            textAnchor="middle"
            fontSize={LAYOUT.NAME_FONT_SIZE}
            fontWeight="600"
            fill={textColor}
          >
            {data.name}
          </text>
          <line
            x1={0}
            x2={width}
            y1={HEADER_HEIGHT}
            y2={HEADER_HEIGHT}
            stroke={accent}
            strokeWidth={1}
          />
          <text
            x={width / 2}
            y={HEADER_HEIGHT + 19}
            textAnchor="middle"
            fontSize={LAYOUT.NAME_FONT_SIZE - 2}
            fill={textColor}
          >
            {llmLabel}
          </text>
        </svg>
      </div>
      <PopoverManager
        anchorEl={wrapperRef.current}
        elementId={id}
        type={"AgentReasoningState" as const}
      />
    </DefaultNodeWrapper>
  )
}
