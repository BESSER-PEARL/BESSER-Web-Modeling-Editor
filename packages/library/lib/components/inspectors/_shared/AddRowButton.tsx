import React from "react"
import { useTranslation } from "@/i18n"
import { PlusIcon } from "./icons"

interface AddRowButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "children"> {
  onClick: () => void
  /** Short verb / target, e.g. `add attribute`. Defaults to `add`. */
  label?: string
}

/**
 * Uniform "add row" affordance for inspector lists: a quiet ghost button
 * with a plus glyph that sits on the right of a section header. Neutral at
 * rest (the brand colour is kept for primary actions and selection).
 */
export const AddRowButton: React.FC<AddRowButtonProps> = ({
  onClick,
  label,
  className,
  ...rest
}) => {
  const { t } = useTranslation()
  const text = label ?? t("common.addLowercase", "add")
  return (
    <button
      type="button"
      onClick={onClick}
      {...rest}
      className={["bp-add-btn", className].filter(Boolean).join(" ")}
    >
      <PlusIcon size={14} />
      {/* Labels arrive lowercase ("add attribute"); capitalise the first
          letter for display only. */}
      <span>{text.charAt(0).toUpperCase() + text.slice(1)}</span>
    </button>
  )
}
