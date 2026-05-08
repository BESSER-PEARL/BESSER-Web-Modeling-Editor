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
import { UserModelAttributeNodeProps } from "@/types"
import { DividerLine, NodeStyleEditor, Typography } from "@/components/ui"
import { PopoverProps } from "@/components/popovers/types"
import { normalizeType } from "@/utils/typeNormalization"

/**
 * SA-4 inspector body for stand-alone `UserModelAttribute` nodes (rare;
 * the migrator collapses attributes onto the parent `UserModelName`'s
 * `attributes` array). Exists for legacy round-trip when v3 fixtures
 * have an unowned attribute element. Reuses SA-2's typeNormalization.
 */
const PRIMITIVE_TYPES = [
  { value: "str", label: "str (string)" },
  { value: "int", label: "int (integer)" },
  { value: "float", label: "float (double)" },
  { value: "bool", label: "bool (boolean)" },
  { value: "date", label: "date" },
  { value: "datetime", label: "datetime" },
  { value: "time", label: "time" },
  { value: "any", label: "any" },
]

const COMPARATORS = ["<", "<=", "==", ">=", ">"] as const

export const UserModelAttributeEditPanel: React.FC<PopoverProps> = ({
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

  const data = node.data as UserModelAttributeNodeProps

  const update = (patch: Partial<UserModelAttributeNodeProps>) => {
    setNodes((all) =>
      all.map((n) =>
        n.id === elementId ? { ...n, data: { ...n.data, ...patch } } : n
      )
    )
  }

  const handleDataFieldUpdate = (key: string, value: string) => {
    update({ [key]: value } as Partial<UserModelAttributeNodeProps>)
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
        value={data.name}
        onChange={(e) => update({ name: e.target.value })}
      />

      <Stack direction="row" alignItems="center" spacing={0.5}>
        <Typography variant="caption" sx={{ minWidth: 70 }}>
          type
        </Typography>
        <Select
          size="small"
          value={data.attributeType ?? "str"}
          onChange={(e) =>
            update({ attributeType: normalizeType(String(e.target.value)) })
          }
          sx={{ flex: 1 }}
        >
          {PRIMITIVE_TYPES.map((p) => (
            <MenuItem key={p.value} value={p.value}>
              {p.label}
            </MenuItem>
          ))}
        </Select>
      </Stack>

      <Stack direction="row" alignItems="center" spacing={0.5}>
        <Typography variant="caption" sx={{ minWidth: 70 }}>
          operator
        </Typography>
        <Select
          size="small"
          value={data.attributeOperator ?? "=="}
          onChange={(e) =>
            update({
              attributeOperator: String(
                e.target.value
              ) as UserModelAttributeNodeProps["attributeOperator"],
            })
          }
          sx={{ flex: 1 }}
        >
          {COMPARATORS.map((c) => (
            <MenuItem key={c} value={c}>
              {c}
            </MenuItem>
          ))}
        </Select>
      </Stack>

      <MuiTextField
        size="small"
        variant="outlined"
        fullWidth
        label="default value"
        value={
          data.defaultValue !== undefined && data.defaultValue !== null
            ? String(data.defaultValue)
            : ""
        }
        onChange={(e) =>
          update({
            defaultValue:
              e.target.value === "" ? undefined : e.target.value,
          })
        }
      />
    </Box>
  )
}
