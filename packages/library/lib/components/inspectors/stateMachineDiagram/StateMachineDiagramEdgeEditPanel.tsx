import {
  Box,
  IconButton,
  Stack,
  TextField as MuiTextField,
  Tooltip,
} from "@mui/material"
import React from "react"
import CodeMirror from "@uiw/react-codemirror"
import { python } from "@codemirror/lang-python"
import { useShallow } from "zustand/shallow"
import { useDiagramStore } from "@/store/context"
import { DividerLine, EdgeStyleEditor } from "@/components/ui"
import { DeleteIcon, SwapHorizIcon } from "@/components/Icon"
import { CustomEdgeProps } from "@/edges/EdgeProps"
import { PopoverProps } from "@/components/popovers/types"
import { InspectorSectionHeader, AddRowButton } from "../_shared"

/**
 * SA-3 inspector body for `StateTransition` edges. Editable fields:
 *
 *  - `name`
 *  - `guard` (optional boolean expression rendered as `[guard]` next to
 *    the label on the canvas — see `StateMachineDiagramEdge.tsx`).
 *  - `params` — ordered string-keyed dict mirroring the v3 shape at
 *    `packages/editor/.../uml-state-transition.ts:14`.
 *  - SA-3 brief additions: `code` (action body) and `eventName`
 *    (explicit trigger).
 *
 * SA-FIX-State (PC-5 #1): flip + color editor surface via
 * `EdgeStyleEditor` + `SwapHorizIcon`, mirroring the SA-2.1 class-edge
 * and SA-2.2 #26 agent-edge approach.
 *
 * SA-FIX-State (PC-5 #2): the `code` field uses CodeMirror with Python
 * syntax highlighting (matches AgentDiagramEdgeEditPanel).
 */
type EdgeData = CustomEdgeProps & {
  name?: string
  guard?: string
  code?: string
  eventName?: string
  params?: { [key: string]: string }
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
  const params = data.params ?? {}

  const update = (patch: Partial<EdgeData>) => {
    setEdges((all) =>
      all.map((e) =>
        e.id === elementId ? { ...e, data: { ...e.data, ...patch } } : e
      )
    )
  }

  const handleStyleFieldUpdate = (
    key: "strokeColor" | "textColor",
    value: string
  ) => {
    update({ [key]: value } as Partial<EdgeData>)
  }

  // SA-FIX-State PC-5 #1: flip swaps source/target/handle pairs on the
  // edge, mirroring `ClassEdgeEditPanel.handleSwap`.
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

  const setParam = (key: string, value: string) => {
    update({ params: { ...params, [key]: value } })
  }

  const removeParam = (key: string) => {
    const next = { ...params }
    delete next[key]
    update({ params: next })
  }

  const addParam = () => {
    const numericKeys = Object.keys(params)
      .map((k) => parseInt(k, 10))
      .filter((n) => !Number.isNaN(n))
    const nextKey = ((numericKeys.length ? Math.max(...numericKeys) : -1) + 1).toString()
    update({ params: { ...params, [nextKey]: "" } })
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      {/* SA-FIX-State PC-5 #1: color editor + flip action */}
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
      />
      <MuiTextField
        size="small"
        variant="outlined"
        fullWidth
        label="guard"
        value={data.guard ?? ""}
        onChange={(e) => update({ guard: e.target.value })}
        placeholder="boolean expression in [...]"
      />
      <MuiTextField
        size="small"
        variant="outlined"
        fullWidth
        label="event name"
        value={data.eventName ?? ""}
        onChange={(e) => update({ eventName: e.target.value })}
      />

      {/* SA-FIX-State PC-5 #2: CodeMirror Python editor for `code`. */}
      <Stack spacing={0.5}>
        <InspectorSectionHeader>code</InspectorSectionHeader>
        <Box
          sx={{
            border: "1px solid var(--besser-gray, #ccc)",
            borderRadius: "4px",
            "& .cm-editor": { fontSize: "13px", minHeight: 80 },
          }}
        >
          <CodeMirror
            value={data.code ?? ""}
            extensions={[python()]}
            onChange={(v) => update({ code: v })}
            basicSetup={{
              lineNumbers: true,
              tabSize: 4,
              indentOnInput: true,
            }}
            placeholder="Action code executed on transition"
          />
        </Box>
      </Stack>

      <DividerLine width="100%" />
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
      >
        <InspectorSectionHeader>parameters</InspectorSectionHeader>
        <AddRowButton onClick={addParam} />
      </Stack>
      {Object.keys(params)
        .sort((a, b) => Number(a) - Number(b))
        .map((key) => (
          <Stack
            key={key}
            direction="row"
            alignItems="center"
            spacing={0.5}
            sx={{ padding: "4px 0" }}
          >
            <MuiTextField
              size="small"
              variant="outlined"
              fullWidth
              placeholder={`param ${key}`}
              value={params[key]}
              onChange={(e) => setParam(key, e.target.value)}
            />
            <IconButton size="small" onClick={() => removeParam(key)}>
              <DeleteIcon width={14} height={14} />
            </IconButton>
          </Stack>
        ))}
    </Box>
  )
}
