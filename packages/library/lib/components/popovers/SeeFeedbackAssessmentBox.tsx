import { useDiagramStore } from "@/store"
import { useShallow } from "zustand/shallow"
import { Typography } from "@/components/ui"
import { useTranslation } from "@/i18n"
import { useMetadataStore } from "@/store/context"
import { getAssessmentTypeLabel } from "@/components/propertiesPanel/typeLabel"

export const SeeFeedbackAssessmentBox = ({
  type,
  name,
  elementId,
}: {
  type: string
  name: string
  elementId: string
}) => {
  const { t, locale } = useTranslation()
  const diagramType = useMetadataStore((state) => state.diagramType)
  const getAssessment = useDiagramStore(
    useShallow((state) => state.getAssessment)
  )
  const assessment = getAssessment(elementId)

  return (
    <>
      <Typography variant="subtitle1">{`${t("assessment.assessment", "Assessment for")} ${getAssessmentTypeLabel(type, diagramType, locale)} "${name}"`}</Typography>
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
        <Typography>{t("assessment.score", "Points")}:</Typography>
        <Typography>{assessment?.score ?? "-"}</Typography>
      </div>

      <Typography>{t("assessment.feedback", "Feedback")}:</Typography>
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
