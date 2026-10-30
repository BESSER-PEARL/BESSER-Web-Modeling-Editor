import { DiagramNodeType } from "@/nodes"

export interface DropNodeData {
  type: DiagramNodeType
  data: Record<string, unknown>
  offsetX: number
  offsetY: number
}
