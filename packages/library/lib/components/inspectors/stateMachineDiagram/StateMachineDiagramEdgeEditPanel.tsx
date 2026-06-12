import {
  Box,
  IconButton,
  Stack,
  TextField as MuiTextField,
  Tooltip,
} from "@mui/material"
import React from "react"
import { useShallow } from "zustand/shallow"
import { useDiagramStore } from "@/store/context"
import { DividerLine, EdgeStyleEditor } from "@/components/ui"
import { DeleteIcon, SwapHorizIcon } from "@/components/Icon"
import { CustomEdgeProps } from "@/edges/EdgeProps"
import { PopoverProps } from "@/components/popovers/types"
import { InspectorSectionHeader, AddRowButton } from "../_shared"

/**
 * Inspector body for `StateTransition` edges. v3 parity
 * (`v3 source: uml-state-diagram/uml-state-transition/
 * uml-state-transition-update.tsx`):
 *
 *  - `name` (transition function name),
 *  - `guard` — free-text guard expression,
 *  - `params` — dynamic multi-parameter list (Add / per-row trash).
 *
 * v4 canonical shape stores `params` as an **ordered string array**;
 * v3 persisted a `{[id]: string}` dict (a React-keying artifact) and
 * serialized it as `undefined | string | string[]`. Documents saved by
 * earlier migration builds may still carry a single joined string —
 * tolerated below as ONE param row (never split on commas: a single v3
 * param like `"{60}"` may legally contain commas).
 */
type EdgeData = CustomEdgeProps & {
  name?: string
  /** Ordered parameter list (canonical). Legacy: string / `{[id]: string}`. */
  params?: string[] | string | { [key: string]: string }
  /** Guard expression, e.g. `x > 1`. */
  guard?: string
}

/**
 * Normalize the stored `params` (canonical array, legacy single string,
 * or legacy v3 dict) into ordered UI rows. Exported for unit tests.
 */
export const toParamRows = (params: EdgeData["params"]): string[] => {
  if (Array.isArray(params)) {
    return params.filter((p): p is string => typeof p === "string")
  }
  if (typeof params === "string") {
    // One row, unsplit — see the tolerance rule in the header comment.
    return [params]
  }
  if (params && typeof params === "object") {
    // Legacy dict fixtures: develop's popup ordered rows by key.
    return Object.keys(params)
      .sort()
      .map((k) => params[k])
      .filter((v): v is string => typeof v === "string")
  }
  return []
}

export const StateMachineDiagramEdgeEditPanel: React.FC<PopoverProps> = ({
  elementId,
}) => {
  const { edges, setEdges } = useDiagramStore(
    useShallow((state) => ({
      edges: state.edges,
      setEdges: state.setEdges,
    }))
  )
  const edge = edges.find((e) => e.id === elementId)
  if (!edge) return null

  const data: EdgeData = (edge.data ?? {}) as EdgeData

  // Mirror develop's initial state: always show at least one (empty)
  // row. UI-only — the empty seed row is not persisted until typed in.
  const storedRows = toParamRows(data.params)
  const paramRows = storedRows.length > 0 ? storedRows : [""]

  const update = (patch: Partial<EdgeData>) => {
    setEdges((all) =>
      all.map((e) =>
        e.id === elementId ? { ...e, data: { ...e.data, ...patch } } : e
      )
    )
  }

  // Write the full rows array back; omit the key entirely when empty
  // (develop's `serialize()` emitted `undefined` for zero params).
  const writeParams = (rows: string[]) => {
    setEdges((all) =>
      all.map((e) => {
        if (e.id !== elementId) return e
        const nextData = { ...e.data } as EdgeData
        if (rows.length === 0) {
          delete nextData.params
        } else {
          nextData.params = rows
        }
        return { ...e, data: nextData }
      })
    )
  }

  const handleParamChange = (index: number, value: string) => {
    const next = [...paramRows]
    next[index] = value
    writeParams(next)
  }

  // Develop's `addParam` persisted the new empty row immediately.
  const addParam = () => {
    writeParams([...paramRows, ""])
  }

  const removeParam = (index: number) => {
    writeParams(paramRows.filter((_, i) => i !== index))
  }

  const handleStyleFieldUpdate = (
    key: "strokeColor" | "textColor",
    value: string
  ) => {
    update({ [key]: value } as Partial<EdgeData>)
  }

  const handleSwap = () => {
    setEdges((all) =>
      all.map((e) => {
        if (e.id !== elementId) return e
        return {
          ...e,
          source: e.target,
          sourceHandle: e.targetHandle,
          target: e.source,
          targetHandle: e.sourceHandle,
        }
      })
    )
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <EdgeStyleEditor
        edgeData={data}
        handleDataFieldUpdate={handleStyleFieldUpdate}
        label="Transition"
        sideElements={[
          <Tooltip key="flip" title="Flip source / target">
            <IconButton size="small" onClick={handleSwap}>
              <SwapHorizIcon />
            </IconButton>
          </Tooltip>,
        ]}
      />
      <DividerLine width="100%" />

      <MuiTextField
        size="small"
        variant="outlined"
        fullWidth
        label="name"
        value={data.name ?? ""}
        onChange={(e) => update({ name: e.target.value })}
        placeholder="event handler function name"
      />
      <MuiTextField
        size="small"
        variant="outlined"
        fullWidth
        label="guard"
        value={data.guard ?? ""}
        onChange={(e) => update({ guard: e.target.value })}
        placeholder="Guard expression"
      />

      <Stack
        direction="row"
        sx={{ alignItems: "center", justifyContent: "space-between" }}
      >
        <InspectorSectionHeader>Parameters</InspectorSectionHeader>
        <AddRowButton label="add" onClick={addParam} />
      </Stack>
      {paramRows.map((value, index) => (
        <Stack
          key={index}
          direction="row"
          spacing={0.5}
          sx={{ alignItems: "center" }}
        >
          <MuiTextField
            size="small"
            variant="outlined"
            fullWidth
            value={value}
            onChange={(e) => handleParamChange(index, e.target.value)}
            placeholder={`Parameter ${index + 1}`}
          />
          {/* Develop hid the trash button when only one row remains. */}
          {paramRows.length > 1 && (
            <IconButton
              size="small"
              onClick={() => removeParam(index)}
              aria-label={`Remove parameter ${index + 1}`}
            >
              <DeleteIcon width={14} height={14} />
            </IconButton>
          )}
        </Stack>
      ))}
    </Box>
  )
}
