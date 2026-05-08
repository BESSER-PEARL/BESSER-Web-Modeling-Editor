import { SVGComponentProps } from "@/types/SVG"

/**
 * SA-4 lightweight palette previews for AgentDiagram. Mirror the
 * minimum visual of each canvas node — they exist purely to populate
 * the sidebar drag-source. Plain SVG; no themed wrappers.
 */

export const AgentStateSVG: React.FC<SVGComponentProps> = ({
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
        ry={8}
        fill="var(--apollon-background, white)"
        stroke="var(--apollon-primary-contrast, #000)"
        strokeWidth={2}
      />
      <text
        x={width / 2}
        y={26}
        textAnchor="middle"
        fontSize={14}
        fontWeight="600"
        fill="var(--apollon-primary-contrast, #000)"
      >
        AgentState
      </text>
    </svg>
  )
}

export const AgentIntentSVG: React.FC<SVGComponentProps> = ({
  width,
  height,
  SIDEBAR_PREVIEW_SCALE,
  svgAttributes,
}) => {
  const sw = width * (SIDEBAR_PREVIEW_SCALE ?? 1)
  const sh = (height + 30) * (SIDEBAR_PREVIEW_SCALE ?? 1)
  return (
    <svg
      width={sw}
      height={sh}
      viewBox={`0 0 ${width} ${height + 30}`}
      overflow="visible"
      {...svgAttributes}
    >
      <path
        d={`M 0 0 H ${width} V ${height} H 30 L 0 ${height + 30} L 10 ${height} H 10 0 Z`}
        fill="#E3F9E5"
        stroke="var(--apollon-primary-contrast, #000)"
        strokeWidth={1.2}
      />
      <text
        x={width / 2}
        y={26}
        textAnchor="middle"
        fontSize={14}
        fontWeight="600"
        fill="var(--apollon-primary-contrast, #000)"
      >
        Intent
      </text>
    </svg>
  )
}

export const AgentRagElementSVG: React.FC<SVGComponentProps> = ({
  width,
  height,
  SIDEBAR_PREVIEW_SCALE,
  svgAttributes,
}) => {
  const sw = width * (SIDEBAR_PREVIEW_SCALE ?? 1)
  const sh = height * (SIDEBAR_PREVIEW_SCALE ?? 1)
  const ellipseHeight = Math.min(height * 0.3, 30)
  const radiusX = width / 2
  const radiusY = ellipseHeight / 2
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
        y={radiusY}
        width={width}
        height={height - ellipseHeight}
        fill="#E8F0FF"
        stroke="#668"
      />
      <ellipse
        cx={radiusX}
        cy={radiusY}
        rx={radiusX}
        ry={radiusY}
        fill="#E8F0FF"
        stroke="#668"
      />
      <ellipse
        cx={radiusX}
        cy={height - radiusY}
        rx={radiusX}
        ry={radiusY}
        fill="#E8F0FF"
        stroke="#668"
      />
      <text
        x={width / 2}
        y={height / 2 + 5}
        textAnchor="middle"
        fontSize={12}
        fontWeight="600"
        fill="var(--apollon-primary-contrast, #000)"
      >
        RAG DB
      </text>
    </svg>
  )
}

export const AgentIntentObjectComponentSVG: React.FC<SVGComponentProps> = ({
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
        fill="var(--apollon-background, white)"
        stroke="var(--apollon-primary-contrast, #000)"
        strokeWidth={1.5}
      />
      <text
        x={width / 2}
        y={height / 2 + 5}
        textAnchor="middle"
        fontSize={12}
        fill="var(--apollon-primary-contrast, #000)"
      >
        slot:entity
      </text>
    </svg>
  )
}
