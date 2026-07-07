import { NodeProps, NodeResizer, type Node } from "@xyflow/react"
import { useRef } from "react"
import { DefaultNodeWrapper } from "../wrappers"
import { useDiagramModifiable } from "@/hooks/useDiagramModifiable"
import { PopoverManager } from "@/components/popovers/PopoverManager"
import { NodeToolbar } from "@/components/toolbars/NodeToolbar"
import { AgentToolNodeProps } from "@/types"
import {
  AGENT_PRIMITIVE_COLORS,
  truncatePrimitiveSubtitle,
} from "./agentPrimitiveColors"
import { AgentNodeCard } from "./AgentNodeCard"

/**
 * `AgentTool` — Python callable exposed to the reasoning LLM. Rendered as
 * a blue `🔧 «tool»` flow card with its description as the subtitle.
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
  const subtitle = truncatePrimitiveSubtitle(data.description)

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
          icon={<AGENT_PRIMITIVE_COLORS.tool.Icon size={15} />}
          typeLabel="tool"
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
        type={"AgentTool" as const}
      />
    </DefaultNodeWrapper>
  )
}
