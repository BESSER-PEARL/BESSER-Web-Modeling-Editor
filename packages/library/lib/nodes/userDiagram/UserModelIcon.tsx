import { NodeProps, type Node } from "@xyflow/react"
import { useRef } from "react"
import { DefaultNodeWrapper } from "../wrappers"
import { PopoverManager } from "@/components/popovers/PopoverManager"
import { UserModelIconNodeProps } from "@/types"
import { getCustomColorsFromData } from "@/utils/layoutUtils"

/**
 * `UserModelIcon`. Small visual marker attached to a
 * `UserModelName`. v3 source: `user-modeling/uml-user-model-icon/`. The
 * icon itself is stored as inline SVG body (or a data URL) on
 * `data.icon`; this component renders it inside a `foreignObject` so
 * arbitrary SVG content works.
 */
export function UserModelIcon({
  id,
  width,
  height,
  data,
}: NodeProps<Node<UserModelIconNodeProps>>) {
  const wrapperRef = useRef<HTMLDivElement | null>(null)

  if (!width || !height) return null

  const { fillColor } = getCustomColorsFromData(data)
  const { icon } = data

  return (
    <DefaultNodeWrapper
      width={width}
      height={height}
      elementId={id}
      hiddenHandles={[]}
    >
      <div ref={wrapperRef}>
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          overflow="visible"
        >
          <rect
            x={0}
            y={0}
            width={width}
            height={height}
            fill={fillColor}
            stroke="none"
          />
          {icon ? (
            icon.startsWith("data:") || icon.startsWith("http") ? (
              <image href={icon} x={0} y={0} width={width} height={height} />
            ) : (
              <foreignObject x={0} y={0} width={width} height={height}>
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  dangerouslySetInnerHTML={{ __html: icon }}
                />
              </foreignObject>
            )
          ) : (
            <text
              x={width / 2}
              y={height / 2 + 5}
              textAnchor="middle"
              fontSize={14}
              fill="currentColor"
              opacity={0.4}
            >
              icon
            </text>
          )}
        </svg>
      </div>
      <PopoverManager
        anchorEl={wrapperRef.current}
        elementId={id}
        type={"UserModelIcon" as const}
      />
    </DefaultNodeWrapper>
  )
}
