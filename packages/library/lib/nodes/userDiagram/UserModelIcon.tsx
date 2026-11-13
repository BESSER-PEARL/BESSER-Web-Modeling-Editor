import { NodeProps, type Node } from "@xyflow/react"
import { usePopoverAnchor } from "@/hooks/usePopoverAnchor"
import { DefaultNodeWrapper } from "../wrappers"
import { PopoverManager } from "@/components/popovers/PopoverManager"
import { UserModelIconNodeProps } from "@/types"
import { getCustomColorsFromData } from "@/utils/layoutUtils"
import { IconImage } from "@/components/svgs/nodes/IconImage"

/**
 * `UserModelIcon`. Small visual marker attached to a
 * `UserModelName`. v3 source: `user-modeling/uml-user-model-icon/`. The
 * icon itself is stored as inline SVG body (or a data URL) on
 * `data.icon`; `IconImage` renders it as an image, never as markup.
 */
export function UserModelIcon({
  id,
  width,
  height,
  data,
}: NodeProps<Node<UserModelIconNodeProps>>) {
  const [wrapperEl, wrapperRef] = usePopoverAnchor<HTMLDivElement>()

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
            <IconImage
              icon={icon}
              x={0}
              y={0}
              width={width}
              height={height}
              color="var(--besser-primary-contrast)"
            />
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
        anchorEl={wrapperEl}
        elementId={id}
        type={"UserModelIcon" as const}
      />
    </DefaultNodeWrapper>
  )
}
