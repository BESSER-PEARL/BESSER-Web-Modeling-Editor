/**
 * SA-5 shared layer-card renderer. Every NN layer kind is a labelled
 * rounded rectangle with the layer kind sub-text under the user-editable
 * `name`. The 18 individual node components delegate here so the visual
 * is consistent across layer types while the inspector panel pulls
 * per-kind metadata from `nnAttributeWidgetConfig`.
 */
import { NodeProps, NodeResizer, type Node } from "@xyflow/react"
import { useRef } from "react"
import { DefaultNodeWrapper } from "../wrappers"
import { useHandleOnResize } from "@/hooks"
import { useDiagramModifiable } from "@/hooks/useDiagramModifiable"
import { PopoverManager } from "@/components/popovers/PopoverManager"
import { NodeToolbar } from "@/components/toolbars/NodeToolbar"
import { NNLayerNodeProps } from "@/types"
import { LAYOUT } from "@/constants"
import { getCustomColorsFromData } from "@/utils/layoutUtils"

export interface NNLayerBaseProps {
  id: string
  width?: number
  height?: number
  data: NNLayerNodeProps
  parentId?: string
  /** v4 node-type string surfaced in the popover registry. */
  nodeType: string
  /** Visible kind label (rendered as a stereotype-style header). */
  kindLabel: string
  /** Optional fill colour override (defaults to white/#fff). */
  defaultFill?: string
}

export function NNLayerBase({
  id,
  width,
  height,
  data,
  parentId,
  nodeType,
  kindLabel,
  defaultFill,
}: NNLayerBaseProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const { onResize } = useHandleOnResize(parentId)
  const isDiagramModifiable = useDiagramModifiable()

  if (!width || !height) return null

  const { fillColor, strokeColor, textColor } = getCustomColorsFromData(data)
  const fill = fillColor === "white" && defaultFill ? defaultFill : fillColor
  const cornerRadius = 6
  const headerHeight = LAYOUT.DEFAULT_HEADER_HEIGHT_WITH_STEREOTYPE

  return (
    <DefaultNodeWrapper width={width} height={height} elementId={id}>
      <NodeToolbar elementId={id} />
      <NodeResizer
        isVisible={isDiagramModifiable}
        onResize={onResize}
        minWidth={120}
        minHeight={50}
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
            fill={fill}
            stroke={strokeColor}
            strokeWidth={LAYOUT.LINE_WIDTH}
          />
          <text
            x={width / 2}
            y={18}
            textAnchor="middle"
            fontSize={LAYOUT.STEREOTYPE_LINE_HEIGHT}
            fill={textColor}
          >
            {`«${kindLabel}»`}
          </text>
          <text
            x={width / 2}
            y={38}
            textAnchor="middle"
            fontSize={LAYOUT.NAME_FONT_SIZE}
            fontWeight="600"
            fill={textColor}
          >
            {data.name}
          </text>
          {height > headerHeight + 4 && (
            <line
              x1={0}
              x2={width}
              y1={headerHeight}
              y2={headerHeight}
              stroke={strokeColor}
              strokeWidth={1}
            />
          )}
        </svg>
      </div>
      <PopoverManager
        anchorEl={wrapperRef.current}
        elementId={id}
        type={nodeType as never}
      />
    </DefaultNodeWrapper>
  )
}

/** Shorthand factory: build a layer node component bound to a kind label. */
export function makeNNLayerComponent(
  nodeType: string,
  kindLabel: string,
  defaultFill?: string
) {
  const Component = ({
    id,
    width,
    height,
    data,
    parentId,
  }: NodeProps<Node<NNLayerNodeProps>>) => (
    <NNLayerBase
      id={id}
      width={width}
      height={height}
      data={data}
      parentId={parentId}
      nodeType={nodeType}
      kindLabel={kindLabel}
      defaultFill={defaultFill}
    />
  )
  Component.displayName = `NN.${nodeType}`
  return Component
}
