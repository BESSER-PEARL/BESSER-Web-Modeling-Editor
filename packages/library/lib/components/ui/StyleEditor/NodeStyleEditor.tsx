import React, { useState } from "react"
import { TextField, Typography } from "@/components/ui"
import {
  ChevronRightIcon,
  PaletteIcon,
} from "@/components/inspectors/_shared/icons"
import { ColorButton, ColorButtons } from "./ColorButtons"
import { DefaultNodeProps } from "@/types"
import { useTranslation } from "@/i18n"

interface NodeStyleEditorProps {
  nodeData: DefaultNodeProps
  handleDataFieldUpdate: (key: keyof DefaultNodeProps, value: string) => void
  preElements?: React.ReactNode[]
  sideElements?: React.ReactNode[]
  inputPlaceholder?: string
  noStrokeUpdate?: boolean
  showNameInputChange?: boolean
  title?: string
  /**
   * Whether the name input accepts newlines (Enter inserts a hard break).
   * Default `false`. Set to `true` ONLY for node types whose SVG actually
   * renders wrapped labels — otherwise typing a newline would save a
   * character that never repaints. See `supportsMultilineName()` in
   * `utils/nodeUtils.ts` for the canonical per-type list.
   */
  isMultilineName?: boolean
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

export const NodeStyleEditor: React.FC<NodeStyleEditorProps> = ({
  nodeData,
  handleDataFieldUpdate,
  sideElements = [],
  inputPlaceholder,
  noStrokeUpdate = false,
  showNameInputChange = true,
  isMultilineName = false,
  title,
  preElements = [],
}) => {
  const { t } = useTranslation()
  // Three small literals; re-computed on every render is cheaper than memoizing.
  const colorFields: { key: keyof DefaultNodeProps; label: string }[] =
    noStrokeUpdate
      ? [
          { key: "fillColor", label: t("stylePane.fillColor", "Fill Color") },
          { key: "textColor", label: t("stylePane.textColor", "Text Color") },
        ]
      : [
          { key: "fillColor", label: t("stylePane.fillColor", "Fill Color") },
          { key: "strokeColor", label: t("stylePane.lineColor", "Line Color") },
          { key: "textColor", label: t("stylePane.textColor", "Text Color") },
        ]

  const [paintOpen, setPaintOpen] = useState(false)
  const [activeColorField, setActiveColorField] = useState<
    keyof DefaultNodeProps | null
  >(null)

  const toggleColorField = (key: keyof DefaultNodeProps) => {
    setActiveColorField((prev) => (prev === key ? null : key))
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
      <div style={styles.container}>
        {preElements}
        {title && (
          <Typography style={{ fontWeight: 600, marginRight: 8 }}>
            {title}
          </Typography>
        )}
        {showNameInputChange && (
          <TextField
            variant="outlined"
            onChange={(event) =>
              handleDataFieldUpdate("name", event.target.value)
            }
            sx={{ flex: 1 }}
            size="small"
            value={nodeData.name ?? ""}
            placeholder={
              inputPlaceholder ??
              t("stylePane.enterNodeName", "Enter node name")
            }
            inputProps={{
              "aria-label":
                inputPlaceholder ?? t("stylePane.enterNodeName", "Enter node name"),
              autoComplete: "off",
              spellCheck: false,
            }}
            // Only enable multiline — which lets Enter insert a hard line
            // break — for node types whose SVG actually wraps the label.
            // Single-line nodes keep their classic single-line <input>.
            multiline={isMultilineName}
            minRows={isMultilineName ? 1 : undefined}
            maxRows={isMultilineName ? 6 : undefined}
          />
        )}
        {!showNameInputChange && !title && preElements.length === 0 && (
          <span style={{ flex: 1 }} />
        )}
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

        {sideElements.map((element, index) => (
          <React.Fragment key={`side-element-${index}`}>
            {element}
          </React.Fragment>
        ))}
      </div>

      {paintOpen && (
        <div className="bp-style-panel">
          {!activeColorField ? (
            colorFields.map(({ key, label }) => (
              <ColorOption
                key={`${nodeData.name}-${key}-option`}
                label={label}
                color={nodeData[key]}
                onSelect={() => toggleColorField(key)}
              />
            ))
          ) : (
            <div className="bp-style-picker">
              <div className="bp-style-picker__head">
                <span>
                  {colorFields.find((f) => f.key === activeColorField)?.label}
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
                selectedColor={nodeData[activeColorField]}
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
