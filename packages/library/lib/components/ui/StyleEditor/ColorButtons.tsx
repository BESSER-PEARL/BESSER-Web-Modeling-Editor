import React from "react"
import { useTranslation } from "@/i18n"

interface ColorButtonsProps {
  onSelect: (color: string) => void
  /** Current colour; its swatch is marked pressed. */
  selectedColor?: string
}

// [hex, `stylePane.colors.<key>`, English fallback] — accessible swatch names.
const COLOR_PALETTE: [string, string, string][] = [
  ["#fc5c65", "red", "Red"],
  ["#fd9644", "orange", "Orange"],
  ["#fed330", "yellow", "Yellow"],
  ["#26de81", "green", "Green"],
  ["#2bcbba", "teal", "Teal"],
  ["#45aaf2", "skyBlue", "Sky blue"],
  ["#4b7bec", "blue", "Blue"],
  ["#6a89cc", "slateBlue", "Slate blue"],
  ["#a55eea", "purple", "Purple"],
  ["#d1d8e0", "lightGray", "Light gray"],
  ["#778ca3", "gray", "Gray"],
  ["#000000", "black", "Black"],
]

export const ColorButtons: React.FC<ColorButtonsProps> = ({
  onSelect,
  selectedColor,
}) => {
  const { t } = useTranslation()
  return (
    <div
      style={{
        display: "flex",
        flex: 1,
        flexWrap: "wrap",
        gap: 20,
        justifyContent: "center",
      }}
    >
      {COLOR_PALETTE.map(([color, key, fallback]) => (
        <ColorButton
          key={color}
          color={color}
          onSelect={onSelect}
          label={t(`stylePane.colors.${key}`, fallback)}
          pressed={selectedColor?.toLowerCase() === color}
        />
      ))}
    </div>
  )
}

interface ColorButtonProps {
  color: string
  onSelect: (color: string) => void
  label?: string
  pressed?: boolean
}

export const ColorButton = ({
  color,
  onSelect,
  label,
  pressed,
}: ColorButtonProps) => (
  <button
    type="button"
    className="besser-color-swatch"
    onClick={() => onSelect(color)}
    aria-label={label}
    aria-pressed={pressed}
    style={{
      width: 28,
      height: 28,
      borderRadius: "50%",
      border: "none",
      cursor: "pointer",
      backgroundColor: color,
    }}
  ></button>
)
