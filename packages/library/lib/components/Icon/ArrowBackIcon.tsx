import { SVGAttributes } from "react"

type Props = SVGAttributes<SVGSVGElement>

export const ArrowBackIcon = ({ width = 24, height = 24, ...props }: Props) => (
  <svg
    width={width}
    height={height}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 -960 960 960"
    {...props}
  >
    <path d="m313-440 224 224-57 56-320-320 320-320 57 56-224 224h487v80H313Z" />
  </svg>
)
