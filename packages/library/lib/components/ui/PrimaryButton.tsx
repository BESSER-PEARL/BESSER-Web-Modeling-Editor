interface Props {
  children: React.ReactNode
  isSelected: boolean
  onClick: () => void
  style?: React.CSSProperties
}

const buttonBaseStyle: React.CSSProperties = {
  padding: "4px 8px",
  fontWeight: 500,
  fontSize: "0.875rem",
  border: "1px solid var(--besser-primary, #3e8acc)",
  backgroundColor: "var(--besser-background, white)",
  color: "var(--besser-primary, #3e8acc)",
  cursor: "pointer",
}

export const PrimaryButton: React.FC<Props> = ({
  children,
  isSelected,
  onClick,
  style,
}) => {
  const buttonStyle: React.CSSProperties = {
    ...buttonBaseStyle,
    backgroundColor: isSelected
      ? "var(--besser-primary, #3e8acc)"
      : "var(--besser-background, white)",
    color: isSelected
      ? "var(--besser-background, white)"
      : "var(--besser-primary, #3e8acc)",
    ...style,
  }

  return (
    <button style={buttonStyle} onClick={onClick}>
      {children}
    </button>
  )
}
