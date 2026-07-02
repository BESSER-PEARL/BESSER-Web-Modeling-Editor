import { FC, useId } from "react"
import { ClassType } from "@/types"
import { CustomText } from "./CustomText"
import { LAYOUT } from "@/constants"

interface HeaderSectionProps {
  showStereotype: boolean
  /** Widened to string for freeform stereotypes. */
  stereotype?: string
  name: string
  width: number
  headerHeight: number
  /** Explicit italic flag — caller can derive from stereotype identity. */
  isItalic?: boolean
  isUnderlined?: boolean
  textColor?: string
  fill?: string
  /**
   * Horizontal alignment of the stereotype/name text.
   * `"middle"` (default) centers the text on the node — the box always
   * auto-grows to fit the longest row (see `calculateMinWidth`), so a
   * centered header reads correctly for short, single-string names like
   * a Class name.
   * `"start"` left-aligns the text against the header's left padding
   * instead, so the (already-present) clipPath truncates only the END
   * of an overlong name — matches how attribute/method rows render (see
   * `RowBlockSection`). Use this for headers whose label concatenates
   * multiple parts into one longer string (e.g. ObjectName's
   * `name : ClassName`), where centering would clip equally from BOTH
   * ends and leave only the middle of the string visible.
   */
  align?: "start" | "middle"
}

export const HeaderSection: FC<HeaderSectionProps> = ({
  showStereotype,
  stereotype,
  name,
  width,
  headerHeight,
  isItalic,
  isUnderlined = false,
  textColor,
  fill = "var(--besser-background, white)",
  align = "middle",
}) => {
  // Falls back to stereotype-derived italic when caller doesn't pass the flag.
  const italic = isItalic ?? stereotype === ClassType.Abstract
  // SVG ids must not contain the colons React's useId emits.
  const clipId = `header-clip-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`
  const textX = align === "start" ? LAYOUT.DEFAULT_PADDING : width / 2
  return (
    <>
      <rect
        x={LAYOUT.LINE_WIDTH / 2}
        y={LAYOUT.LINE_WIDTH / 2}
        width={width - LAYOUT.LINE_WIDTH}
        height={headerHeight - LAYOUT.LINE_WIDTH / 2}
        fill={fill}
      />
      {/* Long names (e.g. "instance : SomeVeryLongClassName" palette
          previews) must mask at the box edge instead of spilling out —
          the root svg renders with overflow="visible" for handles. */}
      <clipPath id={clipId}>
        <rect
          x={LAYOUT.LINE_WIDTH / 2}
          y={LAYOUT.LINE_WIDTH / 2}
          width={width - LAYOUT.LINE_WIDTH}
          height={headerHeight - LAYOUT.LINE_WIDTH / 2}
        />
      </clipPath>
      <CustomText
        clipPath={`url(#${clipId})`}
        x={textX}
        y={headerHeight / 2}
        dominantBaseline="middle"
        textAnchor={align}
        fontWeight="bold"
        textDecoration={isUnderlined ? "underline" : "normal"}
        fill={textColor}
      >
        {showStereotype && (
          <tspan x={textX} dy="-8" fontSize="85%">
            {`«${stereotype}»`}
          </tspan>
        )}
        {/*
         * Explicitly forward `textDecoration` to the inner
         * tspan as well. SVG inheritance from the parent <text> works
         * in modern browsers, but Chromium has historically dropped
         * `text-decoration: underline` on tspans when the parent also
         * specifies a `dy` offset. Mirroring v3 `UMLUserModelName`
         * (and ObjectName), we want the name underlined whether or
         * not a stereotype line precedes it. Setting it directly on
         * the tspan guarantees consistent rendering across both
         * `ObjectName` (header always underlined) and the
         * `UserModelName` (delegates to ObjectNameSVG with the same
         * `isUnderlined={true}` prop).
         */}
        <tspan
          x={textX}
          dy={showStereotype ? "18" : "0"}
          fontStyle={italic ? "italic" : "normal"}
          textDecoration={isUnderlined ? "underline" : "normal"}
        >
          {name}
        </tspan>
      </CustomText>
    </>
  )
}
