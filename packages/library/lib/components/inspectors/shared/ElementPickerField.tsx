import React from "react"
import { Box, MenuItem, TextField } from "@mui/material"
import { useElementPicker } from "@/components/hostProviders/contexts"
import { useTranslation } from "@/i18n"
import { XIcon } from "../_shared"

export interface ElementPickerFieldProps {
  label: string
  /** Currently selected target element ids. */
  selected: string[]
  /** Element type tokens to offer, e.g. `["Class", "AbstractClass"]`. */
  typeTokens: string[]
  onChange: (ids: string[]) => void
}

/**
 * Multi-select picker for elements of other diagrams (e.g. a component's
 * `realizes` classes): a menu of unselected candidates plus a removable chip
 * per selected id. Renders nothing without a host element-picker provider.
 */
export const ElementPickerField: React.FC<ElementPickerFieldProps> = ({ label, selected, typeTokens, onChange }) => {
  const picker = useElementPicker()
  const { t } = useTranslation()
  if (!picker) return null

  const candidates = picker.listElements(typeTokens)
  const byId = new Map(candidates.map((c) => [c.id, c]))
  const unselected = candidates.filter((c) => !selected.includes(c.id))
  const nameOf = (name: string) => name.trim() || t("popup.unnamed", "(unnamed)")
  const placeholder = t("popup.addTarget", "Add a target…")
  const removeLabel = t("common.remove", "Remove")

  const add = (id: string) => {
    if (id && !selected.includes(id)) onChange([...selected, id])
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }} data-testid="element-picker-field">
      <TextField
        select
        size="small"
        fullWidth
        label={label}
        value=""
        disabled={unselected.length === 0}
        onChange={(e) => add(e.target.value)}
        slotProps={{
          inputLabel: { shrink: true },
          select: {
            displayEmpty: true,
            renderValue: () => <span style={{ color: "var(--bp-muted)" }}>{placeholder}</span>,
          },
        }}
      >
        {unselected.map((c) => (
          <MenuItem key={c.id} value={c.id}>
            {nameOf(c.name)} — {c.diagramTitle}
          </MenuItem>
        ))}
      </TextField>
      {selected.length > 0 && (
        <Box component="ul" sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, m: 0, p: 0, listStyle: "none" }}>
          {selected.map((id) => {
            const element = byId.get(id)
            const text = element
              ? `${nameOf(element.name)} — ${element.diagramTitle}`
              : `${id} ${t("popup.missingElement", "(missing)")}`
            return (
              <Box
                component="li"
                key={id}
                title={text}
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 0.25,
                  maxWidth: "100%",
                  height: 24,
                  pl: 1,
                  pr: 0.25,
                  border: "1px solid var(--bp-border)",
                  borderStyle: element ? "solid" : "dashed",
                  borderRadius: "6px",
                  background: "var(--bp-subtle)",
                  color: element ? "var(--bp-fg)" : "var(--bp-muted)",
                  fontSize: 12,
                  lineHeight: "16px",
                }}
              >
                <Box component="span" sx={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {text}
                </Box>
                <button
                  type="button"
                  className="bp-icon-btn bp-icon-btn--danger"
                  style={{ width: 18, height: 18, borderRadius: 4 }}
                  title={removeLabel}
                  aria-label={`${removeLabel} ${text}`}
                  onClick={() => onChange(selected.filter((x) => x !== id))}
                >
                  <XIcon size={12} />
                </button>
              </Box>
            )
          })}
        </Box>
      )}
    </Box>
  )
}
