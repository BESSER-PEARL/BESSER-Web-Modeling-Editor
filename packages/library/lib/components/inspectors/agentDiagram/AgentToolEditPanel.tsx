import { Box, TextField as MuiTextField } from "@mui/material"
import React from "react"
import CodeMirror from "@uiw/react-codemirror"
import { python } from "@codemirror/lang-python"
import { useShallow } from "zustand/shallow"
import { useDiagramStore } from "@/store/context"
import { AgentToolNodeProps } from "@/types"
import { DividerLine, NodeStyleEditor, Typography } from "@/components/ui"
import { PopoverProps } from "@/components/popovers/types"

/**
 * Inspector for `AgentTool`.
 *
 * Develop source: `agent-state-diagram/agent-tool/agent-tool-update.tsx`
 * — tool name, description (shown to the LLM), Python code. The code
 * editor uses CodeMirror with Python highlighting (matching the
 * AgentState code-body editor) instead of develop's plain textarea.
 */
export const AgentToolEditPanel: React.FC<PopoverProps> = ({ elementId }) => {
  const { nodes, setNodes } = useDiagramStore(
    useShallow((state) => ({
      nodes: state.nodes,
      setNodes: state.setNodes,
    }))
  )
  const node = nodes.find((n) => n.id === elementId)
  if (!node) return null

  const data = node.data as AgentToolNodeProps

  const update = (patch: Partial<AgentToolNodeProps>) => {
    setNodes((all) =>
      all.map((n) =>
        n.id === elementId ? { ...n, data: { ...n.data, ...patch } } : n
      )
    )
  }

  const handleDataFieldUpdate = (key: string, value: string) => {
    update({ [key]: value } as Partial<AgentToolNodeProps>)
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
        label="Tool name"
        value={data.name ?? ""}
        onChange={(e) => update({ name: e.target.value })}
      />

      <MuiTextField
        size="small"
        variant="outlined"
        fullWidth
        multiline
        minRows={2}
        label="Description"
        placeholder="Short description shown to the LLM"
        value={data.description ?? ""}
        onChange={(e) => update({ description: e.target.value })}
      />

      <Typography variant="caption">Python code</Typography>
      <Box
        sx={{
          border: "1px solid var(--besser-gray, #ccc)",
          borderRadius: 1,
          overflow: "hidden",
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
          placeholder={"def tool_name(...):\n    ..."}
        />
      </Box>
    </Box>
  )
}
