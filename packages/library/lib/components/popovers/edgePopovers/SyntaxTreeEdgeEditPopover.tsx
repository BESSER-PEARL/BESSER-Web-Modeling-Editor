import { useReactFlow } from "@xyflow/react"
import { useReactiveEdge } from "@/hooks/useReactiveElement"
import { PopoverProps } from "../types"
import { EdgeStyleEditor } from "@/components/ui"
import { CustomEdgeProps } from "@/edges"
import { useTranslation } from "@/i18n"

export const SyntaxTreeEdgeEditPopover: React.FC<PopoverProps> = ({
  elementId,
}) => {
  const { t } = useTranslation()
  const { updateEdgeData } = useReactFlow()
  const edge = useReactiveEdge(elementId)

  if (!edge) {
    return null
  }

  const edgeData = edge.data as CustomEdgeProps | undefined
  return (
    <EdgeStyleEditor
      edgeData={edgeData}
      handleDataFieldUpdate={(key, value) =>
        updateEdgeData(elementId, { ...edge.data, [key]: value })
      }
      label={t("popup.syntaxTree.relations", "Relations")}
    />
  )
}
