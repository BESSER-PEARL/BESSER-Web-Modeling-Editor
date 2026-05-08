import { OnResize, useReactFlow } from "@xyflow/react"
import { useCallback } from "react"

export const useHandleOnResize = (parentId?: string) => {
  const { getNode, updateNode } = useReactFlow()

  const onResize: OnResize = useCallback(
    (_, params) => {
      if (parentId) {
        let tractParentId: string | undefined = parentId
        let cumulativedParantsOffsetsX = 0
        let cumulativedParantsOffsetsY = 0
        while (tractParentId) {
          const parent = getNode(tractParentId)

          if (
            parent &&
            parent.width! < params.width + params.x + cumulativedParantsOffsetsX
          ) {
            updateNode(tractParentId, {
              width: params.width + params.x + cumulativedParantsOffsetsX,
            })
            cumulativedParantsOffsetsX += parent.position.x
          }
          if (
            parent &&
            parent.height! <
              params.height + params.y + cumulativedParantsOffsetsY
          ) {
            updateNode(tractParentId, {
              height: params.height + params.y + cumulativedParantsOffsetsY,
            })
            cumulativedParantsOffsetsY += parent.position.y
          }

          tractParentId = parent?.parentId
        }
      }
    },
    [getNode, updateNode, parentId]
  )

  return { onResize }
}
