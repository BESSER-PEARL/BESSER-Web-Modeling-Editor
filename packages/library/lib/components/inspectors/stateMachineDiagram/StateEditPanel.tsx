import {
  Box,
  Checkbox,
  FormControlLabel,
  IconButton,
  Stack,
  TextField as MuiTextField,
} from "@mui/material"
import React, { useRef, useState } from "react"
import { useShallow } from "zustand/shallow"
import { useDiagramStore } from "@/store/context"
import { StateBodyRow, StateNodeProps } from "@/types"
import { DividerLine, NodeStyleEditor, Typography } from "@/components/ui"
import { PopoverProps } from "@/components/popovers/types"
import { DeleteIcon } from "@/components/Icon"
import { generateUUID } from "@/utils"
import {
  InspectorSectionHeader,
  AddRowButton,
  RowColorSwatch,
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

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <NodeStyleEditor
        nodeData={data}
        handleDataFieldUpdate={handleDataFieldUpdate}
        showNameInputChange={false}
      />
      <DividerLine width="100%" />

      <Stack direction="row" spacing={1}>
        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={!!data.italic}
              onChange={(e) => update({ italic: e.target.checked })}
            />
          }
          label="italic"
        />
        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={!!data.underline}
              onChange={(e) => update({ underline: e.target.checked })}
            />
          }
          label="underline"
        />
      </Stack>

      <MuiTextField
        size="small"
        variant="outlined"
        fullWidth
        label="name"
        value={data.name}
        onChange={(e) => update({ name: e.target.value })}
      />

      <DividerLine width="100%" />
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <InspectorSectionHeader>body</InspectorSectionHeader>
        <AddRowButton onClick={() => addRow("main")} />
      </Stack>
      {bodies.length === 0 ? (
        <Typography variant="caption" sx={{ opacity: 0.6 }}>
          no body rows yet
        </Typography>
      ) : (
        sectionRows("main").map((r, idx) => (
          <Stack key={r.id} direction="row" spacing={0.5} alignItems="center">
            <MuiTextField
              size="small"
              variant="outlined"
              fullWidth
              value={r.name ?? ""}
              onChange={(e) => setRowName(r.id, e.target.value)}
              placeholder="entry / do / exit / on"
              inputRef={(el: HTMLInputElement | null) => {
                bodyRefs.current[idx] = el
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  focusNext("main", idx)
                }
              }}
            />
            <RowColorSwatch
              label="Row fill color"
              value={r.fillColor}
              fallbackCss="var(--besser-background, #ffffff)"
              onChange={(color) => patchRowColor(r.id, "fillColor", color)}
            />
            <RowColorSwatch
              label="Row text color"
              value={r.textColor}
              fallbackCss="var(--besser-primary-contrast, #000000)"
              onChange={(color) => patchRowColor(r.id, "textColor", color)}
            />
            <IconButton
              size="small"
              aria-label="delete body"
              onClick={() => removeRow(r.id)}
            >
              <DeleteIcon />
            </IconButton>
          </Stack>
        ))
      )}
      <MuiTextField
        size="small"
        variant="outlined"
        fullWidth
        placeholder="+ add body (Enter)"
        value={newBodyName}
        inputRef={addBodyRef}
        onChange={(e) => setNewBodyName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            commitAddField("main")
          }
        }}
        onBlur={() => commitAddField("main")}
      />

      <DividerLine width="100%" />
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <InspectorSectionHeader>fallback body</InspectorSectionHeader>
        <AddRowButton onClick={() => addRow("fallback")} />
      </Stack>
      {fallbackBodies.length === 0 ? (
        <Typography variant="caption" sx={{ opacity: 0.6 }}>
          no fallback body rows yet
        </Typography>
      ) : (
        sectionRows("fallback").map((r, idx) => (
          <Stack key={r.id} direction="row" spacing={0.5} alignItems="center">
            <MuiTextField
              size="small"
              variant="outlined"
              fullWidth
              value={r.name ?? ""}
              onChange={(e) => setRowName(r.id, e.target.value)}
              placeholder="fallback action"
              inputRef={(el: HTMLInputElement | null) => {
                fallbackRefs.current[idx] = el
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  focusNext("fallback", idx)
                }
              }}
            />
            <RowColorSwatch
              label="Row fill color"
              value={r.fillColor}
              fallbackCss="var(--besser-background, #ffffff)"
              onChange={(color) => patchRowColor(r.id, "fillColor", color)}
            />
            <RowColorSwatch
              label="Row text color"
              value={r.textColor}
              fallbackCss="var(--besser-primary-contrast, #000000)"
              onChange={(color) => patchRowColor(r.id, "textColor", color)}
            />
            <IconButton
              size="small"
              aria-label="delete fallback body"
              onClick={() => removeRow(r.id)}
            >
              <DeleteIcon />
            </IconButton>
          </Stack>
        ))
      )}
      <MuiTextField
        size="small"
        variant="outlined"
        fullWidth
        placeholder="+ add fallback body (Enter)"
        value={newFallbackName}
        inputRef={addFallbackRef}
        onChange={(e) => setNewFallbackName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            commitAddField("fallback")
          }
        }}
        onBlur={() => commitAddField("fallback")}
      />
    </Box>
  )
}
