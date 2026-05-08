import { Box, MenuItem, Select, Stack, TextField as MuiTextField } from "@mui/material"
import React from "react"
import { useShallow } from "zustand/shallow"
import { useDiagramStore } from "@/store/context"
import { StateCodeBlockProps } from "@/types"
import { DividerLine, NodeStyleEditor, Typography } from "@/components/ui"
import { PopoverProps } from "@/components/popovers/types"

/**
 * SA-3 inspector body for `StateCodeBlock`. The body is a multi-line
 * code editor; v3 limited the language to Python but the inline
 * `language` field is exposed here for future BAL support.
 */
const LANGUAGES = [
  { value: "python", label: "Python" },
  { value: "bal", label: "BESSER Action Language" },
]

export const StateCodeBlockEditPanel: React.FC<PopoverProps> = ({
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

  const data = node.data as StateCodeBlockProps

  const update = (patch: Partial<StateCodeBlockProps>) => {
    setNodes((all) =>
      all.map((n) =>
        n.id === elementId ? { ...n, data: { ...n.data, ...patch } } : n
      )
    )
  }

  const handleDataFieldUpdate = (key: string, value: string) => {
    update({ [key]: value } as Partial<StateCodeBlockProps>)
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <NodeStyleEditor
        nodeData={data}
        handleDataFieldUpdate={handleDataFieldUpdate}
      />
      <DividerLine width="100%" />

      <Stack direction="row" alignItems="center" spacing={0.5}>
        <Typography variant="caption" sx={{ minWidth: 70 }}>
          language
        </Typography>
        <Select
          size="small"
          value={data.language ?? "python"}
          onChange={(e) => update({ language: String(e.target.value) })}
          sx={{ flex: 1 }}
        >
          {LANGUAGES.map((l) => (
            <MenuItem key={l.value} value={l.value}>
              {l.label}
            </MenuItem>
          ))}
        </Select>
      </Stack>

      <MuiTextField
        size="small"
        variant="outlined"
        fullWidth
        multiline
        minRows={8}
        label="code"
        value={data.code ?? ""}
        onChange={(e) => update({ code: e.target.value })}
        placeholder="# Sample Python code\nprint('Hello World')"
        InputProps={{
          sx: { fontFamily: "monospace", fontSize: 13 },
        }}
      />
    </Box>
  )
}
