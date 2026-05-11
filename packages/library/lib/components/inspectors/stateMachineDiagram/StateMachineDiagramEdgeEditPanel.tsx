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
import { SwapHorizIcon } from "@/components/Icon"
import { CustomEdgeProps } from "@/edges/EdgeProps"
import { PopoverProps } from "@/components/popovers/types"

/**
 * Inspector body for `StateTransition` edges. v3 parity (strictly):
 *
 *  - `name` (transition function name)
 *  - `params` — single string (e.g. "{60}"), as stored on the v3
 *    relationship at `v3 source: uml-state-transition.ts`.
 *
 * v3 did NOT carry guard / eventName / code / structured params on the
 * transition; those were SA-3 additions. Removed to match the BESSER
 * metamodel.
 */
type EdgeData = CustomEdgeProps & {
  name?: string
  /** Free-text params string. v3 stored a single string here. */
  params?: string | { [key: string]: string }
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

  // The migrator stored v3's "{60}" string as a normalised dict
  // `{ "0": "{60}" }`. Surface it back as a single string in the
  // inspector so users see what v3 saw.
  const paramsAsString =
    typeof data.params === "string"
      ? data.params
      : typeof data.params === "object" && data.params !== null
        ? (data.params["0"] ?? "")
        : ""

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
        label="params"
        value={paramsAsString}
        onChange={(e) => update({ params: e.target.value })}
        placeholder="{60}"
      />
    </Box>
  )
}
