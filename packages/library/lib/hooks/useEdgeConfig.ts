import { edgeConfig, DiagramEdgeType } from "@/edges/types"

/**
 * Hook to get configuration for a specific edge type
 * @param edgeType - The type of the edge
 * @returns Configuration object for the edge type
 */
export const useEdgeConfig = (edgeType: DiagramEdgeType) => {
  return edgeConfig[edgeType]
}
