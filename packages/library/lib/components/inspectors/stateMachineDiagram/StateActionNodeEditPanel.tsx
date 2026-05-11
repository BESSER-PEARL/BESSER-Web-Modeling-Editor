import { Box, TextField as MuiTextField } from "@mui/material"
import React from "react"
import CodeMirror from "@uiw/react-codemirror"
import { python } from "@codemirror/lang-python"
import { useShallow } from "zustand/shallow"
import { useDiagramStore } from "@/store/context"
import { StateActionNodeProps } from "@/types"
import { DividerLine, NodeStyleEditor } from "@/components/ui"
import { PopoverProps } from "@/components/popovers/types"
import { InspectorSectionHeader } from "../_shared"

/**
 * SA-3 inspector body for `StateActionNode`. Editable: `name` plus the
 * (optional) `code` body. Kept deliberately small — the v3 update panel
 * was a single-textfield rename.
 */
export const StateActionNodeEditPanel: React.FC<PopoverProps> = ({
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

  const data = node.data as StateActionNodeProps

  const update = (patch: Partial<StateActionNodeProps>) => {
    setNodes((all) =>
      all.map((n) =>
        n.id === elementId ? { ...n, data: { ...n.data, ...patch } } : n
      )
    )
  }

  const handleDataFieldUpdate = (key: string, value: string) => {
    update({ [key]: value } as Partial<StateActionNodeProps>)
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
        label="action name"
        value={data.name}
        onChange={(e) => update({ name: e.target.value })}
      />
      <Box>
        <InspectorSectionHeader>code</InspectorSectionHeader>
        <Box
          sx={{
            border: "1px solid var(--besser-gray, #e9ecef)",
            borderRadius: 1,
            overflow: "hidden",
          }}
        >
          <CodeMirror
            value={data.code ?? ""}
            height="120px"
            extensions={[python()]}
            onChange={(value) => update({ code: value })}
            basicSetup={{
              lineNumbers: false,
              foldGutter: false,
              highlightActiveLineGutter: false,
            }}
          />
        </Box>
      </Box>
    </Box>
  )
}
