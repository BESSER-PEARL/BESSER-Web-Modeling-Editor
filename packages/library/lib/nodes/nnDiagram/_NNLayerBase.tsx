/**
 * SA-5 shared layer-card renderer. Every NN layer kind is a labelled
 * rounded rectangle with the layer kind sub-text under the user-editable
 * `name`. The 18 individual node components delegate here so the visual
 * is consistent across layer types while the inspector panel pulls
 * per-kind metadata from `nnAttributeWidgetConfig`.
 *
 * SA-UX-FIX-2 (B4): the v3 NN layer card displayed a kind-specific PNG
 * icon (Conv1D / Conv2D / RNN / LSTM / …) above the name. SA-2.2 retired
 * those icons in favour of stereotype-only cards. Per the user, restore
 * them. The icon is rendered as an `<image>` element pulling from
 * `/images/nn-layers/{kind}.png` (the same asset folder webapp v3 used).
 *
 * SA-FIX-NN (PC-10): on first mount, dedupe the auto-assigned `name`
 * against existing sibling layers of the same kind in the same diagram.
 * Mirrors v3 `createMandatoryAttributes()` counter loop at
 * `nn-component-update.tsx:561-585`. Two freshly-dropped Conv2D cards
 * become `Conv2D` / `Conv2D2` instead of both `Conv2D`.
 */
import { NodeProps, NodeResizer, type Node } from "@xyflow/react"
import { useEffect, useRef } from "react"
import { useShallow } from "zustand/shallow"
import { DefaultNodeWrapper } from "../wrappers"
import { useHandleOnResize } from "@/hooks"
import { useDiagramModifiable } from "@/hooks/useDiagramModifiable"
import { PopoverManager } from "@/components/popovers/PopoverManager"
import { NodeToolbar } from "@/components/toolbars/NodeToolbar"
import { useDiagramStore } from "@/store/context"
import { NNLayerNodeProps } from "@/types"
import { LAYOUT } from "@/constants"
import { getCustomColorsFromData } from "@/utils/layoutUtils"

/**
 * Map v4 node-type → PNG file name in `/images/nn-layers/`. Mirrors
 * `LAYER_ICONS` in v3's `nn-layer-icon-component.tsx`. Layer kinds
 * without a dedicated icon (e.g. NNContainer/NNReference) fall back to
 * `default.png` if the asset is present, otherwise no icon is rendered.
 */
const NN_LAYER_ICON_FILES: Record<string, string> = {
  Conv1DLayer: "conv1d.png",
  Conv2DLayer: "conv2d.png",
  Conv3DLayer: "conv3d.png",
  PoolingLayer: "pooling.png",
  LinearLayer: "linear.png",
  FlattenLayer: "flatten.png",
  EmbeddingLayer: "embedding.png",
  DropoutLayer: "dropout.png",
  RNNLayer: "rnn.png",
  LSTMLayer: "lstm.png",
  GRULayer: "gru.png",
  LayerNormalizationLayer: "layernorm.png",
  BatchNormalizationLayer: "batchnorm.png",
  TensorOp: "tensorop.png",
  Configuration: "configuration.png",
  TrainingDataset: "train_data.png",
  TestDataset: "test_data.png",
}

const NN_LAYER_ICON_BASE = "/images/nn-layers/"

/**
 * SA-FIX-NN (PC-10): pure helper — given a desired base name, the layer
 * `nodeType`, and the current set of nodes (any shape with `id`,
 * `type`, `data.name`), return the first uncollided variant. v3 did this
 * inside `createMandatoryAttributes` (`nn-component-update.tsx:561-585`)
 * by suffixing `2`, `3`, … on the base name; this preserves that scheme.
 *
 * Walks only sibling nodes of the same `nodeType` (so two Conv2D cards
 * collide while a Conv2D and a Conv1D do not) and skips the node with
 * `selfId` so a re-render of the same node doesn't loop. Returns the
 * input unchanged when no collision is found.
 */
export function nextUniqueNNLayerName(
  baseName: string,
  nodeType: string,
  nodes: ReadonlyArray<{
    id: string
    type?: string
    data?: { name?: string }
  }>,
  selfId?: string
): string {
  const siblings = nodes.filter(
    (n) => n.id !== selfId && n.type === nodeType
  )
  const taken = new Set(
    siblings
      .map((n) => (n.data && typeof n.data.name === "string" ? n.data.name : ""))
      .filter((s) => s !== "")
  )
  if (!taken.has(baseName)) return baseName
  let i = 2
  while (taken.has(`${baseName}${i}`)) i += 1
  return `${baseName}${i}`
}

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

  // SA-FIX-NN (PC-10): dedupe auto-name against existing sibling layers
  // of the same kind. Runs once per node id; the store check inside the
  // effect guarantees we only rename when there is an actual collision.
  const setNodes = useDiagramStore(
    useShallow((state) => state.setNodes)
  )
  useEffect(() => {
    if (!isDiagramModifiable) return
    setNodes((all) => {
      const self = all.find((n) => n.id === id)
      if (!self) return all
      const currentName = (self.data as { name?: string } | undefined)?.name
      if (typeof currentName !== "string" || currentName === "") return all
      const unique = nextUniqueNNLayerName(currentName, nodeType, all, id)
      if (unique === currentName) return all
      return all.map((n) =>
        n.id === id
          ? {
              ...n,
              data: {
                ...(n.data as Record<string, unknown>),
                name: unique,
              },
            }
          : n
      )
    })
    // Run only on first mount per node — same pattern as the
    // mandatory-attribute auto-fill in `NNComponentEditPanel`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (!width || !height) return null

  const { fillColor, strokeColor, textColor } = getCustomColorsFromData(data)
  const fill = !data.fillColor && defaultFill ? defaultFill : fillColor
  const cornerRadius = 6
  const headerHeight = LAYOUT.DEFAULT_HEADER_HEIGHT_WITH_STEREOTYPE
  const iconFile = NN_LAYER_ICON_FILES[nodeType]
  // Icon area sits below the divider, vertically centred in the
  // remaining card space. Width caps the icon at 80×80 (v3 default),
  // shrinking on small cards so it never overflows.
  const availableIconHeight = Math.max(0, height - headerHeight - 8)
  const iconSize = Math.min(80, width - 24, availableIconHeight)
  const showIcon = !!iconFile && iconSize >= 24
  const iconX = (width - iconSize) / 2
  const iconY = headerHeight + (availableIconHeight - iconSize) / 2

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
          {/*
           * v3 parity: NN layer cards with a kind icon (Conv1D / Conv2D /
           * RNN / …) had no outer box — just the stereotype + name above a
           * standalone icon. Only render the boxed card (rect + header
           * divider) when there is no icon to show, so the boxed look is
           * limited to icon-less variants (e.g. layers without a PNG asset
           * yet).
           */}
          {!showIcon && (
            <>
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
            </>
          )}
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
          {showIcon && (
            <image
              href={`${NN_LAYER_ICON_BASE}${iconFile}`}
              x={iconX}
              y={iconY}
              width={iconSize}
              height={iconSize}
              preserveAspectRatio="xMidYMid meet"
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
