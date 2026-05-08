import { NodeProps, NodeResizer, type Node } from "@xyflow/react"
import { useRef } from "react"
import { DefaultNodeWrapper } from "../wrappers"
import { useHandleOnResize } from "@/hooks"
import { useDiagramModifiable } from "@/hooks/useDiagramModifiable"
import { PopoverManager } from "@/components/popovers/PopoverManager"
import { NodeToolbar } from "@/components/toolbars/NodeToolbar"
import { AgentIntentNodeProps } from "@/types"
import { LAYOUT } from "@/constants"
import { getCustomColorsFromData } from "@/utils/layoutUtils"

/**
 * SA-4 `AgentIntent` parent. Mirrors the v3 visual at
 * `agent-state-diagram/agent-intent-object-component/agent-intent-object-component.tsx`
 * — a green-tinged rectangle with a small folded-corner notch and an
 * "Intent: <name>" header. Children (AgentIntentBody /
 * AgentIntentDescription / AgentIntentObjectComponent) hang off via
 * `parentId`.
 *
 * Note on visuals: the v3 component prefixed the name with `"Intent: "`
 * inside its render method (mutating `element.name`), which is a subtle
 * bug — we emit the prefix only at render time so `data.name` stays clean.
 */
export function AgentIntent({
  id,
  width,
  height,
  data,
  parentId,
}: NodeProps<Node<AgentIntentNodeProps>>) {
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const { onResize } = useHandleOnResize(parentId)
  const isDiagramModifiable = useDiagramModifiable()

  if (!width || !height) return null

  const { fillColor, strokeColor, textColor } = getCustomColorsFromData(data)
  const { name, stereotype, italic, underline } = data
  const showStereotype = !!stereotype
  const headerHeight = showStereotype
    ? LAYOUT.DEFAULT_HEADER_HEIGHT_WITH_STEREOTYPE
    : LAYOUT.DEFAULT_HEADER_HEIGHT
  // Light-green tint per the v3 fillColor default (#E3F9E5).
  const intentFill = fillColor === "white" ? "#E3F9E5" : fillColor

  return (
    <DefaultNodeWrapper width={width} height={height} elementId={id}>
      <NodeToolbar elementId={id} />
      <NodeResizer
        isVisible={isDiagramModifiable}
        onResize={onResize}
        minWidth={120}
        minHeight={60}
        handleStyle={{ width: 8, height: 8 }}
      />
      <div ref={wrapperRef}>
        <svg
          width={width}
          height={height + 30}
          viewBox={`0 0 ${width} ${height + 30}`}
          overflow="visible"
        >
          {/* Folded-corner intent rectangle path. Mirrors v3 ThemedPath. */}
          <path
            d={`M 0 0 H ${width} V ${height} H 30 L 0 ${height + 30} L 10 ${height} H 10 0 Z`}
            fill={intentFill}
            stroke={strokeColor}
            strokeWidth={1.2}
          />
          {showStereotype ? (
            <>
              <text
                x={width / 2}
                y={18}
                textAnchor="middle"
                fontSize={LAYOUT.STEREOTYPE_LINE_HEIGHT}
                fill={textColor}
              >
                {`«${stereotype}»`}
              </text>
              <text
                x={width / 2}
                y={38}
                textAnchor="middle"
                fontSize={LAYOUT.NAME_FONT_SIZE}
                fontStyle={italic ? "italic" : undefined}
                textDecoration={underline ? "underline" : undefined}
                fontWeight="600"
                fill={textColor}
              >
                {`Intent: ${name}`}
              </text>
            </>
          ) : (
            <text
              x={width / 2}
              y={26}
              textAnchor="middle"
              fontSize={LAYOUT.NAME_FONT_SIZE}
              fontStyle={italic ? "italic" : undefined}
              textDecoration={underline ? "underline" : undefined}
              fontWeight="600"
              fill={textColor}
            >
              {`Intent: ${name}`}
            </text>
          )}
          <line
            x1={0}
            x2={width}
            y1={headerHeight}
            y2={headerHeight}
            stroke={strokeColor}
            strokeWidth={1}
          />
        </svg>
      </div>
      <PopoverManager
        anchorEl={wrapperRef.current}
        elementId={id}
        type={"AgentIntent" as const}
      />
    </DefaultNodeWrapper>
  )
}
