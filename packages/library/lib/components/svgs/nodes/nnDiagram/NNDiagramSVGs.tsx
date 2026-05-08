import { SVGComponentProps } from "@/types/SVG"

/**
 * SA-5 lightweight palette previews for NNDiagram. Each palette item
 * mirrors the canvas card's basic shape — kind label header + a
 * placeholder body — so the sidebar drag-source matches the dropped
 * appearance closely enough for users to recognise the kind.
 *
 * SA-FIX-NN (PC-10): mirror the canvas card. After SA-UX-FIX-2 restored
 * the per-kind PNG icons in `_NNLayerBase.tsx`, the previews now also
 * render the same `<image>` element + a `«kind»` stereotype header + the
 * default `name`, so the drag source shown in the sidebar visually
 * matches what lands on the canvas.
 *
 * Plain SVG; no themed wrappers (per `/CLAUDE.md` "Custom SVG
 * Rendering" guidance).
 */

const NN_LAYER_ICON_BASE = "/images/nn-layers/"

/**
 * Build a palette preview component bound to a layer kind. Renders the
 * canvas-style header (`«kind»` + `name`) plus the kind's PNG icon when
 * one is registered.
 */
const buildLayerPreview = (
  kindLabel: string,
  defaultName: string,
  fill: string,
  iconFile?: string
) =>
  function NNLayerPreviewSVG({
    width,
    height,
    SIDEBAR_PREVIEW_SCALE,
    svgAttributes,
  }: SVGComponentProps) {
    const sw = width * (SIDEBAR_PREVIEW_SCALE ?? 1)
    const sh = height * (SIDEBAR_PREVIEW_SCALE ?? 1)
    // Header geometry mirrors `_NNLayerBase.tsx`: stereotype line at
    // y=18, name at y=38, divider at y=50. Below the divider we centre
    // the icon in the remaining space so the preview is a faithful
    // miniature of the canvas card.
    const headerHeight = 50
    const availableIconHeight = Math.max(0, height - headerHeight - 6)
    const iconSize = Math.min(80, width - 24, availableIconHeight)
    const showIcon = !!iconFile && iconSize >= 18
    const iconX = (width - iconSize) / 2
    const iconY = headerHeight + (availableIconHeight - iconSize) / 2
    return (
      <svg
        width={sw}
        height={sh}
        viewBox={`0 0 ${width} ${height}`}
        overflow="visible"
        {...svgAttributes}
      >
        <rect
          x={0}
          y={0}
          width={width}
          height={height}
          rx={6}
          ry={6}
          fill={fill}
          stroke="var(--besser-primary-contrast, #000)"
          strokeWidth={1.5}
        />
        <text
          x={width / 2}
          y={18}
          textAnchor="middle"
          fontSize={11}
          fill="var(--besser-primary-contrast, #000)"
        >
          {`«${kindLabel}»`}
        </text>
        <text
          x={width / 2}
          y={38}
          textAnchor="middle"
          fontSize={13}
          fontWeight="600"
          fill="var(--besser-primary-contrast, #000)"
        >
          {defaultName}
        </text>
        {height > headerHeight + 4 && (
          <line
            x1={0}
            x2={width}
            y1={headerHeight}
            y2={headerHeight}
            stroke="var(--besser-primary-contrast, #000)"
            strokeWidth={1}
          />
        )}
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
    )
  }

export const Conv1DLayerSVG = buildLayerPreview(
  "Conv1D",
  "Conv1D",
  "#FFF8E1",
  "conv1d.png"
)
export const Conv2DLayerSVG = buildLayerPreview(
  "Conv2D",
  "Conv2D",
  "#FFF8E1",
  "conv2d.png"
)
export const Conv3DLayerSVG = buildLayerPreview(
  "Conv3D",
  "Conv3D",
  "#FFF8E1",
  "conv3d.png"
)
export const PoolingLayerSVG = buildLayerPreview(
  "PoolingLayer",
  "Pooling",
  "#E0F7FA",
  "pooling.png"
)
export const RNNLayerSVG = buildLayerPreview(
  "RNNLayer",
  "RNN",
  "#E8EAF6",
  "rnn.png"
)
export const LSTMLayerSVG = buildLayerPreview(
  "LSTMLayer",
  "LSTM",
  "#E8EAF6",
  "lstm.png"
)
export const GRULayerSVG = buildLayerPreview(
  "GRULayer",
  "GRU",
  "#E8EAF6",
  "gru.png"
)
export const LinearLayerSVG = buildLayerPreview(
  "LinearLayer",
  "Linear",
  "#F3E5F5",
  "linear.png"
)
export const FlattenLayerSVG = buildLayerPreview(
  "FlattenLayer",
  "Flatten",
  "#F3E5F5",
  "flatten.png"
)
export const EmbeddingLayerSVG = buildLayerPreview(
  "EmbeddingLayer",
  "Embedding",
  "#F3E5F5",
  "embedding.png"
)
export const DropoutLayerSVG = buildLayerPreview(
  "DropoutLayer",
  "Dropout",
  "#F3E5F5",
  "dropout.png"
)
export const LayerNormalizationLayerSVG = buildLayerPreview(
  "LayerNormalizationLayer",
  "LayerNorm",
  "#E1F5FE",
  "layernorm.png"
)
export const BatchNormalizationLayerSVG = buildLayerPreview(
  "BatchNormalizationLayer",
  "BatchNorm",
  "#E1F5FE",
  "batchnorm.png"
)
export const TensorOpSVG = buildLayerPreview(
  "TensorOp",
  "TensorOp",
  "#FFF3E0",
  "tensorop.png"
)
export const ConfigurationSVG = buildLayerPreview(
  "Configuration",
  "Configuration",
  "#FCE4EC",
  "configuration.png"
)
export const TrainingDatasetSVG = buildLayerPreview(
  "TrainingDataset",
  "Training",
  "#E8F5E9",
  "train_data.png"
)
export const TestDatasetSVG = buildLayerPreview(
  "TestDataset",
  "Test",
  "#FFEBEE",
  "test_data.png"
)

export const NNContainerSVG: React.FC<SVGComponentProps> = ({
  width,
  height,
  SIDEBAR_PREVIEW_SCALE,
  svgAttributes,
}) => {
  const sw = width * (SIDEBAR_PREVIEW_SCALE ?? 1)
  const sh = height * (SIDEBAR_PREVIEW_SCALE ?? 1)
  return (
    <svg
      width={sw}
      height={sh}
      viewBox={`0 0 ${width} ${height}`}
      overflow="visible"
      {...svgAttributes}
    >
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        rx={8}
        fill="#F5F5F5"
        stroke="var(--besser-primary-contrast, #000)"
        strokeWidth={1.5}
      />
      <text
        x={width / 2}
        y={20}
        textAnchor="middle"
        fontSize={13}
        fontWeight="600"
        fill="var(--besser-primary-contrast, #000)"
      >
        NNContainer
      </text>
      <line
        x1={0}
        x2={width}
        y1={28}
        y2={28}
        stroke="var(--besser-primary-contrast, #000)"
      />
      {/* hint of two stacked layers */}
      <rect
        x={20}
        y={40}
        width={width - 40}
        height={18}
        rx={4}
        fill="white"
        stroke="#999"
      />
      <rect
        x={20}
        y={66}
        width={width - 40}
        height={18}
        rx={4}
        fill="white"
        stroke="#999"
      />
    </svg>
  )
}

export const NNReferenceSVG: React.FC<SVGComponentProps> = ({
  width,
  height,
  SIDEBAR_PREVIEW_SCALE,
  svgAttributes,
}) => {
  const sw = width * (SIDEBAR_PREVIEW_SCALE ?? 1)
  const sh = height * (SIDEBAR_PREVIEW_SCALE ?? 1)
  return (
    <svg
      width={sw}
      height={sh}
      viewBox={`0 0 ${width} ${height}`}
      overflow="visible"
      {...svgAttributes}
    >
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        rx={4}
        fill="#FFFDE7"
        stroke="var(--besser-primary-contrast, #000)"
        strokeDasharray="4 2"
        strokeWidth={1.2}
      />
      <text
        x={width / 2}
        y={height / 2 + 4}
        textAnchor="middle"
        fontSize={11}
        fontStyle="italic"
        fill="var(--besser-primary-contrast, #000)"
      >
        → Reference
      </text>
    </svg>
  )
}
