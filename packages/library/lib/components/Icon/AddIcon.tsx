import { SVGAttributes } from "react"

type Props = SVGAttributes<SVGSVGElement>

export const AddIcon = ({
  width = 24,
  height = 24,
  fill = "var(--besser-primary-contrast, #e3e3e3)",
  ...props
}: Props) => (
  <svg
    width={width}
    height={height}
    fill={fill}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 -960 960 960"
    {...props}
  >
    <path d="M440-440H200v-80h240v-240h80v240h240v80H520v240h-80v-240Z" />
  </svg>
)
