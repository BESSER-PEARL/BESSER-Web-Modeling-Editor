/**
 * Shared layer-card renderer. Every NN layer kind is a labelled
 * rounded rectangle with the layer kind sub-text under the user-editable
 * `name`. The 18 individual node components delegate here so the visual
 * is consistent across layer types while the inspector panel pulls
 * per-kind metadata from `nnAttributeWidgetConfig`.
 *
 * The v3 NN layer card displayed a kind-specific PNG
 * icon (Conv1D / Conv2D / RNN / LSTM / …) above the name. retired
 * those icons in favour of stereotype-only cards. Per the user, restore
 * them. The icon is rendered as an `<image>` element pulling from
 * `/images/nn-layers/{kind}.png` (the same asset folder webapp v3 used).
 *
 * On first mount, dedupe the auto-assigned `name`
 * against existing sibling layers of the same kind in the same diagram.
 * Mirrors v3 `createMandatoryAttributes()` counter loop at
 * `nn-component-update.tsx:561-585`. Two freshly-dropped Conv2D cards
 * become `Conv2D` / `Conv2D2` instead of both `Conv2D`.
 */
import { NodeProps, NodeResizer, type Node } from "@xyflow/react"
import { usePopoverAnchor } from "@/hooks/usePopoverAnchor"
import { useEffect } from "react"
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
import { measureTextWidth } from "@/utils/textUtils"

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
 * Pure helper — given a desired base name, the layer
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

/**
 * First-mount auto-name dedupe, shared by `NNLayerBase` and
 * `NNContainer` (Wave-3 NN-7 — develop's
 * `nn-association-monitor.tsx:193-219` suffixed `2,3,…` onto newly
 * added NNContainers colliding with an existing container's name; the
 * backend resolves containers **by name**, so duplicates silently drop
 * a whole NN). Runs once per node id; the store check inside the
 * effect guarantees we only rename when there is an actual collision.
 */
export function useUniqueNNName(id: string, nodeType: string) {
  const isDiagramModifiable = useDiagramModifiable()
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
      return all.map((n) => {
        if (n.id !== id) return n
        const data = n.data as Record<string, unknown> & {
          attributes?: Record<string, unknown>
        }
        // Keep `attributes.name` (what the backend reads) in step.
        const attributes =
          data.attributes && "name" in data.attributes
            ? { ...data.attributes, name: unique }
            : data.attributes
        return {
          ...n,
          data: {
            ...data,
            name: unique,
            ...(attributes !== undefined && { attributes }),
          },
        }
      })
    })
    // Run only on first mount per node — same pattern as the
    // mandatory-attribute auto-fill in `NNComponentEditPanel`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])
}

const NN_LABEL_MIN_FONT_SIZE = 11

// Canvas text inherits the app font (Sora in the webapp); measure with it.
let labelFontFamily: string | undefined
const getLabelFontFamily = (): string => {
  if (!labelFontFamily && typeof document !== "undefined" && document.body) {
    labelFontFamily = getComputedStyle(document.body).fontFamily || undefined
  }
  return labelFontFamily ?? "Inter, system-ui, sans-serif"
}

/**
 * Fit a layer name into `maxWidth`: shrink the font down to
 * `NN_LABEL_MIN_FONT_SIZE`, then truncate with an ellipsis. Default names
 * such as `layernorm_layer` are wider than the 90 px default card.
 */
export function fitNNLayerLabel(
  name: string,
  maxWidth: number,
  maxFontSize: number,
  measure: (text: string, fontSize: number) => number = (text, fontSize) =>
    measureTextWidth(text, `600 ${fontSize}px ${getLabelFontFamily()}`)
): { text: string; fontSize: number; truncated: boolean } {
  for (let size = maxFontSize; size >= NN_LABEL_MIN_FONT_SIZE; size -= 1) {
    if (measure(name, size) <= maxWidth) {
      return { text: name, fontSize: size, truncated: false }
    }
  }
  const size = NN_LABEL_MIN_FONT_SIZE
  let end = name.length
  while (end > 1 && measure(`${name.slice(0, end)}…`, size) > maxWidth) {
    end -= 1
  }
  return { text: `${name.slice(0, end)}…`, fontSize: size, truncated: true }
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
  defaultFill,
}: NNLayerBaseProps) {
  const [wrapperEl, wrapperRef] = usePopoverAnchor<HTMLDivElement>()
  const { onResize } = useHandleOnResize(parentId)
  const isDiagramModifiable = useDiagramModifiable()

  // Dedupe auto-name against existing sibling layers of the same kind.
  useUniqueNNName(id, nodeType)

  if (!width || !height) return null

  const { fillColor, strokeColor, textColor: themeTextColor } =
    getCustomColorsFromData(data)
  const usesKindFill = !data.fillColor && !!defaultFill
  const fill = usesKindFill ? defaultFill : fillColor
  const cornerRadius = 6
  const iconFile = NN_LAYER_ICON_FILES[nodeType]
  const hasIcon = !!iconFile
  // v3 parity: NN layer cards with an icon render the icon centred in
  // the card with the layer NAME directly BELOW it. No `«kindLabel»`
  // stereotype band. The icon is sized larger than the v3 80 px cap but
  // capped at 100 px so the card has clear breathing room around it —
  // the selection rectangle hugs the card without the icon visually
  // pushing it edge-to-edge.
  const MAX_ICON_SIZE = 70
  const nameBandHeight = 22
  const iconPad = 6
  const availableIconHeight = Math.max(0, height - nameBandHeight - iconPad * 2)
  const iconSize = Math.min(
    MAX_ICON_SIZE,
    width - iconPad * 2,
    availableIconHeight
  )
  const showIcon = hasIcon && iconSize >= 24
  const iconX = (width - iconSize) / 2
  const iconY = iconPad
  const nameY = Math.min(height - 6, iconY + iconSize + 16)
  // Only the pastel kind card (drawn when no icon shows) needs dark text in
  // dark mode; an icon card sits on the canvas, so it follows the theme.
  const textColor =
    usesKindFill && !showIcon && !data.textColor ? "#1f2937" : themeTextColor
  // Icon cards caption the icon, so their label stays compact and uniform.
  const label = fitNNLayerLabel(
    data.name ?? "",
    width - 8,
    showIcon ? 13 : LAYOUT.NAME_FONT_SIZE
  )

  return (
    <DefaultNodeWrapper width={width} height={height} elementId={id}>
      <NodeToolbar elementId={id} />
      <NodeResizer
        isVisible={isDiagramModifiable}
        onResize={onResize}
        minWidth={80}
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
          {!showIcon && (
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
          )}
          {showIcon ? (
            <>
              <image
                href={`${NN_LAYER_ICON_BASE}${iconFile}`}
                x={iconX}
                y={iconY}
                width={iconSize}
                height={iconSize}
                preserveAspectRatio="xMidYMid meet"
              />
              <text
                x={width / 2}
                y={nameY}
                textAnchor="middle"
                fontSize={label.fontSize}
                fontWeight="600"
                fill={textColor}
              >
                {label.truncated && <title>{data.name}</title>}
                {label.text}
              </text>
            </>
          ) : (
            <text
              x={width / 2}
              y={height / 2 + 6}
              textAnchor="middle"
              fontSize={label.fontSize}
              fontWeight="600"
              fill={textColor}
            >
              {label.truncated && <title>{data.name}</title>}
              {label.text}
            </text>
          )}
        </svg>
      </div>
      <PopoverManager
        anchorEl={wrapperEl}
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
