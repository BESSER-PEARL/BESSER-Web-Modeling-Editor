import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  TextField as MuiTextField,
} from "@mui/material"
import { ChevronDownIcon, InspectorSectionHeader } from "@/components/inspectors/_shared"
import { useTranslation } from "@/i18n"

export interface NodeMetadataFieldsProps {
  description?: string
  uri?: string
  onChange: (key: "description" | "uri", value: string) => void
}

/**
 * Description and URI of a node, as the class inspector shows them.
 * Collapsed while both are empty.
 */
export const NodeMetadataFields: React.FC<NodeMetadataFieldsProps> = ({
  description,
  uri,
  onChange,
}) => {
  const { t } = useTranslation()
  return (
    <Accordion
      className="bp-disclosure"
      defaultExpanded={!!description || !!uri}
      disableGutters
      elevation={0}
    >
      <AccordionSummary expandIcon={<ChevronDownIcon size={14} />}>
        <InspectorSectionHeader>
          {t("popup.class.metadata", "Metadata")}
        </InspectorSectionHeader>
      </AccordionSummary>
      <AccordionDetails>
        <MuiTextField
          size="small"
          variant="outlined"
          fullWidth
          multiline
          minRows={2}
          placeholder={t("stylePane.description", "Description")}
          inputProps={{
            "aria-label": t("stylePane.description", "Description"),
          }}
          value={description ?? ""}
          onChange={(e) => onChange("description", e.target.value)}
        />
        <MuiTextField
          size="small"
          variant="outlined"
          fullWidth
          placeholder={t("stylePane.enterUri", "Enter URI…")}
          inputProps={{
            "aria-label": "URI",
            autoComplete: "off",
            spellCheck: false,
          }}
          value={uri ?? ""}
          onChange={(e) => onChange("uri", e.target.value)}
        />
      </AccordionDetails>
    </Accordion>
  )
}
