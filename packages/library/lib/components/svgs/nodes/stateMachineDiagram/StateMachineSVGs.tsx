import { SVGComponentProps } from "@/types/SVG"
import { StateBodyRow } from "@/types"

/**
 * Lightweight palette previews for StateMachineDiagram. Mirror the
 * minimum visual of each canvas node — they exist purely to populate
 * the sidebar drag-source. Drawn in plain SVG without the SVG-themed
 * wrappers per the brief.
 */

type StateSVGProps = SVGComponentProps & {
  /**
   * Optional palette `defaultData` (Sidebar passes it through). Develop
   * parity (`state-preview.ts` `stateWithBody` / `stateWithBothBodies`):
   * pre-populated variants render their body rows and — when both
   * sections are present — the dashed fallback divider.
   */
  data?: {
    name?: string
    bodies?: StateBodyRow[]
    fallbackBodies?: StateBodyRow[]
  }
}

const STATE_HEADER_HEIGHT = 40
const STATE_ROW_HEIGHT = 30

export const StateSVG: React.FC<StateSVGProps> = ({
  width,
  height,
  SIDEBAR_PREVIEW_SCALE,
  svgAttributes,
  data,
}) => {
  const scaledWidth = width * (SIDEBAR_PREVIEW_SCALE ?? 1)
  const scaledHeight = height * (SIDEBAR_PREVIEW_SCALE ?? 1)
  const stateName = data?.name ?? "State"
  const bodies = data?.bodies ?? []
  const fallbackBodies = data?.fallbackBodies ?? []
  const fallbackDividerY =
    STATE_HEADER_HEIGHT + bodies.length * STATE_ROW_HEIGHT
  const hasFallbackDivider = fallbackBodies.length > 0 && bodies.length > 0
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
        rx={8}
        ry={8}
        fill="var(--besser-background, white)"
        stroke="var(--besser-primary-contrast, #000)"
        strokeWidth={2}
      />
      <text
        x={width / 2}
        y={26}
        textAnchor="middle"
        fontSize={16}
        fontWeight="600"
        fill="var(--besser-primary-contrast, #000)"
      >
        {stateName}
      </text>
      <line
        x1={0}
        x2={width}
        y1={STATE_HEADER_HEIGHT}
        y2={STATE_HEADER_HEIGHT}
        stroke="var(--besser-primary-contrast, #000)"
      />
      {bodies.map((b, i) => (
        <text
          key={b.id}
          x={10}
          y={STATE_HEADER_HEIGHT + i * STATE_ROW_HEIGHT + 19}
          fontSize={12}
          fill="var(--besser-primary-contrast, #000)"
        >
          {b.name ?? ""}
        </text>
      ))}
      {hasFallbackDivider && (
        <line
          x1={0}
          x2={width}
          y1={fallbackDividerY}
          y2={fallbackDividerY}
          stroke="var(--besser-primary-contrast, #000)"
          strokeWidth={1}
          strokeDasharray="3 2"
          opacity={0.6}
        />
      )}
      {fallbackBodies.map((b, i) => (
        <text
          key={b.id}
          x={10}
          y={fallbackDividerY + i * STATE_ROW_HEIGHT + 19}
          fontSize={12}
          fontStyle="italic"
          fill="var(--besser-primary-contrast, #000)"
        >
          {b.name ?? ""}
        </text>
      ))}
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
        fill="white"
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

export const StateCodeBlockSVG: React.FC<SVGComponentProps> = ({
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
        rx={8}
        ry={8}
        fill="var(--besser-background, white)"
        stroke="var(--besser-primary-contrast, #000)"
        strokeWidth={1}
      />
      <rect
        x={0}
        y={0}
        width={width}
        height={20}
        rx={8}
        ry={8}
        fill="var(--besser-primary-contrast, #000)"
      />
      <text x={10} y={14} fontSize={10} fill="var(--besser-background, #ffffff)">
        python
      </text>
      {/*
        Palette preview shows a multi-line code snippet
        rather than the literal "# code" placeholder, so the drag ghost
        previews the same shape the dropped canvas card renders.
      */}
      <text
        x={10}
        y={36}
        fontSize={11}
        fontFamily="monospace"
        fill="var(--besser-primary-contrast, #000)"
      >
        <tspan x={10} dy={0}>{"# Sample code"}</tspan>
        <tspan x={10} dy={14}>{'print("Hello World")'}</tspan>
      </text>
    </svg>
  )
}
