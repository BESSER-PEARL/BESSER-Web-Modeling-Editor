import { NodeProps, NodeResizer, type Node } from "@xyflow/react"
import { useRef } from "react"
import { DefaultNodeWrapper } from "../wrappers"
import { useDiagramModifiable } from "@/hooks/useDiagramModifiable"
import { PopoverManager } from "@/components/popovers/PopoverManager"
import { NodeToolbar } from "@/components/toolbars/NodeToolbar"
import { AgentToolNodeProps } from "@/types"
import { LAYOUT } from "@/constants"
import {
  AGENT_PRIMITIVE_COLORS,
  truncatePrimitiveSubtitle,
} from "./agentPrimitiveColors"

/**
 * `AgentTool` — Python callable exposed to the reasoning LLM. Develop
 * source: `agent-state-diagram/agent-tool/agent-tool-component.tsx`.
 *
 * Silhouette: hexagon with pointed left/right edges (a "module"
 * shape), blue accent, `🔧 «tool»` stereotype, bold name, truncated
 * description subtitle.
 */
export function AgentTool({
  id,
  width,
  height,
  data,
}: NodeProps<Node<AgentToolNodeProps>>) {
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const isDiagramModifiable = useDiagramModifiable()

  if (!width || !height) return null

  const accent = data.strokeColor || AGENT_PRIMITIVE_COLORS.tool.accent
  const fill = data.fillColor || AGENT_PRIMITIVE_COLORS.tool.tint
  const textColor = data.textColor || "var(--besser-primary-contrast, #000)"
  const subtitle = truncatePrimitiveSubtitle(data.description)

  // Hexagon: pointed left/right edges (develop's "module" silhouette).
  const notch = Math.min(18, width / 6)
  const hexPath =
    `M ${notch} 0 H ${width - notch} L ${width} ${height / 2} ` +
    `L ${width - notch} ${height} H ${notch} L 0 ${height / 2} Z`

  return (
    <DefaultNodeWrapper width={width} height={height} elementId={id}>
      <NodeToolbar elementId={id} />
      <NodeResizer
        isVisible={isDiagramModifiable}
        minWidth={120}
        minHeight={70}
        handleStyle={{ width: 8, height: 8 }}
      />
      <div ref={wrapperRef}>
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          overflow="visible"
        >
          <path d={hexPath} fill={fill} stroke={accent} strokeWidth={1.5} />
          <text
            x={width / 2}
            y={24}
            textAnchor="middle"
            fontSize={LAYOUT.STEREOTYPE_LINE_HEIGHT}
            fontWeight="bold"
            fill={accent}
          >
            {`${AGENT_PRIMITIVE_COLORS.tool.icon} «tool»`}
          </text>
          <text
            x={width / 2}
            y={44}
            textAnchor="middle"
            fontSize={LAYOUT.NAME_FONT_SIZE}
            fontWeight="600"
            fill={textColor}
          >
            {data.name}
          </text>
          {subtitle ? (
            <text
              x={width / 2}
              y={height - 16}
              textAnchor="middle"
              fontSize={LAYOUT.NAME_FONT_SIZE - 2}
              fill={textColor}
            >
              {subtitle}
            </text>
          ) : null}
        </svg>
      </div>
      <PopoverManager
        anchorEl={wrapperRef.current}
        elementId={id}
        type={"AgentTool" as const}
      />
    </DefaultNodeWrapper>
  )
}
