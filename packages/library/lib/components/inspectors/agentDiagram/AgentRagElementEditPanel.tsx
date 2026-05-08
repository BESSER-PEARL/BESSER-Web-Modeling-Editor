import {
  Box,
  TextField as MuiTextField,
} from "@mui/material"
import React from "react"
import { useShallow } from "zustand/shallow"
import { useDiagramStore } from "@/store/context"
import { AgentRagElementNodeProps } from "@/types"
import { DividerLine, NodeStyleEditor } from "@/components/ui"
import { PopoverProps } from "@/components/popovers/types"
import { RagDbFields } from "./RagDbFields"

/**
 * SA-FIX-Agent inspector for `AgentRagElement`.
 *
 * PC-8 #2 fix: replaced the previous inline implementation (which used
 * a plain `MuiTextField` for `dbSqlQuery` and offered a non-v3
 * `'predefined'` value in the `dbSelectionType` enum) with the shared
 * `RagDbFields` component. `RagDbFields` already provides the v3
 * canonical enum (`'default'` / `'custom'`) and a Python CodeMirror
 * editor for `dbSqlQuery` so editing the RAG element exposes the same
 * field set users see in `AgentStateEditPanel`.
 *
 * Open question #5 resolution (per the SA-4 brief): exposes BOTH
 * `dbCustomName` and `ragDatabaseName`. The `dbSelectionType`
 * discriminator tells the runtime / BAF generator which one to consume:
 *   - `'default'` → use `ragDatabaseName`
 *   - `'custom'`  → use `dbCustomName`
 *
 * Both fields round-trip verbatim through the migrator so the v3 → v4 →
 * v3 cycle is lossless even when the user only edits one of them.
 */
export const AgentRagElementEditPanel: React.FC<PopoverProps> = ({
  elementId,
}) => {
  const { nodes, setNodes } = useDiagramStore(
    useShallow((state) => ({
      nodes: state.nodes,
      setNodes: state.setNodes,
    }))
  )
  const node = nodes.find((n) => n.id === elementId)
  if (!node) return null

  const data = node.data as AgentRagElementNodeProps

  const update = (patch: Partial<AgentRagElementNodeProps>) => {
    setNodes((all) =>
      all.map((n) =>
        n.id === elementId ? { ...n, data: { ...n.data, ...patch } } : n
      )
    )
  }

  const handleDataFieldUpdate = (key: string, value: string) => {
    update({ [key]: value } as Partial<AgentRagElementNodeProps>)
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <NodeStyleEditor
        nodeData={data}
        handleDataFieldUpdate={handleDataFieldUpdate}
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
        label="ragDatabaseName"
        value={data.ragDatabaseName ?? ""}
        onChange={(e) => update({ ragDatabaseName: e.target.value })}
        helperText="Used when dbSelectionType = default."
      />

      <DividerLine width="100%" />

      {/* Shared field surface: dbSelectionType / dbCustomName /
          dbQueryMode / dbOperation / dbSqlQuery. Provides a CodeMirror
          Python editor for dbSqlQuery and the canonical v3 selection
          enum. */}
      <RagDbFields
        value={data}
        onChange={(patch) => update(patch)}
        showRag={false}
        showDb
      />

      <MuiTextField
        size="small"
        variant="outlined"
        fullWidth
        label="ragType"
        value={data.ragType ?? ""}
        onChange={(e) => update({ ragType: e.target.value })}
        placeholder="optional discriminator"
      />
    </Box>
  )
}
