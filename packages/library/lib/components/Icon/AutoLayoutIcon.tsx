interface Props {
  width?: number
  height?: number
  fill?: string
}

export const AutoLayoutIcon = ({ width = 16, height = 16, fill = "currentColor" }: Props) => (
  <svg width={width} height={height} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="9" y="2" width="6" height="5" rx="1" stroke={fill} strokeWidth="2" />
    <rect x="2" y="17" width="6" height="5" rx="1" stroke={fill} strokeWidth="2" />
    <rect x="16" y="17" width="6" height="5" rx="1" stroke={fill} strokeWidth="2" />
    <path d="M12 7v4M12 11H5v6M12 11h7v6" stroke={fill} strokeWidth="2" strokeLinecap="round" />
  </svg>
)
