import {
  Box,
  MenuItem,
  Select,
  Stack,
  TextField as MuiTextField,
} from "@mui/material"
import React from "react"
import CodeMirror from "@uiw/react-codemirror"
import { python } from "@codemirror/lang-python"
import { Typography } from "@/components/ui"

/**
 * Shared sub-component used by both `AgentStateEditPanel` (in
 * the body-action editor) and `AgentRagElementEditPanel` so the v3
 * RAG / DB-action wire fields surface consistently in both places.
 *
 * Source-of-truth port: `v3 source: agent-state-update.tsx`
 * `renderDbReplyEditor` (lines ~809-943) plus the RAG dropdown at
 * lines ~499-526.
 *
 * The component is "controlled" — every field calls `onChange` with a
 * partial patch and the parent merges it into its data store.
 */

export type RagDbFieldsValue = {
  ragDatabaseName?: string
  dbSelectionType?: string
  dbCustomName?: string
  dbQueryMode?: string
  dbOperation?: string
  dbSqlQuery?: string
}

interface RagDbFieldsProps {
  value: RagDbFieldsValue
  onChange: (patch: Partial<RagDbFieldsValue>) => void
  /** Available RAG database names sourced from sibling AgentRagElement
   * nodes. Empty list disables the dropdown and shows a helper line. */
  ragDatabaseOptions?: string[]
  /** Render the RAG-side fields (database name picker). */
  showRag?: boolean
  /** Render the DB-action fields (selection / queryMode / operation /
   * SQL). */
  showDb?: boolean
}

const SELECTION_TYPES = [
  { value: "default", label: "Default (using the app DB)" },
  { value: "custom", label: "Custom" },
] as const

const QUERY_MODES = [
  { value: "llm_query", label: "LLM query" },
  { value: "sql", label: "SQL" },
] as const

const DB_OPERATIONS = [
  { value: "any", label: "Any" },
  { value: "select", label: "SELECT" },
  { value: "insert", label: "INSERT" },
  { value: "update", label: "UPDATE" },
  { value: "delete", label: "DELETE" },
] as const

export const RagDbFields: React.FC<RagDbFieldsProps> = ({
  value,
  onChange,
  ragDatabaseOptions,
  showRag = true,
  showDb = true,
}) => {
  const dbSelectionType = value.dbSelectionType ?? "default"
  const dbQueryMode = value.dbQueryMode ?? "llm_query"
  const dbOperation = value.dbOperation ?? "any"

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      {showRag && (
        <>
          {ragDatabaseOptions && ragDatabaseOptions.length > 0 ? (
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <Typography variant="caption" sx={{ minWidth: 110 }}>
                ragDatabaseName
              </Typography>
              <Select
                size="small"
                value={value.ragDatabaseName ?? ""}
                onChange={(e) =>
                  onChange({ ragDatabaseName: String(e.target.value) })
                }
                displayEmpty
                sx={{ flex: 1 }}
              >
                <MenuItem value="">— select RAG database —</MenuItem>
                {ragDatabaseOptions.map((name) => (
                  <MenuItem key={name} value={name}>
                    {name}
                  </MenuItem>
                ))}
              </Select>
            </Stack>
          ) : (
            // When no AgentRagElement exists in the diagram,
            // present a disabled dropdown plus a helper line nudging the
            // user to drop one onto the canvas first. This replaces the
            // prior free-text fallback (which made it possible to write
            // a name that doesn't resolve to any RAG element).
            <Stack
              direction="column"
              spacing={0.5}
              sx={{ display: "flex", flexDirection: "column" }}
            >
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <Typography variant="caption" sx={{ minWidth: 110 }}>
                  ragDatabaseName
                </Typography>
                <Select
                  size="small"
                  disabled
                  value=""
                  displayEmpty
                  sx={{ flex: 1 }}
                >
                  <MenuItem value="">— no RAG databases —</MenuItem>
                </Select>
              </Stack>
              <Typography
                variant="caption"
                sx={{ opacity: 0.7, fontStyle: "italic" }}
              >
                Create an AgentRagElement from the palette first.
              </Typography>
            </Stack>
          )}
        </>
      )}

      {showDb && (
        <>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Typography variant="caption" sx={{ minWidth: 110 }}>
              dbSelectionType
            </Typography>
            <Select
              size="small"
              value={dbSelectionType}
              onChange={(e) => {
                const next = String(e.target.value)
                onChange({
                  dbSelectionType: next,
                  ...(next === "default" && { dbCustomName: "" }),
                })
              }}
              sx={{ flex: 1 }}
            >
              {SELECTION_TYPES.map((s) => (
                <MenuItem key={s.value} value={s.value}>
                  {s.label}
                </MenuItem>
              ))}
            </Select>
          </Stack>

          {dbSelectionType === "custom" && (
            <MuiTextField
              size="small"
              variant="outlined"
              fullWidth
              label="dbCustomName"
              placeholder="Custom database name"
              value={value.dbCustomName ?? ""}
              onChange={(e) => onChange({ dbCustomName: e.target.value })}
            />
          )}

          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Typography variant="caption" sx={{ minWidth: 110 }}>
              dbOperation
            </Typography>
            <Select
              size="small"
              value={dbOperation}
              onChange={(e) => onChange({ dbOperation: String(e.target.value) })}
              sx={{ flex: 1 }}
            >
              {DB_OPERATIONS.map((op) => (
                <MenuItem key={op.value} value={op.value}>
                  {op.label}
                </MenuItem>
              ))}
            </Select>
          </Stack>

          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Typography variant="caption" sx={{ minWidth: 110 }}>
              dbQueryMode
            </Typography>
            <Select
              size="small"
              value={dbQueryMode}
              onChange={(e) => {
                const next = String(e.target.value)
                onChange({
                  dbQueryMode: next,
                  ...(next === "llm_query" && { dbSqlQuery: "" }),
                })
              }}
              sx={{ flex: 1 }}
            >
              {QUERY_MODES.map((q) => (
                <MenuItem key={q.value} value={q.value}>
                  {q.label}
                </MenuItem>
              ))}
            </Select>
          </Stack>

          {dbQueryMode === "sql" && (
            <Box
              sx={{
                border: "1px solid var(--besser-gray, #ccc)",
                borderRadius: "4px",
                "& .cm-editor": { fontSize: "13px", minHeight: 80 },
              }}
            >
              <CodeMirror
                value={value.dbSqlQuery ?? ""}
                extensions={[python()]}
                onChange={(v) => onChange({ dbSqlQuery: v })}
                basicSetup={{
                  lineNumbers: true,
                  tabSize: 4,
                  indentOnInput: true,
                }}
                placeholder="SELECT * FROM table_name"
              />
            </Box>
          )}

          {dbQueryMode === "llm_query" && (
            <Typography variant="caption" sx={{ opacity: 0.7 }}>
              Answer will be generated with LLM during runtime.
            </Typography>
          )}
        </>
      )}
    </Box>
  )
}
