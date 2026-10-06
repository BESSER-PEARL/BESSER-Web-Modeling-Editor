import {
  Box,
  Checkbox,
  FormControlLabel,
  InputBase,
  Stack,
  TextField as MuiTextField,
} from "@mui/material"
import React, { useRef, useState } from "react"
import { useShallow } from "zustand/shallow"
import { useDiagramStore } from "@/store/context"
import { StateBodyRow, StateNodeProps } from "@/types"
import { DividerLine, NodeStyleEditor, Typography } from "@/components/ui"
import { PopoverProps } from "@/components/popovers/types"
import { generateUUID } from "@/utils"
import { useTranslation } from "@/i18n"
import {
  InspectorSectionHeader,
  AddRowButton,
  RowColorSwatch,
  RowActionButton,
  TrashIcon,
} from "../_shared"

/**
 * Inspector body for the `State` parent node. v3 parity: body and
 * fallback-body rows live inline on `data.bodies` / `data.fallbackBodies`
 * (mirrors AgentState and Class attribute rows). Editable here.
 *
 * Rapid-entry keyboard flow (develop `uml-state-update.tsx` parity):
 * each section keeps an always-present "+ add body (Enter)" field —
 * Enter commits the typed text as a new row and keeps focus for the
 * next one; Enter inside an existing row chains focus row → row →
 * the section's add field (`onSubmitKeyUp` behavior).
 */
export const StateEditPanel: React.FC<PopoverProps> = ({ elementId }) => {
  const { nodes, setNodes } = useDiagramStore(
    useShallow((state) => ({
      nodes: state.nodes,
      setNodes: state.setNodes,
    }))
  )

  // Enter-chaining focus registry (same pattern as ObjectEditPanel's
  // v3 `onSubmitKeyUp` port): row inputs re-register every render;
  // Enter on row i focuses row i+1, falling through to the section's
  // add field.
  const bodyRefs = useRef<(HTMLInputElement | null)[]>([])
  const fallbackRefs = useRef<(HTMLInputElement | null)[]>([])
  bodyRefs.current = []
  fallbackRefs.current = []
  const addBodyRef = useRef<HTMLInputElement | null>(null)
  const addFallbackRef = useRef<HTMLInputElement | null>(null)
  const [newBodyName, setNewBodyName] = useState("")
  const [newFallbackName, setNewFallbackName] = useState("")
  const { t } = useTranslation()

  const node = nodes.find((n) => n.id === elementId)
  if (!node) return null

  const data = node.data as StateNodeProps
  const bodies: StateBodyRow[] = data.bodies ?? []
  const fallbackBodies: StateBodyRow[] = data.fallbackBodies ?? []

  const update = (patch: Partial<StateNodeProps>) => {
    setNodes((all) =>
      all.map((n) =>
        n.id === elementId ? { ...n, data: { ...n.data, ...patch } } : n
      )
    )
  }

  const handleDataFieldUpdate = (key: string, value: string) => {
    update({ [key]: value } as Partial<StateNodeProps>)
  }

  type Section = "main" | "fallback"
  const sectionRows = (s: Section) => (s === "fallback" ? fallbackBodies : bodies)
  const replaceSection = (
    s: Section,
    mapper: (rows: StateBodyRow[]) => StateBodyRow[]
  ) => {
    if (s === "fallback") update({ fallbackBodies: mapper(fallbackBodies) })
    else update({ bodies: mapper(bodies) })
  }
  const sectionForRow = (rowId: string): Section =>
    bodies.some((r) => r.id === rowId) ? "main" : "fallback"

  const setRowName = (rowId: string, name: string) =>
    replaceSection(sectionForRow(rowId), (rows) =>
      rows.map((r) => (r.id === rowId ? { ...r, name } : r))
    )
  // Develop parity (`uml-state-body-update.tsx`): per-row fill / text
  // colors via ColorButton + StylePane. `undefined` clears back to the
  // theme default.
  const patchRowColor = (
    rowId: string,
    key: "fillColor" | "textColor",
    color?: string
  ) =>
    replaceSection(sectionForRow(rowId), (rows) =>
      rows.map((r) => (r.id === rowId ? { ...r, [key]: color } : r))
    )
  const removeRow = (rowId: string) =>
    replaceSection(sectionForRow(rowId), (rows) =>
      rows.filter((r) => r.id !== rowId)
    )
  const addRow = (s: Section, name = "") =>
    replaceSection(s, (rows) => [...rows, { id: generateUUID(), name }])

  /** Enter inside row `idx`: focus the next row, else the add field. */
  const focusNext = (s: Section, idx: number) => {
    const refs = s === "fallback" ? fallbackRefs : bodyRefs
    const addRef = s === "fallback" ? addFallbackRef : addBodyRef
    const next = refs.current
      .slice(idx + 1)
      .find((el): el is HTMLInputElement => !!el)
    ;(next ?? addRef.current)?.focus()
  }

  /** Commit the add field's text as a new row; keep focus for the next. */
  const commitAddField = (s: Section) => {
    const value = s === "fallback" ? newFallbackName : newBodyName
    if (!value.trim()) return
    addRow(s, value.trim())
    if (s === "fallback") setNewFallbackName("")
    else setNewBodyName("")
  }

  /** One body row: name field, its two colour swatches, delete on hover. */
  const renderRow = (
    r: StateBodyRow,
    idx: number,
    s: Section,
    placeholder: string,
    deleteLabel: string
  ) => (
    <div key={r.id} className="bp-member">
      <div className="bp-member__row" style={{ gap: 6 }}>
        <div className="bp-field">
          <InputBase
            className="bp-field__name"
            value={r.name ?? ""}
            onChange={(e) => setRowName(r.id, e.target.value)}
            placeholder={placeholder}
            inputRef={(el: HTMLInputElement | null) => {
              ;(s === "fallback" ? fallbackRefs : bodyRefs).current[idx] = el
            }}
            inputProps={{
              "aria-label": placeholder,
              autoComplete: "off",
              spellCheck: false,
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                focusNext(s, idx)
              }
            }}
          />
        </div>
        <RowColorSwatch
          label={t("stylePane.rowFillColor", "Row fill color")}
          value={r.fillColor}
          fallbackCss="var(--besser-background, #ffffff)"
          onChange={(color) => patchRowColor(r.id, "fillColor", color)}
        />
        <RowColorSwatch
          label={t("stylePane.rowTextColor", "Row text color")}
          value={r.textColor}
          fallbackCss="var(--besser-primary-contrast, #000000)"
          onChange={(color) => patchRowColor(r.id, "textColor", color)}
        />
        <div className="bp-member__actions" style={{ minWidth: 0 }}>
          <RowActionButton danger label={deleteLabel} onClick={() => removeRow(r.id)}>
            <TrashIcon size={14} />
          </RowActionButton>
        </div>
      </div>
    </div>
  )

  /** Always-present add field: Enter (or blur) commits a new row. */
  const renderAddField = (s: Section, placeholder: string) => (
    <div className="bp-field bp-field--add">
      <InputBase
        className="bp-field__name"
        placeholder={placeholder}
        value={s === "fallback" ? newFallbackName : newBodyName}
        inputRef={s === "fallback" ? addFallbackRef : addBodyRef}
        inputProps={{ "aria-label": placeholder, autoComplete: "off", spellCheck: false }}
        onChange={(e) =>
          s === "fallback"
            ? setNewFallbackName(e.target.value)
            : setNewBodyName(e.target.value)
        }
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            commitAddField(s)
          }
        }}
        onBlur={() => commitAddField(s)}
      />
    </div>
  )

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <NodeStyleEditor
          nodeData={data}
          handleDataFieldUpdate={handleDataFieldUpdate}
          showNameInputChange={false}
          preElements={[
            <MuiTextField
              key="name"
              size="small"
              variant="outlined"
              label={t("popup.name", "Name")}
              value={data.name}
              onChange={(e) => update({ name: e.target.value })}
              sx={{ flex: 1 }}
            />,
          ]}
        />

        <Stack direction="row" spacing={1}>
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={!!data.italic}
                onChange={(e) => update({ italic: e.target.checked })}
              />
            }
            label={t("popup.state.italic", "italic")}
          />
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={!!data.underline}
                onChange={(e) => update({ underline: e.target.checked })}
              />
            }
            label={t("popup.state.underline", "underline")}
          />
        </Stack>
      </Box>

      <DividerLine width="100%" />
      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
        <div className="bp-section-head">
          <InspectorSectionHeader>
            {t("packages.StateDiagram.StateBody", "Body")}
            <span className="bp-section-count">{bodies.length}</span>
          </InspectorSectionHeader>
          <AddRowButton onClick={() => addRow("main")} />
        </div>
        <div className="bp-members">
          {bodies.length === 0 ? (
            <Typography variant="caption" sx={{ opacity: 0.6 }}>
              {t("popup.state.noBodyRows", "no body rows yet")}
            </Typography>
          ) : (
            sectionRows("main").map((r, idx) =>
              renderRow(
                r,
                idx,
                "main",
                "entry / do / exit / on",
                t("popup.state.deleteBody", "delete body")
              )
            )
          )}
          {renderAddField(
            "main",
            t("popup.state.addBodyPlaceholder", "+ add body (Enter)")
          )}
        </div>
      </Box>

      <DividerLine width="100%" />
      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
        <div className="bp-section-head">
          <InspectorSectionHeader>
            {t("packages.StateDiagram.StateFallbackBody", "Fallback Body")}
            <span className="bp-section-count">{fallbackBodies.length}</span>
          </InspectorSectionHeader>
          <AddRowButton onClick={() => addRow("fallback")} />
        </div>
        <div className="bp-members">
          {fallbackBodies.length === 0 ? (
            <Typography variant="caption" sx={{ opacity: 0.6 }}>
              {t("popup.state.noFallbackBodyRows", "no fallback body rows yet")}
            </Typography>
          ) : (
            sectionRows("fallback").map((r, idx) =>
              renderRow(
                r,
                idx,
                "fallback",
                t("popup.state.fallbackActionPlaceholder", "fallback action"),
                t("popup.state.deleteFallbackBody", "delete fallback body")
              )
            )
          )}
          {renderAddField(
            "fallback",
            t(
              "popup.state.addFallbackBodyPlaceholder",
              "+ add fallback body (Enter)"
            )
          )}
        </div>
      </Box>
    </Box>
  )
}
