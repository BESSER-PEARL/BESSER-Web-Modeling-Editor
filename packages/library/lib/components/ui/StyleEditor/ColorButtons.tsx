import React from "react"

interface ColorButtonsProps {
  onSelect: (color: string) => void
}

const COLOR_PALETTE = [
  "#fc5c65",
  "#fd9644",
  "#fed330",
  "#26de81",
  "#2bcbba",
  "#45aaf2",
  "#4b7bec",
  "#6a89cc",
  "#a55eea",
  "#d1d8e0",
  "#778ca3",
  "#000000",
]

export const ColorButtons: React.FC<ColorButtonsProps> = ({ onSelect }) => {
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
      {COLOR_PALETTE.map((color) => (
        <ColorButton key={color} color={color} onSelect={onSelect} />
      ))}
    </div>
  )
}

interface ColorButtonProps {
  color: string
  onSelect: (color: string) => void
}

export const ColorButton = ({ color, onSelect }: ColorButtonProps) => (
  <button
    onClick={() => onSelect(color)}
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
