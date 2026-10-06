interface Props {
  children: React.ReactNode
  isSelected: boolean
  onClick: () => void
  style?: React.CSSProperties
}

/**
 * Toggle button for a segmented group (`.bp-segmented`). Pressed state is
 * exposed as `aria-pressed` and styled by `.bp-toggle` in app.css.
 */
export const PrimaryButton: React.FC<Props> = ({
  children,
  isSelected,
  onClick,
  style,
}) => {
  return (
    <button
      type="button"
      className="bp-toggle"
      aria-pressed={isSelected}
      style={style}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
