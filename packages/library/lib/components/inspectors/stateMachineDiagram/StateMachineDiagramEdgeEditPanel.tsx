import { Box, IconButton, Stack, TextField as MuiTextField } from "@mui/material"
import React from "react"
import { useShallow } from "zustand/shallow"
import { useDiagramStore } from "@/store/context"
import { DividerLine, Typography } from "@/components/ui"
import { DeleteIcon } from "@/components/Icon"
import { PopoverProps } from "@/components/popovers/types"

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
 */
type EdgeData = {
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
      <MuiTextField
        size="small"
        variant="outlined"
        fullWidth
        multiline
        minRows={3}
        label="code"
        value={data.code ?? ""}
        onChange={(e) => update({ code: e.target.value })}
        placeholder="Action code executed on transition"
      />

      <DividerLine width="100%" />
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
      >
        <Typography variant="caption">parameters</Typography>
        <Typography
          variant="caption"
          sx={{ cursor: "pointer", color: "var(--besser-primary)" }}
          onClick={addParam}
        >
          + add
        </Typography>
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
