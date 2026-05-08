import {
  Box,
  MenuItem,
  Select,
  Stack,
  TextField as MuiTextField,
} from "@mui/material"
import React from "react"
import { useShallow } from "zustand/shallow"
import { useDiagramStore } from "@/store/context"
import { AgentRagElementNodeProps } from "@/types"
import { DividerLine, NodeStyleEditor, Typography } from "@/components/ui"
import { PopoverProps } from "@/components/popovers/types"

/**
 * SA-4 inspector for `AgentRagElement`.
 *
 * Open question #5 resolution (per the SA-4 brief): exposes BOTH
 * `dbCustomName` and `ragDatabaseName` as separate fields. The
 * `dbSelectionType` discriminator tells the runtime / BAF generator
 * which one to consume:
 *   - `'predefined'` → use `ragDatabaseName`
 *   - `'custom'`     → use `dbCustomName`
 *   - `'default'`    → use `ragDatabaseName` (legacy)
 *
 * Both fields round-trip verbatim through the migrator so the v3 → v4 →
 * v3 cycle is lossless even when the user only edits one of them.
 */
const SELECTION_TYPES = ["predefined", "custom", "default"] as const
const QUERY_MODES = ["llm_query", "sql", "natural_language"] as const

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

      <Stack direction="row" alignItems="center" spacing={0.5}>
        <Typography variant="caption" sx={{ minWidth: 90 }}>
          dbSelectionType
        </Typography>
        <Select
          size="small"
          value={data.dbSelectionType ?? "default"}
          onChange={(e) => update({ dbSelectionType: String(e.target.value) })}
          sx={{ flex: 1 }}
        >
          {SELECTION_TYPES.map((t) => (
            <MenuItem key={t} value={t}>
              {t}
            </MenuItem>
          ))}
        </Select>
      </Stack>

      <MuiTextField
        size="small"
        variant="outlined"
        fullWidth
        label="ragDatabaseName"
        value={data.ragDatabaseName ?? ""}
        onChange={(e) => update({ ragDatabaseName: e.target.value })}
        helperText="used when dbSelectionType = predefined / default"
      />
      <MuiTextField
        size="small"
        variant="outlined"
        fullWidth
        label="dbCustomName"
        value={data.dbCustomName ?? ""}
        onChange={(e) => update({ dbCustomName: e.target.value })}
        helperText="used when dbSelectionType = custom"
      />

      <Stack direction="row" alignItems="center" spacing={0.5}>
        <Typography variant="caption" sx={{ minWidth: 90 }}>
          dbQueryMode
        </Typography>
        <Select
          size="small"
          value={data.dbQueryMode ?? "llm_query"}
          onChange={(e) => update({ dbQueryMode: String(e.target.value) })}
          sx={{ flex: 1 }}
        >
          {QUERY_MODES.map((q) => (
            <MenuItem key={q} value={q}>
              {q}
            </MenuItem>
          ))}
        </Select>
      </Stack>

      {data.dbQueryMode === "sql" ? (
        <>
          <MuiTextField
            size="small"
            variant="outlined"
            fullWidth
            label="dbOperation"
            value={data.dbOperation ?? "any"}
            onChange={(e) => update({ dbOperation: e.target.value })}
          />
          <MuiTextField
            size="small"
            variant="outlined"
            fullWidth
            multiline
            minRows={3}
            label="dbSqlQuery"
            value={data.dbSqlQuery ?? ""}
            onChange={(e) => update({ dbSqlQuery: e.target.value })}
            placeholder="SELECT * FROM …"
          />
        </>
      ) : null}

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
