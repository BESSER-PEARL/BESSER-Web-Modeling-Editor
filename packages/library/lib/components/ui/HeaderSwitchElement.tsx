import React from "react"
import { useTranslation } from "@/i18n"

interface Props {
  onClick: () => void
  isComponentHeaderShown: boolean
}

/** Toggle for the «stereotype» header line; pressed while it is shown. */
export const HeaderSwitchElement: React.FC<Props> = ({
  onClick,
  isComponentHeaderShown,
}) => {
  const { t } = useTranslation()
  const label = t("popup.showStereotype", "Show stereotype")
  return (
    <button
      type="button"
      className="bp-icon-btn"
      onClick={onClick}
      aria-pressed={isComponentHeaderShown}
      aria-label={label}
      title={label}
    >
      {"«»"}
    </button>
  )
}
