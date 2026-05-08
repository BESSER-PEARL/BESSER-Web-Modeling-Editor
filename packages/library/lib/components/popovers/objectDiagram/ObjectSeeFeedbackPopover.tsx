import { useDiagramStore } from "@/store"
import { useShallow } from "zustand/shallow"
import { ObjectNodeProps } from "@/types"
import { PopoverProps } from "../types"
import { SeeFeedbackAssessmentBox } from "../SeeFeedbackAssessmentBox"
import { useGoToNextAssessment } from "@/hooks"
import Button from "@mui/material/Button"

export const ObjectSeeFeedbackPopover = ({ elementId }: PopoverProps) => {
  const nodes = useDiagramStore(useShallow((state) => state.nodes))
  const handleGoToNextAssessment = useGoToNextAssessment(elementId)

  const node = nodes.find((node) => node.id === elementId)
  if (!node) return null

  const nodeData = node.data as ObjectNodeProps

  return (
    <>
      <SeeFeedbackAssessmentBox
        elementId={elementId}
        name={nodeData.name}
        type={node.type ?? ""}
      />

      {nodeData.attributes.map((attr) => (
        <SeeFeedbackAssessmentBox
          key={attr.id}
          elementId={attr.id}
          name={attr.name}
          type="Attribute"
        />
      ))}
      {/* SA-FIX-OBJECT-DEEP: object instances don't carry methods —
          UML object diagrams show data values, not types. */}
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
