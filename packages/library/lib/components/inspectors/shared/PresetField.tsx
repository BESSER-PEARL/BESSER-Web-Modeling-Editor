import React, { useId, useState } from "react"
import { InputAdornment, Menu, MenuItem, TextField, Tooltip } from "@mui/material"
import { useTranslation } from "@/i18n"
import { ChevronDownIcon } from "../_shared"

/** A preset with a display label differing from the stored value. */
export interface PresetOption {
  value: string
  label: string
}

export interface PresetFieldProps {
  /** Field label, e.g. `t("popup.stereotype")`. */
  label: string
  value: string | undefined
  /** Called with the typed text, or with a preset's value when one is picked. */
  onChange: (value: string) => void
  /** Bare strings are shown as-is; `PresetOption`s show their `label`. */
  presets: readonly (string | PresetOption)[]
  placeholder?: string
}

const toOption = (preset: string | PresetOption): PresetOption =>
  typeof preset === "string" ? { value: preset, label: preset } : preset

/**
 * Free-text field with a preset menu that writes the same value (component /
 * dependency stereotypes, lane roles). Replaces develop's Textfield + full-width
 * preset Dropdown pair with one control.
 */
export const PresetField: React.FC<PresetFieldProps> = ({ label, value, onChange, presets, placeholder }) => {
  const { t } = useTranslation()
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const menuId = useId()
  const current = value ?? ""
  const options = presets.map(toOption)
  const pick = t("popup.presetPlaceholder", "Choose a preset…")

  return (
    <>
      <TextField
        size="small"
        fullWidth
        label={label}
        value={current}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        slotProps={{
          input: {
            sx: { pr: 0.5 },
            endAdornment: (
              <InputAdornment position="end">
                <Tooltip title={pick} enterDelay={400} disableInteractive describeChild>
                  <button
                    type="button"
                    className="bp-icon-btn bp-icon-btn--sm"
                    aria-label={t("popup.preset", "Preset")}
                    aria-haspopup="menu"
                    aria-expanded={anchor ? true : undefined}
                    aria-controls={anchor ? menuId : undefined}
                    onClick={(e) => setAnchor(e.currentTarget)}
                  >
                    <ChevronDownIcon size={14} />
                  </button>
                </Tooltip>
              </InputAdornment>
            ),
          },
        }}
      />
      <Menu
        id={menuId}
        anchorEl={anchor}
        open={anchor !== null}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        {options.map((option) => (
          <MenuItem
            key={option.value}
            selected={option.value === current}
            onClick={() => {
              onChange(option.value)
              setAnchor(null)
            }}
          >
            {option.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}
