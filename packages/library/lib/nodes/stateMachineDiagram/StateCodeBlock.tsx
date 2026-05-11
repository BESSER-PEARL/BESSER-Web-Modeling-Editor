import { NodeProps, NodeResizer, type Node } from "@xyflow/react"
import { useRef } from "react"
import { DefaultNodeWrapper } from "../wrappers"
import { useHandleOnResize } from "@/hooks"
import { useDiagramModifiable } from "@/hooks/useDiagramModifiable"
import { PopoverManager } from "@/components/popovers/PopoverManager"
import { NodeToolbar } from "@/components/toolbars/NodeToolbar"
import { StateCodeBlockProps } from "@/types"
import { getCustomColorsFromData } from "@/utils/layoutUtils"

const preserveTabs = (str: string): string => str.replace(/\t/g, "    ")

/**
 * Resizable code panel. v3 source:
 * `v3 source: uml-state-code-block-component.tsx`. Header bar
 * shows the language label; body is a `foreignObject` of plain `<div>`s
 * preserving tab whitespace so multi-line Python pastes don't reflow.
 *
 * In v4 this is its own React-Flow node — the brief allows it to attach
 * via `parentId` to a containing State, but it can also free-float (the
 * v3 fork supported both shapes).
 */
export function StateCodeBlock({
  id,
  width,
  height,
  data,
  parentId,
}: NodeProps<Node<StateCodeBlockProps>>) {
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const { onResize } = useHandleOnResize(parentId)
  const isDiagramModifiable = useDiagramModifiable()

  if (!width || !height) return null

  const { fillColor, strokeColor, textColor } = getCustomColorsFromData(data)
  const { code = "", language = "python" } = data
  const cornerRadius = 8
  const headerHeight = 20
  const lines = code.split("\n")

  return (
    <DefaultNodeWrapper width={width} height={height} elementId={id}>
      <NodeToolbar elementId={id} />
      <NodeResizer
        isVisible={isDiagramModifiable}
        onResize={onResize}
        minWidth={150}
        minHeight={100}
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
            stroke={strokeColor}
            strokeWidth={1}
          />
          <rect
            x={0}
            y={0}
            width={width}
            height={headerHeight}
            rx={cornerRadius}
            ry={cornerRadius}
            fill={strokeColor}
            stroke={strokeColor}
            strokeWidth={1}
          />
          <text
            x={10}
            y={headerHeight / 2 + 5}
            fontSize="10"
            fontFamily="sans-serif"
            fontWeight="bold"
            fill="var(--besser-background, #ffffff)"
          >
            {language}
          </text>
          <foreignObject
            x={0}
            y={headerHeight}
            width={width}
            height={Math.max(0, height - headerHeight)}
          >
            <div
              style={{
                width: "100%",
                height: "100%",
                overflow: "hidden",
                padding: "4px 10px",
                boxSizing: "border-box",
              }}
            >
              {lines.map((line, index) => (
                <div
                  key={index}
                  style={{
                    fontSize: 13,
                    color: textColor || "#000",
                    fontFamily: "monospace",
                    whiteSpace: "pre",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    lineHeight: "14px",
                  }}
                >
                  {preserveTabs(line) || " "}
                </div>
              ))}
            </div>
          </foreignObject>
        </svg>
      </div>
      <PopoverManager
        anchorEl={wrapperRef.current}
        elementId={id}
        type={"StateCodeBlock" as const}
      />
    </DefaultNodeWrapper>
  )
}
