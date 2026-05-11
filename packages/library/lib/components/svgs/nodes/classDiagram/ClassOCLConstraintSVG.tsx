/**
 * Sticky-note palette preview for the
 * `ClassOCLConstraint` node type. Mirrors the canvas rendering at
 * `lib/nodes/classDiagram/ClassOCLConstraint.tsx`: outer rect with a
 * folded top-right corner, header line for the constraint name, and a
 * single-line preview placeholder for the expression body.
 *
 * Source-of-truth port:
 *   `packages/editor/.../uml-class-ocl/uml-class-ocl-constraint-component.tsx`
 */
import { SVGAttributes } from "react"
import { ClassOCLConstraintNodeProps } from "@/types"

export type ClassOCLConstraintSVGProps = {
  width: number
  height: number
  data: ClassOCLConstraintNodeProps
  SIDEBAR_PREVIEW_SCALE?: number
  svgAttributes?: SVGAttributes<SVGElement>
}

export function ClassOCLConstraintSVG({
  width,
  height,
  data,
  svgAttributes,
  SIDEBAR_PREVIEW_SCALE,
}: ClassOCLConstraintSVGProps) {
  const scaledWidth = width * (SIDEBAR_PREVIEW_SCALE ?? 1)
  const scaledHeight = height * (SIDEBAR_PREVIEW_SCALE ?? 1)
  const fold = 12
  const padding = 10
  const fillColor = data?.fillColor || "#fff8c4"
  const strokeColor = data?.strokeColor || "#bda21f"
  const textColor = data?.textColor || "#3a2e00"
  const name = data?.name || "constraint"

  return (
    <svg
      width={scaledWidth}
      height={scaledHeight}
      viewBox={`0 0 ${width} ${height}`}
      overflow="visible"
      {...svgAttributes}
    >
      <path
        d={`M 0 0 L ${width - fold} 0 L ${width} ${fold} L ${width} ${height} L 0 ${height} Z`}
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth={1.2}
      />
      <path
        d={`M ${width - fold} 0 L ${width - fold} ${fold} L ${width} ${fold}`}
        fill="none"
        stroke={strokeColor}
        strokeWidth={1.2}
      />
      <text
        x={padding}
        y={padding + 4}
        fill={textColor}
        style={{
          fontSize: "11px",
          fontWeight: 600,
          dominantBaseline: "hanging",
        }}
      >
        {name}
      </text>
      <text
        x={padding}
        y={padding + 22}
        fill={textColor}
        style={{
          fontSize: "10px",
          fontStyle: "italic",
          dominantBaseline: "hanging",
        }}
      >
        «inv»
      </text>
    </svg>
  )
}
