import { NodeProps, NodeResizer, type Node } from "@xyflow/react"
import { useEffect, useRef } from "react"
import { DefaultNodeWrapper } from "../wrappers"
import { useHandleOnResize } from "@/hooks"
import { useDiagramModifiable } from "@/hooks/useDiagramModifiable"
import { PopoverManager } from "@/components/popovers/PopoverManager"
import { NodeToolbar } from "@/components/toolbars/NodeToolbar"
import { useDiagramStore } from "@/store/context"
import { StateBodyRow, StateNodeProps } from "@/types"
import { LAYOUT } from "@/constants"
import { getCustomColorsFromData } from "@/utils/layoutUtils"

/**
 * `State` parent node. v3 parity: body rows and fallback body rows
 * render inline inside the State (table-style rows, mirroring AgentState
 * and Class attribute rows). The data shape lives on
 * `data.bodies[]` / `data.fallbackBodies[]`.
 */

const ROW_HEIGHT = 26

const renderRow = (
  row: StateBodyRow,
  index: number,
  yOffset: number,
  width: number,
  textColor: string,
  isFallback: boolean
) => (
  <foreignObject
    key={row.id}
    x={0}
    y={yOffset + index * ROW_HEIGHT}
    width={width}
    height={ROW_HEIGHT}
  >
    <div
      style={{
        fontSize: LAYOUT.NAME_FONT_SIZE - 2,
        color: textColor,
        padding: "0 10px",
        height: ROW_HEIGHT,
        lineHeight: `${ROW_HEIGHT}px`,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        fontStyle: isFallback ? "italic" : undefined,
      }}
      title={row.name ?? ""}
    >
      {row.name ?? ""}
    </div>
  </foreignObject>
)

export function State({
  id,
  width,
  height,
  data,
  parentId,
}: NodeProps<Node<StateNodeProps>>) {
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const { onResize } = useHandleOnResize(parentId)
  const isDiagramModifiable = useDiagramModifiable()
  const setNodes = useDiagramStore((s) => s.setNodes)

  const mainBodies = data.bodies ?? []
  const fallbackBodies = data.fallbackBodies ?? []
  const headerHeight = LAYOUT.DEFAULT_HEADER_HEIGHT
  const hasAnyBody = mainBodies.length + fallbackBodies.length > 0
  const fallbackDividerY = headerHeight + mainBodies.length * ROW_HEIGHT
  const hasFallbackDivider =
    fallbackBodies.length > 0 && mainBodies.length > 0
  const requiredHeight =
    headerHeight +
    (mainBodies.length + fallbackBodies.length) * ROW_HEIGHT +
    (hasFallbackDivider ? 10 : 0) +
    16

  // Auto-grow node height to fit all body rows.
  useEffect(() => {
    if (height && height < requiredHeight) {
      setNodes((all) =>
        all.map((n) =>
          n.id === id
            ? {
                ...n,
                height: requiredHeight,
                measured: {
                  width: n.measured?.width ?? width ?? 0,
                  height: requiredHeight,
                },
                style: { ...(n.style ?? {}), height: requiredHeight },
              }
            : n
        )
      )
    }
  }, [requiredHeight, height, id, setNodes, width])

  if (!width || !height) return null

  const { fillColor, strokeColor, textColor } = getCustomColorsFromData(data)
  const { name, italic, underline } = data
  const cornerRadius = 8

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
            strokeWidth={LAYOUT.LINE_WIDTH}
          />
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
            {name}
          </text>
          {hasAnyBody && (
            <line
              x1={0}
              x2={width}
              y1={headerHeight}
              y2={headerHeight}
              stroke={strokeColor}
              strokeWidth={1}
            />
          )}
          {mainBodies.map((b, i) =>
            renderRow(b, i, headerHeight, width, textColor, false)
          )}
          {hasFallbackDivider && (
            <line
              x1={0}
              x2={width}
              y1={fallbackDividerY}
              y2={fallbackDividerY}
              stroke={strokeColor}
              strokeWidth={1}
              strokeDasharray="3 2"
              opacity={0.6}
            />
          )}
          {fallbackBodies.map((b, i) =>
            renderRow(b, i, fallbackDividerY, width, textColor, true)
          )}
        </svg>
      </div>
      <PopoverManager
        anchorEl={wrapperRef.current}
        elementId={id}
        type={"State" as const}
      />
    </DefaultNodeWrapper>
  )
}
