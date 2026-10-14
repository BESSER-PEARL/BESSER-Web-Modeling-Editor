import { Box, Checkbox, FormControlLabel, TextField as MuiTextField } from "@mui/material"
import React from "react"
import { useShallow } from "zustand/shallow"
import { useDiagramStore } from "@/store/context"
import { NNContainerNodeProps } from "@/types"
import { NodeStyleEditor, Typography } from "@/components/ui"
import { PopoverProps } from "@/components/popovers/types"
import { useTranslation } from "@/i18n"
import {
  IDENTIFIER_REGEX,
  RETURN_VAR_REGEX,
} from "@/nodes/nnDiagram/nnValidationDefaults"

/** `"rep, recon"` → `["rep", "recon"]` (empty entries dropped). */
export function parseReturnVars(text: string): string[] {
  return text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
}

/** Stored `return_vars` (list, or a legacy comma-separated string) → text. */
export function formatReturnVars(value: unknown): string {
  if (Array.isArray(value)) return value.join(", ")
  return typeof value === "string" ? value : ""
}

/**
 * Inspector for `NNContainer`: name + colours, plus the network's
 * forward signature (smart-gen fd3e904f `nn-container-update.tsx`):
 *   - `input_var` — the variable the network's forward pass takes
 *     (same grammar as the `NN.input_var` setter);
 *   - `return_vars` — the variables it returns, stored as a list on
 *     `data.return_vars` (every entry must start with a letter).
 * Each is behind an enable checkbox; unticking removes the field.
 */
export const NNContainerEditPanel: React.FC<PopoverProps> = ({ elementId }) => {
  const { t } = useTranslation()
  const { nodes, setNodes } = useDiagramStore(
    useShallow((state) => ({
      nodes: state.nodes,
      setNodes: state.setNodes,
    }))
  )
  const node = nodes.find((n) => n.id === elementId)
  const data = (node?.data ?? {}) as NNContainerNodeProps

  const [inputVarEnabled, setInputVarEnabled] = React.useState(
    Boolean(data.input_var)
  )
  const [returnVarsEnabled, setReturnVarsEnabled] = React.useState(
    Boolean(data.return_vars && data.return_vars.length > 0)
  )
  const [inputVarDraft, setInputVarDraft] = React.useState<string | null>(null)
  const [returnVarsDraft, setReturnVarsDraft] = React.useState<string | null>(null)
  const [inputVarError, setInputVarError] = React.useState<string | null>(null)
  const [returnVarsError, setReturnVarsError] = React.useState<string | null>(null)

  if (!node) return null

  const patchData = (patch: Record<string, unknown>) => {
    setNodes((all) =>
      all.map((n) => {
        if (n.id !== elementId) return n
        const next = { ...n.data, ...patch } as Record<string, unknown>
        for (const [key, value] of Object.entries(patch)) {
          if (value === undefined) delete next[key]
        }
        return { ...n, data: next }
      })
    )
  }

  const handleDataFieldUpdate = (key: string, value: string) =>
    patchData({ [key]: value })

  const onInputVarChange = (value: string) => {
    setInputVarDraft(value)
    const trimmed = value.trim()
    if (trimmed === "") {
      setInputVarError(null)
      patchData({ input_var: undefined })
    } else if (IDENTIFIER_REGEX.test(trimmed)) {
      setInputVarError(null)
      patchData({ input_var: trimmed })
    } else {
      setInputVarError(t("popup.nn.validation.identifierStart"))
    }
  }

  const onReturnVarsChange = (value: string) => {
    setReturnVarsDraft(value)
    const parts = parseReturnVars(value)
    if (value.trim() === "") {
      setReturnVarsError(null)
      patchData({ return_vars: undefined })
    } else if (
      value.split(",").every((part) => RETURN_VAR_REGEX.test(part.trim()))
    ) {
      setReturnVarsError(null)
      patchData({ return_vars: parts })
    } else {
      setReturnVarsError(t("popup.nn.validation.identifierListStart"))
    }
  }

  const errorText = (error: string | null) =>
    error ? (
      <Typography variant="caption" sx={{ color: "error.main" }}>
        {error}
      </Typography>
    ) : null

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <NodeStyleEditor
        nodeData={data as never}
        handleDataFieldUpdate={handleDataFieldUpdate}
      />
      <FormControlLabel
        control={
          <Checkbox
            size="small"
            checked={inputVarEnabled}
            onChange={(e) => {
              setInputVarEnabled(e.target.checked)
              setInputVarError(null)
              setInputVarDraft(null)
              if (!e.target.checked) patchData({ input_var: undefined })
            }}
          />
        }
        label={t("popup.nn.container.inputVariable", "Input Variable")}
      />
      {inputVarEnabled && (
        <>
          <MuiTextField
            size="small"
            fullWidth
            value={inputVarDraft ?? data.input_var ?? ""}
            placeholder={t("popup.nn.container.inputVarPlaceholder", "e.g., x")}
            onChange={(e) => onInputVarChange(e.target.value)}
            onBlur={() => setInputVarDraft(null)}
            inputProps={{ "aria-label": "input_var" }}
          />
          {errorText(inputVarError)}
        </>
      )}
      <FormControlLabel
        control={
          <Checkbox
            size="small"
            checked={returnVarsEnabled}
            onChange={(e) => {
              setReturnVarsEnabled(e.target.checked)
              setReturnVarsError(null)
              setReturnVarsDraft(null)
              if (!e.target.checked) patchData({ return_vars: undefined })
            }}
          />
        }
        label={t("popup.nn.container.returnVariables", "Return Variables")}
      />
      {returnVarsEnabled && (
        <>
          <MuiTextField
            size="small"
            fullWidth
            value={returnVarsDraft ?? formatReturnVars(data.return_vars)}
            placeholder={t(
              "popup.nn.container.returnVarsPlaceholder",
              "e.g., y or rep, recon"
            )}
            onChange={(e) => onReturnVarsChange(e.target.value)}
            onBlur={() => setReturnVarsDraft(null)}
            inputProps={{ "aria-label": "return_vars" }}
          />
          {errorText(returnVarsError)}
        </>
      )}
    </Box>
  )
}
