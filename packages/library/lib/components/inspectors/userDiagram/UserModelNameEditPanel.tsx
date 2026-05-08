import {
  Box,
  IconButton,
  MenuItem,
  Select,
  Stack,
  TextField as MuiTextField,
} from "@mui/material"
import React from "react"
import { useShallow } from "zustand/shallow"
import { useDiagramStore } from "@/store/context"
import {
  UserModelAttributeRow,
  UserModelNameNodeProps,
} from "@/types"
import { DividerLine, NodeStyleEditor, Typography } from "@/components/ui"
import { DeleteIcon } from "@/components/Icon"
import { PopoverProps } from "@/components/popovers/types"
import { normalizeType } from "@/utils/typeNormalization"
import { generateUUID } from "@/utils"

/**
 * SA-4 inspector body for `UserModelName`. Mirrors SA-2's
 * `ObjectEditPanel` layout but slimmed down for the user-modelling
 * shape:
 *  - Each attribute row has `name`, `type` (re-using SA-2's primitive
 *    list + `normalizeType`), `defaultValue`, and the user-modelling
 *    `attributeOperator` (`<` / `<=` / `==` / `>=` / `>`).
 *  - No methods; the user model is constraint-style data only.
 *  - `classId` / `className` cross-link to a ClassDiagram (open question
 *    #1 resolution — preserved for parity with `ObjectName`).
 *  - The `description` field surfaces the user-model description for the
 *    OCL semantic-validation step (validated server-side).
 */
const PRIMITIVE_TYPES: { value: string; label: string }[] = [
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

interface AttrRowProps {
  row: UserModelAttributeRow
  onPatch: (patch: Partial<UserModelAttributeRow>) => void
  onDelete: () => void
}

const AttrRow: React.FC<AttrRowProps> = ({ row, onPatch, onDelete }) => {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 0.5,
        padding: "6px 0",
        borderBottom: "1px solid var(--apollon-gray, #e9ecef)",
      }}
    >
      <Stack direction="row" spacing={0.5} alignItems="center">
        <MuiTextField
          size="small"
          variant="outlined"
          fullWidth
          placeholder="attribute name"
          value={row.name}
          onChange={(e) =>
            onPatch({ name: e.target.value.replace(/[^a-zA-Z0-9_]/g, "") })
          }
        />
        <Select
          size="small"
          value={row.attributeType ?? "str"}
          onChange={(e) =>
            onPatch({ attributeType: normalizeType(String(e.target.value)) })
          }
          sx={{ minWidth: 110 }}
        >
          {PRIMITIVE_TYPES.map((p) => (
            <MenuItem key={p.value} value={p.value}>
              {p.label}
            </MenuItem>
          ))}
        </Select>
        <Select
          size="small"
          value={row.attributeOperator ?? "=="}
          onChange={(e) =>
            onPatch({
              attributeOperator: String(
                e.target.value
              ) as UserModelAttributeRow["attributeOperator"],
            })
          }
        >
          {COMPARATORS.map((c) => (
            <MenuItem key={c} value={c}>
              {c}
            </MenuItem>
          ))}
        </Select>
        <IconButton size="small" onClick={onDelete}>
          <DeleteIcon width={14} height={14} />
        </IconButton>
      </Stack>

      <MuiTextField
        size="small"
        variant="outlined"
        fullWidth
        placeholder="value / default"
        value={
          row.value !== undefined && row.value !== null
            ? String(row.value)
            : row.defaultValue !== undefined && row.defaultValue !== null
              ? String(row.defaultValue)
              : ""
        }
        onChange={(e) =>
          onPatch({
            value: e.target.value === "" ? undefined : e.target.value,
          })
        }
      />
    </Box>
  )
}

export const UserModelNameEditPanel: React.FC<PopoverProps> = ({
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

  const data = node.data as UserModelNameNodeProps

  const update = (patch: Partial<UserModelNameNodeProps>) => {
    setNodes((all) =>
      all.map((n) =>
        n.id === elementId ? { ...n, data: { ...n.data, ...patch } } : n
      )
    )
  }

  const handleDataFieldUpdate = (key: string, value: string) => {
    update({ [key]: value } as Partial<UserModelNameNodeProps>)
  }

  const setAttribute = (
    idx: number,
    patch: Partial<UserModelAttributeRow>
  ) => {
    const next = [...data.attributes]
    next[idx] = { ...next[idx], ...patch }
    update({ attributes: next })
  }

  const removeAttribute = (idx: number) => {
    const next = [...data.attributes]
    next.splice(idx, 1)
    update({ attributes: next })
  }

  const addAttribute = () => {
    update({
      attributes: [
        ...data.attributes,
        {
          id: generateUUID(),
          name: "",
          attributeType: "str",
          attributeOperator: "==",
        },
      ],
    })
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
      <MuiTextField
        size="small"
        variant="outlined"
        fullWidth
        label="className (optional cached link)"
        value={data.className ?? ""}
        onChange={(e) => update({ className: e.target.value })}
      />
      <MuiTextField
        size="small"
        variant="outlined"
        fullWidth
        multiline
        minRows={2}
        label="description"
        value={data.description ?? ""}
        onChange={(e) => update({ description: e.target.value })}
      />

      <DividerLine width="100%" />
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
      >
        <Typography variant="caption">attributes</Typography>
        <Typography
          variant="caption"
          sx={{ cursor: "pointer", color: "var(--apollon-primary)" }}
          onClick={addAttribute}
        >
          + add
        </Typography>
      </Stack>
      {data.attributes.map((row, idx) => (
        <AttrRow
          key={row.id}
          row={row}
          onPatch={(patch) => setAttribute(idx, patch)}
          onDelete={() => removeAttribute(idx)}
        />
      ))}
    </Box>
  )
}
