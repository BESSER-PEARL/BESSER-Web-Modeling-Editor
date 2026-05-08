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
import { diagramBridge } from "@/services/diagramBridge"

/**
 * SA-4 / SA-2.2 inspector body for `UserModelName`. Mirrors SA-2's
 * `ObjectEditPanel` layout but slimmed down for the user-modelling
 * shape:
 *
 *  - Each attribute row has `name`, `type`, `defaultValue`, and the
 *    user-modelling `attributeOperator` (`<` / `<=` / `==` / `>=`
 *    / `>`).
 *  - SA-2.2 #36: when the row is linked to a class attribute whose
 *    type is an Enumeration, the value widget becomes a dropdown of
 *    the enumeration's literals (sourced from the bridge).
 *    Date / datetime / time / int / bool also pick widget by type.
 *  - SA-2.2 #37: the comparator dropdown only renders when the linked
 *    class attribute is integer-typed (`int` / `integer` / `number`),
 *    matching v3 `uml-user-model-attribute-update.tsx:106-109` and
 *    avoiding noise on string / enum rows where comparators don't
 *    apply.
 *  - No methods; the user model is constraint-style data only.
 *  - `classId` / `className` cross-link to a ClassDiagram (open
 *    question #1 resolution — preserved for parity with `ObjectName`).
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

const INTEGER_TYPES = new Set(["int", "integer", "number"])
const BOOLEAN_TYPES = new Set(["bool", "boolean"])
const DATE_TYPES = new Set(["date"])
const DATETIME_TYPES = new Set(["datetime"])
const TIME_TYPES = new Set(["time"])
const STRING_TYPES = new Set(["str", "string"])

interface AttrRowProps {
  row: UserModelAttributeRow
  onPatch: (patch: Partial<UserModelAttributeRow>) => void
  onDelete: () => void
}

/**
 * Find the linked class attribute via the diagram bridge. v3 read this
 * via `diagramBridge.getClassDiagramData().elements[attributeId]` —
 * v4 walks `nodes[*].data.attributes` instead.
 */
function lookupLinkedAttribute(
  attributeId?: string
): { name?: string; attributeType?: string } | null {
  if (!attributeId) return null
  const data = diagramBridge.getClassDiagramData()
  if (!data) return null
  for (const node of data.nodes ?? []) {
    const nodeData = (node?.data ?? {}) as {
      attributes?: { id: string; name?: string; attributeType?: string }[]
    }
    const found = (nodeData.attributes ?? []).find(
      (a) => a.id === attributeId
    )
    if (found) return found
  }
  return null
}

/**
 * Find the literals for a given Enumeration class name. v3 looked up
 * the Enumeration class in the bridge and returned its `attributes`
 * (treated as enum values).
 */
function lookupEnumerationLiterals(typeName?: string): string[] {
  if (!typeName) return []
  const data = diagramBridge.getClassDiagramData()
  if (!data) return []
  for (const node of data.nodes ?? []) {
    if (
      node?.type !== "class" &&
      node?.type !== "Enumeration" // tolerate v3 leakage
    ) {
      continue
    }
    const nodeData = (node?.data ?? {}) as {
      name?: string
      stereotype?: string
      attributes?: { id: string; name?: string }[]
    }
    if (
      (nodeData.stereotype === "Enumeration" ||
        node?.type === "Enumeration") &&
      nodeData.name === typeName
    ) {
      return (nodeData.attributes ?? [])
        .map((a) => (typeof a.name === "string" ? a.name : ""))
        .filter((s) => s.length > 0)
    }
  }
  return []
}

const AttrRow: React.FC<AttrRowProps> = ({ row, onPatch, onDelete }) => {
  // Resolve the linked class attribute once per render so we can pick
  // the right comparator / widget based on the class-side type.
  const linked = lookupLinkedAttribute(row.attributeId)
  // The "effective" type for widget selection — prefer the link, fall
  // back to the row's own attributeType.
  const effectiveType = (linked?.attributeType ?? row.attributeType ?? "")
    .toString()
    .toLowerCase()

  const isInteger = INTEGER_TYPES.has(effectiveType)
  const isBool = BOOLEAN_TYPES.has(effectiveType)
  const isDate = DATE_TYPES.has(effectiveType)
  const isDatetime = DATETIME_TYPES.has(effectiveType)
  const isTime = TIME_TYPES.has(effectiveType)
  const isString = STRING_TYPES.has(effectiveType)

  // SA-2.2 #36: enum literals via the bridge. We use the row's raw
  // attributeType as the Enumeration class name — v3 did the same.
  const enumLiterals = lookupEnumerationLiterals(linked?.attributeType)
  const isEnumeration = enumLiterals.length > 0

  const currentValue =
    row.value !== undefined && row.value !== null
      ? String(row.value)
      : row.defaultValue !== undefined && row.defaultValue !== null
        ? String(row.defaultValue)
        : ""

  const onValueChange = (v: string) =>
    onPatch({ value: v === "" ? undefined : v })

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

        {/* SA-2.2 #37: comparator dropdown only when the linked class
            attribute is an integer-style numeric type. v3 hid it for
            non-numeric rows since `==` is the only meaningful op
            there. When there's no link, fall back to the row's own
            type so user-defined integer rows still get the dropdown. */}
        {isInteger && (
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
        )}

        <IconButton size="small" onClick={onDelete}>
          <DeleteIcon width={14} height={14} />
        </IconButton>
      </Stack>

      {/* SA-2.2 #36: type-aware value widget. */}
      {isEnumeration ? (
        <Select
          size="small"
          value={currentValue}
          onChange={(e) => onValueChange(String(e.target.value))}
          displayEmpty
        >
          <MenuItem value="">— select literal —</MenuItem>
          {enumLiterals.map((lit) => (
            <MenuItem key={lit} value={lit}>
              {lit}
            </MenuItem>
          ))}
        </Select>
      ) : isBool ? (
        <Select
          size="small"
          value={currentValue}
          onChange={(e) => onValueChange(String(e.target.value))}
          displayEmpty
        >
          <MenuItem value="">— select —</MenuItem>
          <MenuItem value="true">true</MenuItem>
          <MenuItem value="false">false</MenuItem>
        </Select>
      ) : isDate || isDatetime || isTime ? (
        <MuiTextField
          size="small"
          variant="outlined"
          fullWidth
          type={isDate ? "date" : isTime ? "time" : "datetime-local"}
          value={currentValue}
          onChange={(e) => onValueChange(e.target.value)}
        />
      ) : isString ? (
        <MuiTextField
          size="small"
          variant="outlined"
          fullWidth
          placeholder='value (will be quoted: "…")'
          value={currentValue}
          onChange={(e) => onValueChange(e.target.value)}
        />
      ) : (
        <MuiTextField
          size="small"
          variant="outlined"
          fullWidth
          placeholder="value / default"
          value={currentValue}
          onChange={(e) => onValueChange(e.target.value)}
        />
      )}
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
