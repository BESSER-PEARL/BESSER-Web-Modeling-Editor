import { NodeProps, NodeResizer, type Node } from "@xyflow/react"
import { useRef } from "react"
import { DefaultNodeWrapper } from "../wrappers"
import { useDiagramModifiable } from "@/hooks/useDiagramModifiable"
import { PopoverManager } from "@/components/popovers/PopoverManager"
import { NodeToolbar } from "@/components/toolbars/NodeToolbar"
import { AgentWorkspaceNodeProps } from "@/types"
import { LAYOUT } from "@/constants"
import {
  AGENT_PRIMITIVE_COLORS,
  truncatePrimitiveSubtitle,
} from "./agentPrimitiveColors"

/**
 * `AgentWorkspace` — filesystem root the reasoning LLM may browse.
 * Develop source:
 * `agent-state-diagram/agent-workspace/agent-workspace-component.tsx`.
 *
 * Silhouette: folder with a tab rising above the body on the top-left,
 * amber accent, `📁 «workspace»` stereotype, bold name, truncated
 * path (falling back to description) subtitle.
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
  const fill = data.fillColor || AGENT_PRIMITIVE_COLORS.workspace.tint
  const textColor = data.textColor || "var(--besser-primary-contrast, #000)"
  const subtitle = truncatePrimitiveSubtitle(data.path || data.description)

  // Folder: a tab on the top-left rising above the body (develop's
  // "folder" silhouette).
  const tabW = Math.min(70, width * 0.45)
  const tabH = Math.min(16, height * 0.22)
  const slope = 10
  const folderPath = `M 0 0 H ${tabW} L ${tabW + slope} ${tabH} H ${width} V ${height} H 0 Z`

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
          <path d={folderPath} fill={fill} stroke={accent} strokeWidth={1.5} />
          <text
            x={width / 2}
            y={tabH + 16}
            textAnchor="middle"
            fontSize={LAYOUT.STEREOTYPE_LINE_HEIGHT}
            fontWeight="bold"
            fill={accent}
          >
            {`${AGENT_PRIMITIVE_COLORS.workspace.icon} «workspace»`}
          </text>
          <text
            x={width / 2}
            y={tabH + 34}
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
              y={height - 12}
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
        type={"AgentWorkspace" as const}
      />
    </DefaultNodeWrapper>
  )
}
