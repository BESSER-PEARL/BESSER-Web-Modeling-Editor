import { useDiagramStore } from "@/store"
import { useShallow } from "zustand/shallow"
import { ObjectNodeProps } from "@/types"
import { PopoverProps } from "../types"
import { GiveFeedbackAssessmentBox } from "../GiveFeedbackAssessmentBox"
import Button from "@mui/material/Button"
import { useGoToNextAssessment } from "@/hooks"

export const ObjectGiveFeedbackPopover = ({ elementId }: PopoverProps) => {
  const nodes = useDiagramStore(useShallow((state) => state.nodes))
  const handleGoToNextAssessment = useGoToNextAssessment(elementId)

  const node = nodes.find((node) => node.id === elementId)
  if (!node) return null

  const nodeData = node.data as ObjectNodeProps

  return (
    <>
      <GiveFeedbackAssessmentBox
        elementId={elementId}
        name={nodeData.name}
        type="Node"
      />
      {nodeData.attributes.map((attr) => (
        <GiveFeedbackAssessmentBox
          key={attr.id}
          elementId={attr.id}
          name={attr.name}
          type="Attribute"
        />
      ))}
      {nodeData.methods.map((method) => (
        <GiveFeedbackAssessmentBox
          key={method.id}
          elementId={method.id}
          name={method.name}
          type="Method"
        />
      ))}
      <Button
        variant="contained"
        size="small"
        onClick={handleGoToNextAssessment}
        style={{ textTransform: "none" }}
      >
        Next
      </Button>
    </>
  )
}
