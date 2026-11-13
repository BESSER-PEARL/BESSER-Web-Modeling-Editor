import React from "react"
import { StateBodyRow } from "@/types"

/**
 * The drawing of a state machine `State`, shared by the canvas node and its
 * palette preview: a rounded UML state with a tinted header (optional
 * «stereotype» above the name) and one compartment per body kind. Each row
 * names the action it runs, after a muted `entry /` (body: runs when a
 * transition enters the state) or `fallback /` (runs on an error) keyword.
 */

export const STATE_ROW_HEIGHT = 30
export const STATE_CORNER_RADIUS = 12

const MONO_FONT =
  "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace"
const MUTED = "var(--besser-gray-variant, #64748b)"

export interface StateShapeProps {
  width: number
  height: number
  headerHeight: number
  name: string
  stereotype?: string
  italic?: boolean
  underline?: boolean
  bodies: StateBodyRow[]
  fallbackBodies: StateBodyRow[]
  fillColor: string
  strokeColor: string
  textColor: string
  /** Distinguishes the clip path ids of the canvas node and its preview. */
  clipId: string
}

const Row = ({
  row,
  y,
  width,
  keyword,
  textColor,
}: {
  row: StateBodyRow
  y: number
  width: number
  keyword: string
  textColor: string
}) => (
  <foreignObject x={0} y={y} width={width} height={STATE_ROW_HEIGHT}>
    <div
      title={row.name ?? ""}
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 6,
        height: STATE_ROW_HEIGHT,
        lineHeight: `${STATE_ROW_HEIGHT}px`,
        padding: "0 12px",
        boxSizing: "border-box",
        whiteSpace: "nowrap",
        overflow: "hidden",
        backgroundColor: row.fillColor || undefined,
      }}
    >
      <span style={{ flex: "0 0 auto", fontSize: 11, color: MUTED }}>
        {keyword} /
      </span>
      <span
        style={{
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          fontFamily: MONO_FONT,
          fontSize: 12.5,
          color: row.textColor || textColor,
        }}
      >
        {row.name ?? ""}
      </span>
    </div>
  </foreignObject>
)

export const StateShape: React.FC<StateShapeProps> = ({
  width,
  height,
  headerHeight,
  name,
  stereotype,
  italic,
  underline,
  bodies,
  fallbackBodies,
  fillColor,
  strokeColor,
  textColor,
  clipId,
}) => {
  const hasRows = bodies.length + fallbackBodies.length > 0
  const fallbackY = headerHeight + bodies.length * STATE_ROW_HEIGHT
  const hairline = `color-mix(in srgb, ${strokeColor} 35%, transparent)`
  const nameY = stereotype ? headerHeight / 2 + 10 : headerHeight / 2 + 5.5

  return (
    <>
      <defs>
        <clipPath id={clipId}>
          <rect
            width={width}
            height={height}
            rx={STATE_CORNER_RADIUS}
            ry={STATE_CORNER_RADIUS}
          />
        </clipPath>
      </defs>
      <rect
        width={width}
        height={height}
        rx={STATE_CORNER_RADIUS}
        ry={STATE_CORNER_RADIUS}
        fill={fillColor}
      />
      {hasRows && (
        <rect
          width={width}
          height={headerHeight}
          clipPath={`url(#${clipId})`}
          fill={`color-mix(in srgb, ${textColor} 5%, transparent)`}
        />
      )}
      {stereotype && (
        <text
          x={width / 2}
          y={headerHeight / 2 - 7}
          textAnchor="middle"
          fontSize={12}
          fill={MUTED}
        >
          {`«${stereotype}»`}
        </text>
      )}
      <text
        x={width / 2}
        y={nameY}
        textAnchor="middle"
        fontSize={15}
        fontWeight={600}
        fontStyle={italic ? "italic" : undefined}
        textDecoration={underline ? "underline" : undefined}
        fill={textColor}
      >
        {name}
      </text>
      {hasRows && (
        <line
          x1={0}
          x2={width}
          y1={headerHeight}
          y2={headerHeight}
          stroke={hairline}
        />
      )}
      {bodies.map((row, i) => (
        <Row
          key={row.id}
          row={row}
          y={headerHeight + i * STATE_ROW_HEIGHT}
          width={width}
          keyword="entry"
          textColor={textColor}
        />
      ))}
      {fallbackBodies.length > 0 && bodies.length > 0 && (
        <line
          x1={0}
          x2={width}
          y1={fallbackY}
          y2={fallbackY}
          stroke={hairline}
          strokeDasharray="4 3"
        />
      )}
      {fallbackBodies.map((row, i) => (
        <Row
          key={row.id}
          row={row}
          y={fallbackY + i * STATE_ROW_HEIGHT}
          width={width}
          keyword="fallback"
          textColor={textColor}
        />
      ))}
      <rect
        x={0.75}
        y={0.75}
        width={width - 1.5}
        height={height - 1.5}
        rx={STATE_CORNER_RADIUS}
        ry={STATE_CORNER_RADIUS}
        fill="none"
        stroke={strokeColor}
        strokeWidth={1.5}
      />
    </>
  )
}

export const CODE_BLOCK_HEADER_HEIGHT = 24

const CODE_LANGUAGE_LABELS: Record<string, string> = {
  python: "Python",
  bal: "BAL",
}

export interface StateCodeBlockShapeProps {
  width: number
  height: number
  code: string
  language: string
  fillColor: string
  strokeColor: string
  textColor: string
  clipId: string
}

/** The drawing of a `StateCodeBlock` (canvas node and palette preview). */
export const StateCodeBlockShape: React.FC<StateCodeBlockShapeProps> = ({
  width,
  height,
  code,
  language,
  fillColor,
  strokeColor,
  textColor,
  clipId,
}) => (
  <>
    <defs>
      <clipPath id={clipId}>
        <rect width={width} height={height} rx={STATE_CORNER_RADIUS} ry={STATE_CORNER_RADIUS} />
      </clipPath>
    </defs>
    <rect width={width} height={height} rx={STATE_CORNER_RADIUS} ry={STATE_CORNER_RADIUS} fill={fillColor} />
    <rect
      width={width}
      height={CODE_BLOCK_HEADER_HEIGHT}
      clipPath={`url(#${clipId})`}
      fill={`color-mix(in srgb, ${textColor} 6%, transparent)`}
    />
    <text
      x={12}
      y={CODE_BLOCK_HEADER_HEIGHT / 2 + 4}
      fontSize={10.5}
      fontWeight={600}
      letterSpacing={0.6}
      fill={MUTED}
    >
      {(CODE_LANGUAGE_LABELS[language] ?? language).toUpperCase()}
    </text>
    <line
      x1={0}
      x2={width}
      y1={CODE_BLOCK_HEADER_HEIGHT}
      y2={CODE_BLOCK_HEADER_HEIGHT}
      stroke={`color-mix(in srgb, ${strokeColor} 35%, transparent)`}
    />
    <foreignObject
      x={0}
      y={CODE_BLOCK_HEADER_HEIGHT}
      width={width}
      height={Math.max(0, height - CODE_BLOCK_HEADER_HEIGHT)}
    >
      <div
        style={{
          height: "100%",
          overflow: "hidden",
          padding: "6px 12px",
          boxSizing: "border-box",
          fontFamily: MONO_FONT,
          fontSize: 12.5,
          lineHeight: "17px",
          color: textColor,
          whiteSpace: "pre",
        }}
      >
        {code.replace(/\t/g, "    ")}
      </div>
    </foreignObject>
    <rect
      x={0.5}
      y={0.5}
      width={width - 1}
      height={height - 1}
      rx={STATE_CORNER_RADIUS}
      ry={STATE_CORNER_RADIUS}
      fill="none"
      stroke={`color-mix(in srgb, ${strokeColor} 55%, transparent)`}
    />
  </>
)
