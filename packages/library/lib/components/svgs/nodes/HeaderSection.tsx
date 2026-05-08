import { FC } from "react"
import { ClassType } from "@/types"
import { CustomText } from "./CustomText"
import { LAYOUT } from "@/constants"

interface HeaderSectionProps {
  showStereotype: boolean
  stereotype?: ClassType
  name: string
  width: number
  headerHeight: number
  isUnderlined?: boolean
  textColor?: string
  fill?: string
}

export const HeaderSection: FC<HeaderSectionProps> = ({
  showStereotype,
  stereotype,
  name,
  width,
  headerHeight,
  isUnderlined = false,
  textColor,
  fill = "var(--besser-background, white)",
}) => {
  return (
    <>
      <rect
        x={LAYOUT.LINE_WIDTH / 2}
        y={LAYOUT.LINE_WIDTH / 2}
        width={width - LAYOUT.LINE_WIDTH}
        height={headerHeight - LAYOUT.LINE_WIDTH / 2}
        fill={fill}
      />
      <CustomText
        x={width / 2}
        y={headerHeight / 2}
        dominantBaseline="middle"
        textAnchor="middle"
        fontWeight="bold"
        textDecoration={isUnderlined ? "underline" : "normal"}
        fill={textColor}
      >
        {showStereotype && (
          <tspan x={width / 2} dy="-8" fontSize="85%">
            {`«${stereotype}»`}
          </tspan>
        )}
        {/*
         * SA-2.2 #35: explicitly forward `textDecoration` to the inner
         * tspan as well. SVG inheritance from the parent <text> works
         * in modern browsers, but Chromium has historically dropped
         * `text-decoration: underline` on tspans when the parent also
         * specifies a `dy` offset. Mirroring v3 `UMLUserModelName`
         * (and ObjectName), we want the name underlined whether or
         * not a stereotype line precedes it. Setting it directly on
         * the tspan guarantees consistent rendering across both
         * `ObjectName` (header always underlined) and the SA-4
         * `UserModelName` (delegates to ObjectNameSVG with the same
         * `isUnderlined={true}` prop).
         */}
        <tspan
          x={width / 2}
          dy={showStereotype ? "18" : "0"}
          fontStyle={stereotype === ClassType.Abstract ? "italic" : "normal"}
          textDecoration={isUnderlined ? "underline" : "normal"}
        >
          {name}
        </tspan>
      </CustomText>
    </>
  )
}
