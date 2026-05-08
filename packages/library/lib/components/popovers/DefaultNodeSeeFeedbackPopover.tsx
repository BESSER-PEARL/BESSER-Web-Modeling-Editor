import { useDiagramStore } from "@/store"
import { useShallow } from "zustand/shallow"
import { DefaultNodeProps } from "@/types"
import { PopoverProps } from "./types"
import { SeeFeedbackAssessmentBox } from "./SeeFeedbackAssessmentBox"
import { useGoToNextAssessment } from "@/hooks"
import Button from "@mui/material/Button"

export const DefaultNodeSeeFeedbackPopover = ({ elementId }: PopoverProps) => {
  const nodes = useDiagramStore(useShallow((state) => state.nodes))
  const handleGoToNextAssessment = useGoToNextAssessment(elementId)

  const node = nodes.find((node) => node.id === elementId)
  if (!node) return null

  const nodeData = node.data as DefaultNodeProps

  return (
    <>
      <SeeFeedbackAssessmentBox
        elementId={elementId}
        name={nodeData.name}
        type={node.type ?? ""}
      />
      <Button variant="outlined" onClick={handleGoToNextAssessment}>
        Next Assessment
      </Button>
    </>
  )
}
