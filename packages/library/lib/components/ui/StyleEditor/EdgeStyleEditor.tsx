import React, { useState } from "react"
import {
  ChevronRightIcon,
  PaletteIcon,
} from "@/components/inspectors/_shared/icons"
import { ColorButton, ColorButtons } from "./ColorButtons"
import { CustomEdgeProps } from "@/edges"
import { useTranslation } from "@/i18n"

type updateEdgeDataColorsKeys = "strokeColor" | "textColor"

interface EdgeStyleEditorProps {
  edgeData?: CustomEdgeProps
  handleDataFieldUpdate: (key: updateEdgeDataColorsKeys, value: string) => void
  sideElements?: React.ReactNode[]
  label: string
}

const styles = {
  container: {
    display: "flex",
    flexDirection: "row" as const,
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
    flex: 1,
  },
  label: {
    minWidth: 0,
    fontSize: 13,
    fontWeight: 600,
    color: "var(--bp-fg, inherit)",
    whiteSpace: "nowrap" as const,
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
}

// One row per colour slot: label + current-colour swatch (opens the palette).
const ColorOption: React.FC<{
  label: string
  color: string | undefined
  onSelect: () => void
}> = ({ label, color, onSelect }) => (
  <div className="bp-style-option">
    <span>{label}</span>
    <ColorButton onSelect={onSelect} color={color || "#000000"} label={label} />
  </div>
)

const colorFields: {
  key: updateEdgeDataColorsKeys
  labelKey: string
  label: string
}[] = [
  { key: "strokeColor", labelKey: "stylePane.lineColor", label: "Line Color" },
  { key: "textColor", labelKey: "stylePane.textColor", label: "Text Color" },
]

export const EdgeStyleEditor: React.FC<EdgeStyleEditorProps> = ({
  edgeData,
  handleDataFieldUpdate,
  sideElements = [],
  label,
}) => {
  const { t } = useTranslation()
  const [paintOpen, setPaintOpen] = useState(false)
  const [activeColorField, setActiveColorField] =
    useState<updateEdgeDataColorsKeys | null>(null)

  const toggleColorField = (key: updateEdgeDataColorsKeys) => {
    setActiveColorField((prev) => (prev === key ? null : key))
  }

  const activeField = colorFields.find((f) => f.key === activeColorField)

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
      <div style={styles.container}>
        <span style={styles.label}>{label}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          <button
            type="button"
            className="bp-icon-btn"
            onClick={() => setPaintOpen(!paintOpen)}
            aria-label={t("stylePane.toggleColorSettings", "Toggle color settings")}
            aria-expanded={paintOpen}
            title={t("stylePane.toggleColorSettings", "Toggle color settings")}
          >
            <PaletteIcon size={16} />
          </button>
          {sideElements}
        </div>
      </div>

      {paintOpen && (
        <div className="bp-style-panel">
          {!activeColorField ? (
            colorFields.map(({ key, labelKey, label }) => (
              <ColorOption
                key={`${edgeData?.label}-${key}-option`}
                label={t(labelKey, label)}
                color={edgeData ? edgeData[key] : undefined}
                onSelect={() => toggleColorField(key)}
              />
            ))
          ) : (
            <div className="bp-style-picker">
              <div className="bp-style-picker__head">
                <span>
                  {activeField ? t(activeField.labelKey, activeField.label) : null}
                </span>
                <button
                  type="button"
                  className="bp-icon-btn bp-icon-btn--sm"
                  aria-label={t("common.back", "Back")}
                  title={t("common.back", "Back")}
                  onClick={() => setActiveColorField(null)}
                >
                  <span className="bp-back-glyph">
                    <ChevronRightIcon size={14} />
                  </span>
                </button>
              </div>
              <ColorButtons
                onSelect={(color) =>
                  handleDataFieldUpdate(activeColorField, color)
                }
                selectedColor={edgeData?.[activeColorField]}
              />
              <button
                type="button"
                className="bp-text-btn"
                onClick={() => handleDataFieldUpdate(activeColorField, "")}
              >
                {t("stylePane.reset", "Reset")}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
