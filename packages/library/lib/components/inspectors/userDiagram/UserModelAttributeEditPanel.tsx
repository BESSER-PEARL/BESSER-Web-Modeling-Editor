import {
  Box,
  MenuItem,
  Select,
  Stack,
  TextField as MuiTextField,
} from "@mui/material"
import React, { useMemo } from "react"
import { useShallow } from "zustand/shallow"
import { useDiagramStore } from "@/store/context"
import { UserModelAttributeNodeProps } from "@/types"
import { DividerLine, NodeStyleEditor, Typography } from "@/components/ui"
import { PopoverProps } from "@/components/popovers/types"
import { normalizeType } from "@/utils/typeNormalization"
import { getUserMetaModelV4 } from "@/services/userMetaModel"

/**
 * SA-FIX-USER-COMPLETE inspector body for stand-alone `UserModelAttribute`
 * nodes (rare; the migrator collapses attributes onto the parent
 * `UserModelName.attributes` array). v3 source:
 * `packages/editor/.../user-modeling/uml-user-model-attribute/uml-user-model-attribute-update.tsx`.
 *
 * Provides a type-aware value widget and an integer-gated comparator
 * dropdown — matching v3's behaviour for owned rows but on a stand-alone
 * node. Enumeration types come from the user-meta-model JSON.
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

const INTEGER_TYPES = new Set(["int", "integer", "number"])
const BOOLEAN_TYPES = new Set(["bool", "boolean"])
const DATE_TYPES = new Set(["date"])
const DATETIME_TYPES = new Set(["datetime"])
const TIME_TYPES = new Set(["time"])
const STRING_TYPES = new Set(["str", "string"])

function buildEnumLookup(): Map<string, string[]> {
  const m = new Map<string, string[]>()
  const v4 = getUserMetaModelV4()
  for (const n of v4.nodes ?? []) {
    const nd = (n as {
      data?: { name?: string; stereotype?: string; attributes?: { name?: string }[] }
    }).data
    if (nd?.stereotype === "Enumeration" && typeof nd?.name === "string") {
      m.set(
        nd.name,
        (nd.attributes ?? [])
          .map((a) => (typeof a.name === "string" ? a.name : ""))
          .filter((s) => s.length > 0)
      )
    }
  }
  return m
}

export const UserModelAttributeEditPanel: React.FC<PopoverProps> = ({
  elementId,
}) => {
  const { nodes, setNodes } = useDiagramStore(
    useShallow((state) => ({
      nodes: state.nodes,
      setNodes: state.setNodes,
    }))
  )
  const enumLookup = useMemo(buildEnumLookup, [])
  const node = nodes.find((n) => n.id === elementId)
  if (!node) return null

  const data = node.data as UserModelAttributeNodeProps & {
    defaultValue?: unknown
  }

  const update = (
    patch: Partial<UserModelAttributeNodeProps & { defaultValue?: unknown }>
  ) => {
    setNodes((all) =>
      all.map((n) =>
        n.id === elementId ? { ...n, data: { ...n.data, ...patch } } : n
      )
    )
  }

  const handleDataFieldUpdate = (key: string, value: string) => {
    update({ [key]: value } as Partial<UserModelAttributeNodeProps>)
  }

  const effectiveType = (data.attributeType ?? "").toString().toLowerCase()
  const isInteger = INTEGER_TYPES.has(effectiveType)
  const isBool = BOOLEAN_TYPES.has(effectiveType)
  const isDate = DATE_TYPES.has(effectiveType)
  const isDatetime = DATETIME_TYPES.has(effectiveType)
  const isTime = TIME_TYPES.has(effectiveType)
  const isString = STRING_TYPES.has(effectiveType)

  // Enum literals via the user-meta-model JSON. Use the raw type to
  // preserve case (e.g. `GenderEnum`).
  const enumLiterals = data.attributeType
    ? enumLookup.get(data.attributeType) ?? []
    : []
  const isEnumeration = enumLiterals.length > 0

  const currentValue =
    data.defaultValue !== undefined && data.defaultValue !== null
      ? String(data.defaultValue)
      : ""

  const onValueChange = (v: string) =>
    update({ defaultValue: v === "" ? undefined : v })

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
          {/* If the attribute is currently bound to an enum class
              from the meta-model, keep that selection visible so the
              picker doesn't silently downgrade to "str". */}
          {data.attributeType && !PRIMITIVE_TYPES.find((p) => p.value === data.attributeType) && (
            <MenuItem
              key={data.attributeType}
              value={data.attributeType}
            >{`${data.attributeType} (enum)`}</MenuItem>
          )}
        </Select>
      </Stack>

      {/* Integer-gated comparator dropdown (v3 parity). */}
      {isInteger && (
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
      )}

      {/* Type-aware value editor (v3 parity). */}
      {isEnumeration ? (
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <Typography variant="caption" sx={{ minWidth: 70 }}>
            value
          </Typography>
          <Select
            size="small"
            value={currentValue}
            onChange={(e) => onValueChange(String(e.target.value))}
            displayEmpty
            sx={{ flex: 1 }}
          >
            <MenuItem value="">— select literal —</MenuItem>
            {enumLiterals.map((lit) => (
              <MenuItem key={lit} value={lit}>
                {lit}
              </MenuItem>
            ))}
          </Select>
        </Stack>
      ) : isBool ? (
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <Typography variant="caption" sx={{ minWidth: 70 }}>
            value
          </Typography>
          <Select
            size="small"
            value={currentValue}
            onChange={(e) => onValueChange(String(e.target.value))}
            displayEmpty
            sx={{ flex: 1 }}
          >
            <MenuItem value="">— select —</MenuItem>
            <MenuItem value="true">true</MenuItem>
            <MenuItem value="false">false</MenuItem>
          </Select>
        </Stack>
      ) : isDate || isDatetime || isTime ? (
        <MuiTextField
          size="small"
          variant="outlined"
          fullWidth
          label="default value"
          type={isDate ? "date" : isTime ? "time" : "datetime-local"}
          value={currentValue}
          onChange={(e) => onValueChange(e.target.value)}
        />
      ) : isString ? (
        <MuiTextField
          size="small"
          variant="outlined"
          fullWidth
          label='default value (will be quoted: "…")'
          value={currentValue}
          onChange={(e) => onValueChange(e.target.value)}
        />
      ) : (
        <MuiTextField
          size="small"
          variant="outlined"
          fullWidth
          label="default value"
          value={currentValue}
          onChange={(e) => onValueChange(e.target.value)}
        />
      )}
    </Box>
  )
}
