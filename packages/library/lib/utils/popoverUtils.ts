import { Quadrant } from "@/enums"
import { LocationPopover } from "@/types"

const originMap: Record<Quadrant, LocationPopover> = {
  [Quadrant.TopRight]: {
    anchorOrigin: { vertical: "top", horizontal: "left" },
    transformOrigin: { vertical: "top", horizontal: "right" },
  },
  [Quadrant.TopLeft]: {
    anchorOrigin: { vertical: "top", horizontal: "right" },
    transformOrigin: { vertical: "top", horizontal: "left" },
  },
  [Quadrant.BottomLeft]: {
    anchorOrigin: { vertical: "bottom", horizontal: "right" },
    transformOrigin: { vertical: "bottom", horizontal: "left" },
  },
  [Quadrant.BottomRight]: {
    anchorOrigin: { vertical: "bottom", horizontal: "left" },
    transformOrigin: { vertical: "bottom", horizontal: "right" },
  },
}

export const getPopoverOrigin = (quadrant: Quadrant): LocationPopover => {
  return originMap[quadrant]
}
