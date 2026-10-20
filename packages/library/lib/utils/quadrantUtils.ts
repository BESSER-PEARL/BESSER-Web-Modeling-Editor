import { Quadrant } from "@/enums"
import { XYPosition } from "@xyflow/react"

export const getQuadrant = (
  target: XYPosition,
  reference: XYPosition
): Quadrant => {
  if (target.x > reference.x && target.y > reference.y) {
    return Quadrant.BottomRight
  } else if (target.x < reference.x && target.y > reference.y) {
    return Quadrant.BottomLeft
  } else if (target.x > reference.x && target.y < reference.y) {
    return Quadrant.TopRight
  } else {
    return Quadrant.TopLeft
  }
}
