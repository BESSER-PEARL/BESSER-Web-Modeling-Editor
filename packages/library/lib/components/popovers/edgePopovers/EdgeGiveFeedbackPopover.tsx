import { useDiagramStore } from "@/store"
import { useShallow } from "zustand/shallow"
import { PopoverProps } from "../types"
import { GiveFeedbackAssessmentBox } from "../GiveFeedbackAssessmentBox"
import Button from "@mui/material/Button"
import { useGoToNextAssessment } from "@/hooks"

export const EdgeGiveFeedbackPopover = ({ elementId }: PopoverProps) => {
  const edges = useDiagramStore(useShallow((state) => state.edges))
  const handleGoToNextAssessment = useGoToNextAssessment(elementId)

  const edge = edges.find((edge) => edge.id === elementId)
  if (!edge) return null

  const edgeType = edge.type
  return (
    <>
      <GiveFeedbackAssessmentBox
        elementId={elementId}
        name={edgeType ?? ""}
        type={edgeType ?? ""}
      />

      <Button variant="outlined" onClick={handleGoToNextAssessment}>
        Next Assessment
      </Button>
    </>
  )
}
