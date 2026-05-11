import { SVGComponentProps } from "@/types/SVG"
import { AgentStateBodyRow, AgentStateNodeProps } from "@/types"

/**
 * Lightweight palette previews for AgentDiagram. Mirror the
 * minimum visual of each canvas node — they exist purely to populate
 * the sidebar drag-source. Plain SVG; no themed wrappers.
 */

type AgentStateSVGProps = SVGComponentProps & {
  data?: Partial<AgentStateNodeProps> & {
    name?: string
    bodies?: AgentStateBodyRow[]
    fallbackBodies?: AgentStateBodyRow[]
  }
}

const HEADER_HEIGHT = 40
const ROW_HEIGHT = 30

export const AgentStateSVG: React.FC<AgentStateSVGProps> = ({
  width,
  height,
  SIDEBAR_PREVIEW_SCALE,
  svgAttributes,
  data,
}) => {
  const sw = width * (SIDEBAR_PREVIEW_SCALE ?? 1)
  const sh = height * (SIDEBAR_PREVIEW_SCALE ?? 1)
  const stateName = data?.name ?? "AgentState"
  const bodies = data?.bodies ?? []
  const fallbackBodies = data?.fallbackBodies ?? []
  const hasAnyBody = bodies.length > 0 || fallbackBodies.length > 0
  const fallbackDividerY = HEADER_HEIGHT + bodies.length * ROW_HEIGHT
  const hasFallbackDivider = fallbackBodies.length > 0 && bodies.length > 0
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
        fill="var(--besser-background, white)"
        stroke="var(--besser-primary-contrast, #000)"
        strokeWidth={2}
      />
      <text
        x={width / 2}
        y={26}
        textAnchor="middle"
        fontSize={14}
        fontWeight="600"
        fill="var(--besser-primary-contrast, #000)"
      >
        {stateName}
      </text>
      {hasAnyBody && (
        <line
          x1={0}
          x2={width}
          y1={HEADER_HEIGHT}
          y2={HEADER_HEIGHT}
          stroke="var(--besser-primary-contrast, #000)"
          strokeWidth={1}
        />
      )}
      {bodies.map((b, i) => (
        <text
          key={b.id}
          x={10}
          y={HEADER_HEIGHT + i * ROW_HEIGHT + 19}
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
          y={fallbackDividerY + i * ROW_HEIGHT + 19}
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
        stroke="var(--besser-primary-contrast, #000)"
        strokeWidth={1.2}
      />
      <text
        x={width / 2}
        y={26}
        textAnchor="middle"
        fontSize={14}
        fontWeight="600"
        fill="var(--besser-primary-contrast, #000)"
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
      {/*
        Palette ghost mirrors the canvas component —
        "RAG DB" stereotype line near the top ellipse PLUS the resolved
        display name ("RAG" by default) below it. Without the second line
        the drag ghost looked empty under the cylinder.
      */}
      <text
        x={width / 2}
        y={height / 2 - 2}
        textAnchor="middle"
        fontSize={11}
        fontStyle="italic"
        fill="var(--besser-primary-contrast, #000)"
      >
        RAG DB
      </text>
      <text
        x={width / 2}
        y={height / 2 + 14}
        textAnchor="middle"
        fontSize={12}
        fontWeight="600"
        fill="var(--besser-primary-contrast, #000)"
      >
        RAG
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
        fill="var(--besser-background, white)"
        stroke="var(--besser-primary-contrast, #000)"
        strokeWidth={1.5}
      />
      <text
        x={width / 2}
        y={height / 2 + 5}
        textAnchor="middle"
        fontSize={12}
        fill="var(--besser-primary-contrast, #000)"
      >
        slot:entity
      </text>
    </svg>
  )
}
