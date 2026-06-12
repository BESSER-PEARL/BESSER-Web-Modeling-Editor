import { NodeProps, NodeResizer, type Node } from "@xyflow/react"
import { useRef } from "react"
import { DefaultNodeWrapper } from "../wrappers"
import { useDiagramModifiable } from "@/hooks/useDiagramModifiable"
import { PopoverManager } from "@/components/popovers/PopoverManager"
import { NodeToolbar } from "@/components/toolbars/NodeToolbar"
import { AgentSkillNodeProps } from "@/types"
import { LAYOUT } from "@/constants"
import {
  AGENT_PRIMITIVE_COLORS,
  truncatePrimitiveSubtitle,
} from "./agentPrimitiveColors"

/**
 * `AgentSkill` — markdown playbook the reasoning LLM can load. Develop
 * source: `agent-state-diagram/agent-skill/agent-skill-component.tsx`.
 *
 * Silhouette: card with a folded top-right corner (a "note" shape),
 * green accent, `💡 «skill»` stereotype, bold name, truncated
 * description (falling back to content) subtitle.
 */
export function AgentSkill({
  id,
  width,
  height,
  data,
}: NodeProps<Node<AgentSkillNodeProps>>) {
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const isDiagramModifiable = useDiagramModifiable()

  if (!width || !height) return null

  const accent = data.strokeColor || AGENT_PRIMITIVE_COLORS.skill.accent
  const fill = data.fillColor || AGENT_PRIMITIVE_COLORS.skill.tint
  const textColor = data.textColor || "var(--besser-primary-contrast, #000)"
  const subtitle = truncatePrimitiveSubtitle(data.description || data.content)

  // Card with a folded top-right corner (develop's "note" silhouette).
  const fold = Math.min(16, width / 6)
  const cardPath = `M 0 0 H ${width - fold} L ${width} ${fold} V ${height} H 0 Z`
  const foldPath = `M ${width - fold} 0 L ${width} ${fold} L ${width - fold} ${fold} Z`

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
          <path d={cardPath} fill={fill} stroke={accent} strokeWidth={1.5} />
          <path
            d={foldPath}
            fill={accent}
            fillOpacity={0.45}
            stroke={accent}
            strokeWidth={1}
          />
          <text
            x={width / 2}
            y={24}
            textAnchor="middle"
            fontSize={LAYOUT.STEREOTYPE_LINE_HEIGHT}
            fontWeight="bold"
            fill={accent}
          >
            {`${AGENT_PRIMITIVE_COLORS.skill.icon} «skill»`}
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
        type={"AgentSkill" as const}
      />
    </DefaultNodeWrapper>
  )
}
