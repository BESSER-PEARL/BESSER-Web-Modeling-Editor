import { NodeProps, NodeResizer, type Node } from "@xyflow/react"
import { useEffect, useRef } from "react"
import { DefaultNodeWrapper } from "../wrappers"
import { useHandleOnResize } from "@/hooks"
import { useDiagramModifiable } from "@/hooks/useDiagramModifiable"
import { PopoverManager } from "@/components/popovers/PopoverManager"
import { NodeToolbar } from "@/components/toolbars/NodeToolbar"
import { useDiagramStore } from "@/store/context"
import { AgentStateBodyRow, AgentStateNodeProps } from "@/types"
import { LAYOUT } from "@/constants"
import { getCustomColorsFromData } from "@/utils/layoutUtils"

/**
 * SA-FIX-Agent: `AgentState` renders body sections inline.
 *
 * v3 source (`agent-state-diagram/agent-state/agent-state-component.tsx`)
 * drew the body rows directly inside the parent `<g>`, like a Class
 * node draws attribute / method rows. SA-4 originally split bodies into
 * separate React-Flow children connected via `parentId`; SA-FIX-Agent
 * undoes that split — bodies live on `data.bodies` and render as inline
 * rows here.
 *
 * Layout:
 *  - Header (stereotype + name).
 *  - Header divider (when any body row exists).
 *  - Main body rows (entry / do / exit / on).
 *  - Fallback divider (when at least one fallback row exists alongside
 *    main rows; mirrors v3's `hasFallbackBody` check).
 *  - Fallback rows.
 */
const ROW_HEIGHT = 30

const renderRow = (
  body: AgentStateBodyRow,
  index: number,
  yOffset: number,
  width: number,
  textColor: string
): React.ReactNode => {
  const isCode = body.replyType === "code"
  const codeText = body.code ?? body.name ?? ""
  const labelText = body.name ?? ""
  const y = yOffset + index * ROW_HEIGHT
  if (isCode) {
    return (
      <foreignObject
        key={body.id}
        x={0}
        y={y}
        width={width}
        height={ROW_HEIGHT}
      >
        <div
          style={{
            fontFamily: "monospace",
            fontSize: 12,
            whiteSpace: "pre",
            color: textColor,
            padding: "4px 10px",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {codeText}
        </div>
      </foreignObject>
    )
  }
  return (
    <text
      key={body.id}
      x={10}
      y={y + ROW_HEIGHT / 2 + 5}
      textAnchor="start"
      fontSize={LAYOUT.NAME_FONT_SIZE - 2}
      fill={textColor}
      fontStyle={body.kind === "fallback" ? "italic" : undefined}
    >
      {labelText}
    </text>
  )
}

export function AgentState({
  id,
  width,
  height,
  data,
  parentId,
}: NodeProps<Node<AgentStateNodeProps>>) {
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const { onResize } = useHandleOnResize(parentId)
  const isDiagramModifiable = useDiagramModifiable()

  if (!width || !height) return null

  const { fillColor, strokeColor, textColor } = getCustomColorsFromData(data)
  const { name, stereotype, italic, underline, bodies } = data
  const cornerRadius = 8
  const showStereotype = !!stereotype
  const headerHeight = showStereotype
    ? LAYOUT.DEFAULT_HEADER_HEIGHT_WITH_STEREOTYPE
    : LAYOUT.DEFAULT_HEADER_HEIGHT

  const allBodies = bodies ?? []
  const mainBodies = allBodies.filter((b) => b.kind !== "fallback")
  const fallbackBodies = allBodies.filter((b) => b.kind === "fallback")
  const fallbackDividerY = headerHeight + mainBodies.length * ROW_HEIGHT
  const hasFallbackDivider = fallbackBodies.length > 0 && mainBodies.length > 0

  // Auto-grow node height to fit all body rows. Without this the SVG
  // viewBox stays at the initial drop height (e.g. 100px) and rows
  // beyond the third spill outside the parent rectangle — the
  // user-reported "rows go out of the AgentState" symptom.
  const requiredHeight =
    headerHeight +
    (mainBodies.length + fallbackBodies.length) * ROW_HEIGHT +
    (hasFallbackDivider ? 12 : 0) +
    16 // bottom padding
  const setNodes = useDiagramStore((state) => state.setNodes)
  useEffect(() => {
    if (height < requiredHeight) {
      setNodes((all) =>
        all.map((n) =>
          n.id === id
            ? {
                ...n,
                height: requiredHeight,
                measured: {
                  width: n.measured?.width ?? width,
                  height: requiredHeight,
                },
                style: { ...(n.style ?? {}), height: requiredHeight },
              }
            : n
        )
      )
    }
  }, [requiredHeight, height, id, setNodes, width])

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
                {name}
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
              {name}
            </text>
          )}
          {/* Header divider — drawn whenever any body row exists, like
              v3's `hasBody` check. */}
          {allBodies.length > 0 && (
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
            renderRow(b, i, headerHeight, width, textColor)
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
            renderRow(b, i, fallbackDividerY, width, textColor)
          )}
        </svg>
      </div>
      <PopoverManager
        anchorEl={wrapperRef.current}
        elementId={id}
        type={"AgentState" as const}
      />
    </DefaultNodeWrapper>
  )
}
