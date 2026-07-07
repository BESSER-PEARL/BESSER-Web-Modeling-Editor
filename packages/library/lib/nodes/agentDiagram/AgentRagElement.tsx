import { NodeProps, NodeResizer, type Node } from "@xyflow/react"
import { useRef } from "react"
import { DefaultNodeWrapper } from "../wrappers"
import { useDiagramModifiable } from "@/hooks/useDiagramModifiable"
import { PopoverManager } from "@/components/popovers/PopoverManager"
import { NodeToolbar } from "@/components/toolbars/NodeToolbar"
import { AgentRagElementNodeProps } from "@/types"
import { AGENT_PRIMITIVE_COLORS } from "./agentPrimitiveColors"
import { AgentBadge, AgentNodeCard, AgentPill } from "./AgentNodeCard"

/**
 * `AgentRagElement` — retrieval-augmented knowledge source. Rendered as a
 * teal `📚 «rag»` flow card with the retrieval depth (`k`) as a header
 * badge and the resolved LLM as a body pill.
 */
export function AgentRagElement({
  id,
  width,
  height,
  data,
}: NodeProps<Node<AgentRagElementNodeProps>>) {
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const isDiagramModifiable = useDiagramModifiable()

  if (!width || !height) return null

  const accent = data.strokeColor || AGENT_PRIMITIVE_COLORS.rag.accent
  const llmLabel = data.llm_name ? data.llm_name : "default"

  return (
    <DefaultNodeWrapper width={width} height={height} elementId={id}>
      <NodeToolbar elementId={id} />
      <NodeResizer
        isVisible={isDiagramModifiable}
        minWidth={130}
        minHeight={64}
        handleStyle={{ width: 8, height: 8 }}
      />
      <div ref={wrapperRef}>
        <AgentNodeCard
          width={width}
          height={height}
          accent={accent}
          icon={<AGENT_PRIMITIVE_COLORS.rag.Icon size={15} />}
          typeLabel="rag"
          name={data.name}
          surface={data.fillColor || undefined}
          textColor={data.textColor || undefined}
          headerRight={<AgentBadge accent={accent}>k = {data.k ?? 4}</AgentBadge>}
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            <AgentPill
              accent={accent}
              icon={<AGENT_PRIMITIVE_COLORS.llm.Icon size={12} />}
              label={llmLabel}
            />
          </div>
        </AgentNodeCard>
      </div>
      <PopoverManager
        anchorEl={wrapperRef.current}
        elementId={id}
        type={"AgentRagElement" as const}
      />
    </DefaultNodeWrapper>
  )
}
