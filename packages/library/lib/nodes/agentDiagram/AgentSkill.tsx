import { NodeProps, NodeResizer, type Node } from "@xyflow/react"
import { useRef } from "react"
import { DefaultNodeWrapper } from "../wrappers"
import { useDiagramModifiable } from "@/hooks/useDiagramModifiable"
import { PopoverManager } from "@/components/popovers/PopoverManager"
import { NodeToolbar } from "@/components/toolbars/NodeToolbar"
import { AgentSkillNodeProps } from "@/types"
import {
  AGENT_PRIMITIVE_COLORS,
  truncatePrimitiveSubtitle,
} from "./agentPrimitiveColors"
import { AgentNodeCard } from "./AgentNodeCard"

/**
 * `AgentSkill` — markdown playbook the reasoning LLM can load. Rendered as
 * a green `💡 «skill»` flow card with its description (falling back to the
 * markdown content) as the subtitle.
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
  const subtitle = truncatePrimitiveSubtitle(data.description || data.content)

  return (
    <DefaultNodeWrapper width={width} height={height} elementId={id}>
      <NodeToolbar elementId={id} />
      <NodeResizer
        isVisible={isDiagramModifiable}
        minWidth={140}
        minHeight={64}
        handleStyle={{ width: 8, height: 8 }}
      />
      <div ref={wrapperRef}>
        <AgentNodeCard
          width={width}
          height={height}
          accent={accent}
          icon={<AGENT_PRIMITIVE_COLORS.skill.Icon size={15} />}
          typeLabel="skill"
          name={data.name}
          surface={data.fillColor || undefined}
          textColor={data.textColor || undefined}
        >
          {subtitle ? (
            <div
              title={subtitle}
              style={{
                fontSize: 12,
                color: "var(--besser-gray-variant, #64748b)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {subtitle}
            </div>
          ) : undefined}
        </AgentNodeCard>
      </div>
      <PopoverManager
        anchorEl={wrapperRef.current}
        elementId={id}
        type={"AgentSkill" as const}
      />
    </DefaultNodeWrapper>
  )
}
