import { Assessment } from "@/typings"
import React, { useCallback } from "react"
import { useShallow } from "zustand/shallow"
import { useDiagramStore } from "@/store/context"

interface Props {
  elementId: string
  elementType?: string
}

export const useDropFeedback = ({
  elementId,
  elementType = "default",
}: Props) => {
  const { setAssessments } = useDiagramStore(
    useShallow((state) => ({
      setAssessments: state.setAssessments,
    }))
  )

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement | SVGGElement>) => {
      event.preventDefault()
      event.stopPropagation()

      const dropData = event.dataTransfer.getData("text/plain")

      const instruction = JSON.parse(dropData)
      const newAssessment: Assessment = {
        modelElementId: elementId,
        elementType,
        score: instruction.credits,
        feedback: instruction.feedback,
        dropInfo: instruction,
        correctionStatus: { status: "NOT_VALIDATED" },
      }
      setAssessments((prev) => ({
        ...prev,
        [elementId]: newAssessment,
      }))
    },
    [elementId, elementType]
  )

  return handleDrop
}
