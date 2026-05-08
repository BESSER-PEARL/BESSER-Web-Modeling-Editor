import { useDiagramStore } from "@/store"
import { useShallow } from "zustand/shallow"
import { Typography } from "@/components/ui"

export const SeeFeedbackAssessmentBox = ({
  type,
  name,
  elementId,
}: {
  type: string
  name: string
  elementId: string
}) => {
  const getAssessment = useDiagramStore(
    useShallow((state) => state.getAssessment)
  )
  const assessment = getAssessment(elementId)

  return (
    <>
      <Typography variant="subtitle1">{`Assessment for ${type} "${name}"`}</Typography>
      <div
        style={{
          display: "flex",
          flex: 1,
          gap: "8px",
          marginTop: "8px",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Typography>Score:</Typography>
        <Typography>{assessment?.score ?? "-"}</Typography>
      </div>

      <Typography>Feedback:</Typography>
      <Typography>{assessment?.feedback}</Typography>
      <div
        style={{
          marginTop: "12px",
          marginBottom: "12px",
          width: "100%",
          height: "1px",
          backgroundColor: "#ccc",
        }}
      />
    </>
  )
}
