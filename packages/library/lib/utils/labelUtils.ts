export const calculateOffsets = (
  arrowBoxPosition: { x: number; y: number },
  labelBoxPosition: { x: number; y: number },
  arrowDirection: "Up" | "Down" | "Left" | "Right",
  index: number
) => {
  const arrowOffset = {
    x: arrowBoxPosition.x,
    y: arrowBoxPosition.y,
  }

  let labelOffset: { x: number; y: number }

  if (arrowDirection === "Right") {
    // ⟶ messages: stack upward (negative y)
    labelOffset = {
      x: labelBoxPosition.x,
      y: labelBoxPosition.y - index * 16,
    }
  } else if (arrowDirection === "Left") {
    // ⟵ messages: stack downward (positive y)
    labelOffset = {
      x: labelBoxPosition.x,
      y: labelBoxPosition.y + index * 16,
    }
  } else {
    // ↑ or ↓ messages: stack downward (positive y)
    labelOffset = {
      x: labelBoxPosition.x,
      y: labelBoxPosition.y + index * 16,
    }
  }

  return { arrowOffset, labelOffset }
}
