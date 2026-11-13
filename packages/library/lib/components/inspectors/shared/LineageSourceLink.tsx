import React from "react"
import { Link } from "@mui/material"
import { DividerLine } from "@/components/ui"
import { useLineage } from "@/components/hostProviders/contexts"
import { useTranslation } from "@/i18n"
import { InspectorSectionHeader } from "../_shared"

export interface LineageSourceLinkProps {
  elementId: string
}

/**
 * Inspector footer linking a derived element back to its source. Renders
 * nothing without a host lineage provider or when the element has no source,
 * so it can be mounted unconditionally at the end of any inspector.
 */
export const LineageSourceLink: React.FC<LineageSourceLinkProps> = ({ elementId }) => {
  const lineage = useLineage()
  const { t } = useTranslation()
  const resolved = lineage?.resolveSource(elementId)
  if (!lineage || !resolved) return null

  // Element-level wording when the host resolved the source element; the
  // diagram-level wording only repeats the tab's lineage badge.
  const label = resolved.sourceElementType
    ? `← ${t("popup.lineageSource", "Source:")} ${
        resolved.sourceElementName?.trim() || t("popup.unnamed", "(unnamed)")
      } (${resolved.sourceElementType})`
    : `← ${t("popup.lineageDerivedFrom", "Derived from")} ${resolved.sourceDiagramTitle} (${
        resolved.sourceDiagramType
      })`

  return (
    <div data-testid="lineage-source-link">
      <DividerLine />
      <InspectorSectionHeader>{t("popup.lineage", "Lineage")}</InspectorSectionHeader>
      <Link
        component="button"
        type="button"
        underline="hover"
        onClick={() => lineage.onShowSource(resolved)}
        sx={{
          display: "block",
          mt: 0.5,
          color: "var(--bp-accent)",
          fontSize: 13,
          lineHeight: "18px",
          textAlign: "left",
          overflowWrap: "anywhere",
        }}
      >
        {label}
      </Link>
    </div>
  )
}
