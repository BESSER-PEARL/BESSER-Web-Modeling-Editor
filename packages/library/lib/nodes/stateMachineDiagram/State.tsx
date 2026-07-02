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

// Develop parity (`uml-state-member.ts`): every body / fallback-body row
// defaults to `computeDimension(1.0, 30)` = 30px.
const ROW_HEIGHT = 30

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
        // Develop parity (`uml-state-body-update.tsx`): every body /
        // fallback row carries optional fillColor / textColor.
        color: row.textColor || textColor,
        backgroundColor: row.fillColor || undefined,
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
  // v3 parity (`uml-state-component.tsx`): a set stereotype grows the
  // header 40 → 50 px to fit the «stereotype» line above the name.
  const headerHeight = data.stereotype
    ? LAYOUT.DEFAULT_HEADER_HEIGHT_WITH_STEREOTYPE
    : LAYOUT.DEFAULT_HEADER_HEIGHT
  const hasAnyBody = mainBodies.length + fallbackBodies.length > 0
  const fallbackDividerY = headerHeight + mainBodies.length * ROW_HEIGHT
  // Develop parity (`uml-state.ts` `render()` / `uml-state-component.tsx`):
  // the fallback divider is drawn whenever any fallback row exists,
  // independent of whether main body rows are present — a state with
  // only fallback rows still shows one divider right below the header.
  const hasFallbackDivider = fallbackBodies.length > 0
  // Develop parity: `UMLState.render()` sets `bounds.height` to exactly
  // `headerHeight + Σ(row heights)` — there is no extra padding beyond
  // the rows themselves.
  const requiredHeight =
    headerHeight + (mainBodies.length + fallbackBodies.length) * ROW_HEIGHT

  // Develop parity (`uml-state.ts` `static features.resizable = 'WIDTH'`):
  // height is never user-controlled — it's always exactly the computed
  // content height. Snap unconditionally (grow *and* shrink), mirroring
  // Class.tsx's `minHeight` snap-effect, so adding/removing a body row
  // settles the height immediately instead of leaving dead space (the
  // prior grow-only effect never shrank an over-tall node).
  useEffect(() => {
    if (height && height !== requiredHeight) {
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
  const { name, stereotype, italic, underline } = data
  const showStereotype = !!stereotype
  const cornerRadius = 8

  return (
    <DefaultNodeWrapper
      width={width}
      height={height}
      elementId={id}
      className="horizontally-not-resizable"
    >
      <NodeToolbar elementId={id} />
      {/* Develop parity (`uml-state.ts` `resizable: 'WIDTH'`): only the
          left/right handles are live — height is locked to the computed
          content height via minHeight===maxHeight, mirroring
          `StateForkNodeHorizontal.tsx` and `Class.tsx`. */}
      <NodeResizer
        isVisible={isDiagramModifiable}
        onResize={onResize}
        minWidth={120}
        minHeight={requiredHeight}
        maxHeight={requiredHeight}
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
            // Develop parity (`uml-state-component.tsx`): solid line, same
            // style as the header divider — no dash, no reduced opacity.
            <line
              x1={0}
              x2={width}
              y1={fallbackDividerY}
              y2={fallbackDividerY}
              stroke={strokeColor}
              strokeWidth={1}
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
