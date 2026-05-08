import {
  Box,
  IconButton,
  MenuItem,
  Select,
  Stack,
  TextField as MuiTextField,
  Tooltip,
  Typography as MuiTypography,
} from "@mui/material"
import React, { useMemo } from "react"
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
import {
  getUserMetaModelClasses,
  getUserMetaModelV4,
  type UserMetaModelClass,
} from "@/services/userMetaModel"

/**
 * SA-FIX-USER-COMPLETE inspector body for `UserModelName`. Full v3 port.
 *
 * v3 source: `packages/editor/.../uml-object-name/uml-object-name-update.tsx`
 * (the v3 fork registers `UMLObjectNameUpdate` for both ObjectName and
 * UserModelName, with the user-side branch swapping the attribute
 * sub-component for `UMLUserModelAttributeUpdate`).
 *
 * Key v3-parity behaviours:
 *  - Class picker is driven by the **user-meta-model JSON**, not the
 *    regular ClassDiagram. The user model has its own meta-model
 *    (Personal_Information / Skill / Education / Disability ...) — the
 *    picker presents that list. v3 routed the user-side dropdown
 *    through the same diagramBridge call, but the v3 fork pre-loaded
 *    the user-meta-model into the bridge for that diagram type.
 *    SA-FIX-USER-COMPLETE makes the source explicit by reading the JSON
 *    directly here.
 *  - Selecting a meta-class auto-populates the row's `attributes` from
 *    the meta-model class definition (mirrors v3 `onClassChange` —
 *    `uml-object-name-update.tsx:80-130`).
 *  - Each attribute row has its own type-aware editor (delegated to
 *    the row component below), with the comparator dropdown only
 *    rendered for integer-typed rows (v3
 *    `uml-user-model-attribute-update.tsx:106-109` and `:200-218`).
 *  - Enumeration-typed attribute values become a dropdown of the
 *    Enumeration's literals, sourced from the user-meta-model JSON
 *    (matches v3 `getEnumerationValues` — `uml-user-model-attribute-update.tsx:111-134`).
 *  - No methods rendered. The user model is constraint-style data only.
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
const PRIMITIVE_SET = new Set([
  ...INTEGER_TYPES,
  ...BOOLEAN_TYPES,
  ...DATE_TYPES,
  ...DATETIME_TYPES,
  ...TIME_TYPES,
  ...STRING_TYPES,
  "float",
  "double",
  "any",
])

interface MetaContext {
  classes: UserMetaModelClass[]
  enumerations: Map<string, string[]>
}

/**
 * Build a lookup of the user-meta-model's enumeration literals. v3 read
 * these via `diagramBridge.getClassDiagramData()` after the bridge had
 * been pre-loaded with the user-meta-model. We surface the same shape
 * directly from the JSON so the inspector doesn't depend on bridge
 * priming order.
 */
function buildMetaContext(): MetaContext {
  const classes = getUserMetaModelClasses()
  const enumerations = new Map<string, string[]>()
  const v4 = getUserMetaModelV4()
  for (const n of v4.nodes ?? []) {
    const nd = (n as {
      data?: { name?: string; stereotype?: string; attributes?: { name?: string }[] }
    }).data
    if (nd?.stereotype === "Enumeration" && typeof nd?.name === "string") {
      enumerations.set(
        nd.name,
        (nd.attributes ?? [])
          .map((a) => (typeof a.name === "string" ? a.name : ""))
          .filter((s) => s.length > 0)
      )
    }
  }
  return { classes, enumerations }
}

interface AttrRowProps {
  row: UserModelAttributeRow
  metaCtx: MetaContext
  onPatch: (patch: Partial<UserModelAttributeRow>) => void
  onDelete: () => void
}

const AttrRow: React.FC<AttrRowProps> = ({
  row,
  metaCtx,
  onPatch,
  onDelete,
}) => {
  // Look up linked meta-class attribute (when this row was seeded from
  // a meta-class). v3's `getAttributeDefinition` walked the bridge; we
  // walk our pre-built classes list.
  const linked = useMemo(() => {
    if (!row.attributeId) return null
    for (const c of metaCtx.classes) {
      const found = c.attributes.find((a) => a.id === row.attributeId)
      if (found) return found
    }
    return null
  }, [row.attributeId, metaCtx.classes])

  const effectiveType = (linked?.attributeType ?? row.attributeType ?? "")
    .toString()
    .toLowerCase()

  const isInteger = INTEGER_TYPES.has(effectiveType)
  const isBool = BOOLEAN_TYPES.has(effectiveType)
  const isDate = DATE_TYPES.has(effectiveType)
  const isDatetime = DATETIME_TYPES.has(effectiveType)
  const isTime = TIME_TYPES.has(effectiveType)
  const isString = STRING_TYPES.has(effectiveType)

  // Enumeration literals via the meta-model. Use the linked attribute's
  // raw type (preserves case sensitivity for enum class names like
  // `GenderEnum`) when available, else the row's own type.
  const enumTypeName = linked?.attributeType ?? row.attributeType
  const enumLiterals = enumTypeName
    ? metaCtx.enumerations.get(enumTypeName) ?? []
    : []
  const isEnumeration = enumLiterals.length > 0

  const currentValue =
    row.value !== undefined && row.value !== null
      ? String(row.value)
      : row.defaultValue !== undefined && row.defaultValue !== null
        ? String(row.defaultValue)
        : ""

  const onValueChange = (v: string) =>
    onPatch({ value: v === "" ? undefined : v })

  // The displayed row "name" comes from the linked meta-class attribute
  // when one exists; otherwise users edit it directly.
  const displayName = linked?.name ?? row.name

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 0.5,
        padding: "6px 0",
        borderBottom: "1px solid var(--besser-gray, #e9ecef)",
      }}
    >
      <Stack direction="row" spacing={0.5} alignItems="center">
        {linked ? (
          <MuiTypography
            variant="body2"
            sx={{ flex: 1, fontWeight: 500, color: "var(--besser-text)" }}
          >
            {displayName}
          </MuiTypography>
        ) : (
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
        )}
        {!linked && (
          <Select
            size="small"
            value={
              PRIMITIVE_SET.has(
                String(row.attributeType ?? "str").toLowerCase()
              )
                ? row.attributeType ?? "str"
                : "str"
            }
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
        )}

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

        {/* SA-FINAL U3: per-row text-color picker — mirrors v3
            `uml-user-model-attribute-update.tsx:233-238` ColorButton +
            StylePane workflow. Uses a native color input as a
            lightweight stand-in for the v3 popover; the swatch reflects
            the current `textColor`, click opens the OS picker.
            "Reset" resorts to no-color (uses theme default). */}
        <Tooltip title="Row text color (right-click to reset)">
          <Box
            component="label"
            sx={{
              width: 18,
              height: 18,
              borderRadius: "50%",
              border: "1px solid var(--besser-gray, #ccc)",
              backgroundColor: row.textColor || "var(--besser-text, #000)",
              cursor: "pointer",
              display: "inline-block",
              flexShrink: 0,
              overflow: "hidden",
            }}
            onContextMenu={(e: React.MouseEvent) => {
              e.preventDefault()
              onPatch({ textColor: undefined })
            }}
          >
            <input
              type="color"
              value={
                typeof row.textColor === "string" && row.textColor
                  ? row.textColor
                  : "#000000"
              }
              onChange={(e) => onPatch({ textColor: e.target.value })}
              style={{
                opacity: 0,
                width: "100%",
                height: "100%",
                cursor: "pointer",
                border: "none",
                padding: 0,
              }}
            />
          </Box>
        </Tooltip>
        <IconButton size="small" onClick={onDelete}>
          <DeleteIcon width={14} height={14} />
        </IconButton>
      </Stack>

      {/* Type-aware value widget — v3 parity. */}
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

const PRIMITIVE_TYPE_NAMES = new Set([
  "str",
  "string",
  "int",
  "integer",
  "float",
  "double",
  "bool",
  "boolean",
  "date",
  "datetime",
  "time",
  "any",
])

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

  // Build the meta-model context once per render. Cheap — just walks
  // the JSON in memory; the helper internally caches.
  const metaCtx = useMemo(buildMetaContext, [])

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

  /**
   * Class-picker handler. v3 `onClassChange` reset the attributes,
   * stamped fresh ones from the class definition, and updated
   * `classId` / `className`. We do the same — but the source of truth
   * is the user-meta-model JSON, not the ClassDiagram bridge.
   */
  const onClassChange = (className: string) => {
    if (!className) {
      update({
        classId: undefined,
        className: undefined,
        attributes: [],
      })
      return
    }
    const meta = metaCtx.classes.find((c) => c.name === className)
    if (!meta) {
      update({ className })
      return
    }
    const newAttrs: UserModelAttributeRow[] = meta.attributes.map((a) => {
      const isPrim = PRIMITIVE_TYPE_NAMES.has(a.attributeType.toLowerCase())
      return {
        id: generateUUID(),
        name: a.name,
        attributeType: isPrim ? a.attributeType : "",
        // Link to the meta-attribute so the inspector can resolve enum
        // literals + type when it isn't a primitive.
        attributeId: a.id,
        attributeOperator: "==",
      }
    })
    update({
      classId: meta.id,
      className: meta.name,
      attributes: newAttrs,
    })
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

      {/* Class picker driven by the user-meta-model JSON. */}
      <Stack direction="row" alignItems="center" spacing={0.5}>
        <Typography variant="caption" sx={{ minWidth: 70 }}>
          class
        </Typography>
        <Select
          size="small"
          value={data.className ?? ""}
          onChange={(e) => onClassChange(String(e.target.value))}
          displayEmpty
          sx={{ flex: 1 }}
        >
          <MenuItem value="">— no class —</MenuItem>
          {metaCtx.classes.map((c) => (
            <MenuItem key={c.id} value={c.name}>
              {c.name}
              {c.attributes.length > 0
                ? ` (${c.attributes.length} attrs)`
                : ""}
            </MenuItem>
          ))}
        </Select>
      </Stack>

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
          sx={{ cursor: "pointer", color: "var(--besser-primary)" }}
          onClick={addAttribute}
        >
          + add
        </Typography>
      </Stack>
      {data.attributes.map((row, idx) => (
        <AttrRow
          key={row.id}
          row={row}
          metaCtx={metaCtx}
          onPatch={(patch) => setAttribute(idx, patch)}
          onDelete={() => removeAttribute(idx)}
        />
      ))}
    </Box>
  )
}
