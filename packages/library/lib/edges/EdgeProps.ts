import { Edge, EdgeProps } from "@xyflow/react"
import { IPoint } from "./Connection"

// Define message structure with direction
export interface MessageData {
  id: string
  text: string
  direction: "target" | "source" // target = source to target, source = target to source
}

export type CustomEdgeProps = {
  sourceRole: string | null
  sourceMultiplicity: string | null
  targetRole: string | null
  targetMultiplicity: string | null
  points: IPoint[]
  label?: string | null
  messages?: MessageData[] // For communication diagram edges with direction-aware messages
  strokeColor?: string
  textColor?: string
  /**
   * ObjectLink-only field. Pins the link to a specific
   * ClassDiagram association so generators can resolve which
   * association the v3 relationship corresponds to. Other edge types
   * never set this.
   */
  associationId?: string
}

export type ExtendedEdgeProps = EdgeProps<Edge<CustomEdgeProps>> & {
  markerEnd?: string
  markerPadding?: number
  strokeDashArray?: string
  type: string
}
