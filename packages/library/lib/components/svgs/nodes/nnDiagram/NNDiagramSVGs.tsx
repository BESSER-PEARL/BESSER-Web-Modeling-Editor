import { SVGComponentProps } from "@/types/SVG"

/**
 * SA-5 lightweight palette previews for NNDiagram. Each palette item
 * mirrors the canvas card's basic shape — kind label header + a
 * placeholder body — so the sidebar drag-source matches the dropped
 * appearance closely enough for users to recognise the kind.
 *
 * Plain SVG; no themed wrappers (per `/CLAUDE.md` "Custom SVG
 * Rendering" guidance).
 */

const buildLayerPreview = (label: string, fill: string) =>
  function NNLayerPreviewSVG({
    width,
    height,
    SIDEBAR_PREVIEW_SCALE,
    svgAttributes,
  }: SVGComponentProps) {
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
          rx={6}
          ry={6}
          fill={fill}
          stroke="var(--besser-primary-contrast, #000)"
          strokeWidth={1.5}
        />
        <text
          x={width / 2}
          y={height / 2 + 4}
          textAnchor="middle"
          fontSize={12}
          fontWeight="600"
          fill="var(--besser-primary-contrast, #000)"
        >
          {label}
        </text>
      </svg>
    )
  }

export const Conv1DLayerSVG = buildLayerPreview("Conv1D", "#FFF8E1")
export const Conv2DLayerSVG = buildLayerPreview("Conv2D", "#FFF8E1")
export const Conv3DLayerSVG = buildLayerPreview("Conv3D", "#FFF8E1")
export const PoolingLayerSVG = buildLayerPreview("Pooling", "#E0F7FA")
export const RNNLayerSVG = buildLayerPreview("RNN", "#E8EAF6")
export const LSTMLayerSVG = buildLayerPreview("LSTM", "#E8EAF6")
export const GRULayerSVG = buildLayerPreview("GRU", "#E8EAF6")
export const LinearLayerSVG = buildLayerPreview("Linear", "#F3E5F5")
export const FlattenLayerSVG = buildLayerPreview("Flatten", "#F3E5F5")
export const EmbeddingLayerSVG = buildLayerPreview("Embedding", "#F3E5F5")
export const DropoutLayerSVG = buildLayerPreview("Dropout", "#F3E5F5")
export const LayerNormalizationLayerSVG = buildLayerPreview(
  "LayerNorm",
  "#E1F5FE"
)
export const BatchNormalizationLayerSVG = buildLayerPreview(
  "BatchNorm",
  "#E1F5FE"
)
export const TensorOpSVG = buildLayerPreview("TensorOp", "#FFF3E0")
export const ConfigurationSVG = buildLayerPreview("Configuration", "#FCE4EC")
export const TrainingDatasetSVG = buildLayerPreview("Training", "#E8F5E9")
export const TestDatasetSVG = buildLayerPreview("Test", "#FFEBEE")

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
