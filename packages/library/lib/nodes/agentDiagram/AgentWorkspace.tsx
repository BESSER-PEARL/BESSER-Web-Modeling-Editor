import { NodeProps, NodeResizer, type Node } from "@xyflow/react"
import { useRef } from "react"
import { DefaultNodeWrapper } from "../wrappers"
import { useDiagramModifiable } from "@/hooks/useDiagramModifiable"
import { PopoverManager } from "@/components/popovers/PopoverManager"
import { NodeToolbar } from "@/components/toolbars/NodeToolbar"
import { AgentWorkspaceNodeProps } from "@/types"
import {
  AGENT_PRIMITIVE_COLORS,
  truncatePrimitiveSubtitle,
} from "./agentPrimitiveColors"
import { AgentBadge, AgentNodeCard } from "./AgentNodeCard"

/**
 * `AgentWorkspace` — filesystem root the reasoning LLM may browse. Rendered
 * as an amber `📁 «workspace»` flow card with the path as the subtitle and
 * a read-only / read-write badge in the header.
 */
export function AgentWorkspace({
  id,
  width,
  height,
  data,
}: NodeProps<Node<AgentWorkspaceNodeProps>>) {
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const isDiagramModifiable = useDiagramModifiable()

  if (!width || !height) return null

  const accent = data.strokeColor || AGENT_PRIMITIVE_COLORS.workspace.accent
  const subtitle = truncatePrimitiveSubtitle(data.path || data.description)
  const writable = data.writable !== false

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
          icon={<AGENT_PRIMITIVE_COLORS.workspace.Icon size={15} />}
          typeLabel="workspace"
          name={data.name}
          surface={data.fillColor || undefined}
          textColor={data.textColor || undefined}
          headerRight={
            <AgentBadge accent={accent}>{writable ? "rw" : "ro"}</AgentBadge>
          }
        >
          {subtitle ? (
            <div
              title={subtitle}
              style={{
                fontSize: 12,
                fontFamily: "monospace",
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
        type={"AgentWorkspace" as const}
      />
    </DefaultNodeWrapper>
  )
}
