import { NodeProps, type Node } from "@xyflow/react"
import { useRef } from "react"
import { DefaultNodeWrapper } from "../wrappers"
import { PopoverManager } from "@/components/popovers/PopoverManager"
import { AgentStateBodyNodeProps } from "@/types"
import { LAYOUT } from "@/constants"
import { getCustomColorsFromData } from "@/utils/layoutUtils"

/**
 * SA-4 `AgentStateBody`. Child of `AgentState` via React Flow `parentId`,
 * same pattern SA-3 used for `StateBody`. v3 source mirrors
 * `agent-state-diagram/agent-state/agent-state-member-component.tsx`. The
 * `replyType === 'code'` mode renders a monospace block; everything else
 * renders a single-line label.
 */
export function AgentStateBody({
  id,
  width,
  height,
  data,
}: NodeProps<Node<AgentStateBodyNodeProps>>) {
  const wrapperRef = useRef<HTMLDivElement | null>(null)

  if (!width || !height) return null

  const { fillColor, textColor } = getCustomColorsFromData(data)
  const { name, replyType, code } = data

  // `replyType === 'code'` renders a monospace block, mirroring the
  // CodeContent path in agent-state-member-component.tsx.
  const isCode = replyType === "code"
  const codeText = code ?? name

  return (
    <DefaultNodeWrapper
      width={width}
      height={height}
      elementId={id}
      hiddenHandles={[]}
    >
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
            fill={fillColor}
            stroke="none"
          />
          {isCode ? (
            <foreignObject x={0} y={0} width={width} height={height}>
              <div
                style={{
                  fontFamily: "monospace",
                  fontSize: 12,
                  whiteSpace: "pre",
                  color: textColor,
                  padding: "4px 10px",
                  overflow: "hidden",
                }}
              >
                {codeText}
              </div>
            </foreignObject>
          ) : (
            <text
              x={10}
              y={height / 2 + 5}
              textAnchor="start"
              fontSize={LAYOUT.NAME_FONT_SIZE - 2}
              fill={textColor}
            >
              {name}
            </text>
          )}
        </svg>
      </div>
      <PopoverManager
        anchorEl={wrapperRef.current}
        elementId={id}
        type={"AgentStateBody" as const}
      />
    </DefaultNodeWrapper>
  )
}
