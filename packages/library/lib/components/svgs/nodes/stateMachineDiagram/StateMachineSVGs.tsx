import { useId } from "react"
import { SVGComponentProps } from "@/types/SVG"
import { StateBodyRow } from "@/types"
import { LAYOUT } from "@/constants"
import { StateCodeBlockShape, StateShape } from "./StateShape"

/**
 * Lightweight palette previews for StateMachineDiagram. Mirror the
 * minimum visual of each canvas node — they exist purely to populate
 * the sidebar drag-source. Drawn in plain SVG without the SVG-themed
 * wrappers per the brief.
 */

type StateSVGProps = SVGComponentProps & {
  /** Palette `defaultData` (Sidebar passes it through): name and rows. */
  data?: {
    name?: string
    bodies?: StateBodyRow[]
    fallbackBodies?: StateBodyRow[]
  }
}

export const StateSVG: React.FC<StateSVGProps> = ({
  width,
  height,
  SIDEBAR_PREVIEW_SCALE,
  svgAttributes,
  data,
}) => {
  const clipId = `state-preview-${useId().replace(/:/g, "")}`
  const scale = SIDEBAR_PREVIEW_SCALE ?? 1
  return (
    <svg
      width={width * scale}
      height={height * scale}
      viewBox={`0 0 ${width} ${height}`}
      overflow="visible"
      {...svgAttributes}
    >
      <StateShape
        width={width}
        height={height}
        headerHeight={LAYOUT.DEFAULT_HEADER_HEIGHT}
        name={data?.name ?? "State"}
        bodies={data?.bodies ?? []}
        fallbackBodies={data?.fallbackBodies ?? []}
        fillColor="var(--besser-background, white)"
        strokeColor="var(--besser-primary-contrast, #000)"
        textColor="var(--besser-primary-contrast, #000)"
        clipId={clipId}
      />
    </svg>
  )
}

export const StateInitialNodeSVG: React.FC<SVGComponentProps> = ({
  width,
  height,
  SIDEBAR_PREVIEW_SCALE,
  svgAttributes,
}) => {
  const scaledWidth = width * (SIDEBAR_PREVIEW_SCALE ?? 1)
  const scaledHeight = height * (SIDEBAR_PREVIEW_SCALE ?? 1)
  return (
    <svg
      width={scaledWidth}
      height={scaledHeight}
      viewBox={`0 0 ${width} ${height}`}
      overflow="visible"
      {...svgAttributes}
    >
      <circle
        cx={width / 2}
        cy={height / 2}
        r={Math.min(width, height) / 2}
        fill="var(--besser-primary-contrast, #000)"
      />
    </svg>
  )
}

export const StateFinalNodeSVG: React.FC<SVGComponentProps> = ({
  width,
  height,
  SIDEBAR_PREVIEW_SCALE,
  svgAttributes,
}) => {
  const scaledWidth = width * (SIDEBAR_PREVIEW_SCALE ?? 1)
  const scaledHeight = height * (SIDEBAR_PREVIEW_SCALE ?? 1)
  return (
    <svg
      width={scaledWidth}
      height={scaledHeight}
      viewBox={`0 0 ${width} ${height}`}
      overflow="visible"
      {...svgAttributes}
    >
      <circle
        cx={width / 2}
        cy={height / 2}
        r={(Math.min(width, height) / 2) * 0.9}
        fill="var(--besser-background, #ffffff)"
        stroke="var(--besser-primary-contrast, #000)"
        strokeWidth={2}
      />
      <circle
        cx={width / 2}
        cy={height / 2}
        r={(Math.min(width, height) / 2) * 0.7}
        fill="var(--besser-primary-contrast, #000)"
      />
    </svg>
  )
}

export const StateActionNodeSVG: React.FC<SVGComponentProps> = ({
  width,
  height,
  SIDEBAR_PREVIEW_SCALE,
  svgAttributes,
}) => {
  const scaledWidth = width * (SIDEBAR_PREVIEW_SCALE ?? 1)
  const scaledHeight = height * (SIDEBAR_PREVIEW_SCALE ?? 1)
  return (
    <svg
      width={scaledWidth}
      height={scaledHeight}
      viewBox={`0 0 ${width} ${height}`}
      overflow="visible"
      {...svgAttributes}
    >
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        rx={5}
        ry={5}
        fill="var(--besser-background, white)"
        stroke="var(--besser-primary-contrast, #000)"
        strokeWidth={2}
      />
      <text
        x={width / 2}
        y={height / 2 + 5}
        textAnchor="middle"
        fontSize={14}
        fill="var(--besser-primary-contrast, #000)"
      >
        Action
      </text>
    </svg>
  )
}

export const StateObjectNodeSVG: React.FC<SVGComponentProps> = ({
  width,
  height,
  SIDEBAR_PREVIEW_SCALE,
  svgAttributes,
}) => {
  const scaledWidth = width * (SIDEBAR_PREVIEW_SCALE ?? 1)
  const scaledHeight = height * (SIDEBAR_PREVIEW_SCALE ?? 1)
  return (
    <svg
      width={scaledWidth}
      height={scaledHeight}
      viewBox={`0 0 ${width} ${height}`}
      overflow="visible"
      {...svgAttributes}
    >
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill="var(--besser-background, white)"
        stroke="var(--besser-primary-contrast, #000)"
        strokeWidth={2}
      />
      <text
        x={width / 2}
        y={height / 2 + 5}
        textAnchor="middle"
        fontSize={14}
        fontWeight="bold"
        fill="var(--besser-primary-contrast, #000)"
      >
        Object
      </text>
    </svg>
  )
}

export const StateMergeNodeSVG: React.FC<SVGComponentProps> = ({
  width,
  height,
  SIDEBAR_PREVIEW_SCALE,
  svgAttributes,
}) => {
  const scaledWidth = width * (SIDEBAR_PREVIEW_SCALE ?? 1)
  const scaledHeight = height * (SIDEBAR_PREVIEW_SCALE ?? 1)
  return (
    <svg
      width={scaledWidth}
      height={scaledHeight}
      viewBox={`0 0 ${width} ${height}`}
      overflow="visible"
      {...svgAttributes}
    >
      <polygon
        points={`${width / 2},0 ${width},${height / 2} ${width / 2},${height} 0,${height / 2}`}
        fill="var(--besser-background, white)"
        stroke="var(--besser-primary-contrast, #000)"
        strokeWidth={2}
      />
    </svg>
  )
}

export const StateForkNodeSVG: React.FC<SVGComponentProps> = ({
  width,
  height,
  SIDEBAR_PREVIEW_SCALE,
  svgAttributes,
}) => {
  const scaledWidth = width * (SIDEBAR_PREVIEW_SCALE ?? 1)
  const scaledHeight = height * (SIDEBAR_PREVIEW_SCALE ?? 1)
  return (
    <svg
      width={scaledWidth}
      height={scaledHeight}
      viewBox={`0 0 ${width} ${height}`}
      overflow="visible"
      {...svgAttributes}
    >
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill="var(--besser-primary-contrast, #000)"
      />
    </svg>
  )
}

export const StateForkNodeHorizontalSVG: React.FC<SVGComponentProps> = ({
  width,
  height,
  SIDEBAR_PREVIEW_SCALE,
  svgAttributes,
}) => {
  const scaledWidth = width * (SIDEBAR_PREVIEW_SCALE ?? 1)
  const scaledHeight = height * (SIDEBAR_PREVIEW_SCALE ?? 1)
  return (
    <svg
      width={scaledWidth}
      height={scaledHeight}
      viewBox={`0 0 ${width} ${height}`}
      overflow="visible"
      {...svgAttributes}
    >
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill="var(--besser-primary-contrast, #000)"
      />
    </svg>
  )
}

export const StateCodeBlockSVG: React.FC<
  SVGComponentProps & { data?: { code?: string; language?: string } }
> = ({ width, height, SIDEBAR_PREVIEW_SCALE, svgAttributes, data }) => {
  const clipId = `code-preview-${useId().replace(/:/g, "")}`
  const scale = SIDEBAR_PREVIEW_SCALE ?? 1
  return (
    <svg
      width={width * scale}
      height={height * scale}
      viewBox={`0 0 ${width} ${height}`}
      overflow="visible"
      {...svgAttributes}
    >
      <StateCodeBlockShape
        width={width}
        height={height}
        code={data?.code ?? ""}
        language={data?.language ?? "python"}
        fillColor="var(--besser-background, white)"
        strokeColor="var(--besser-primary-contrast, #000)"
        textColor="var(--besser-primary-contrast, #000)"
        clipId={clipId}
      />
    </svg>
  )
}
