import {
  Box,
  IconButton,
  MenuItem,
  Select,
  Stack,
  TextField as MuiTextField,
  Tooltip,
} from "@mui/material"
import React, { useMemo, useState, ChangeEvent, KeyboardEvent } from "react"
import { useShallow } from "zustand/shallow"
import { useDiagramStore } from "@/store/context"
import {
  ClassNodeElement,
  ObjectNodeAttribute,
  ObjectNodeProps,
} from "@/types"
import { DividerLine, NodeStyleEditor, Typography } from "@/components/ui"
import { DeleteIcon } from "@/components/Icon"
import { PopoverProps } from "@/components/popovers/types"
import { normalizeType } from "@/utils/typeNormalization"
import { generateUUID } from "@/utils"
import { diagramBridge, IClassInfo } from "@/services/diagramBridge"

const PRIMITIVE_TYPES: { value: string; label: string }[] = [
  { value: "str", label: "str (string)" },
  { value: "int", label: "int (integer)" },
  { value: "float", label: "float (double)" },
  { value: "bool", label: "bool (boolean)" },
  { value: "date", label: "date" },
  { value: "datetime", label: "datetime" },
  { value: "time", label: "time" },
  { value: "timedelta", label: "timedelta" },
  { value: "any", label: "any" },
]

const CUSTOM_TYPE_SENTINEL = "__custom__"

const isPrimitiveType = (t: string | undefined): boolean =>
  !!t && PRIMITIVE_TYPES.some((p) => p.value === t)

/**
 * SA-2.1 type-aware widget classification, mirroring v3
 * `uml-object-attribute-update.tsx:144-176`. Empty string when the row
 * type doesn't trigger a special widget.
 */
type DateWidgetKind = "date" | "datetime-local" | "time" | "duration" | null

const dateWidgetKindFor = (t: string | undefined): DateWidgetKind => {
  if (!t) return null
  const lower = t.toLowerCase()
  if (lower === "date" || lower === "localdate") return "date"
  if (
    lower === "datetime" ||
    lower === "timestamp" ||
    lower === "localdatetime" ||
    lower === "offsetdatetime" ||
    lower === "zoneddatetime" ||
    lower === "instant"
  )
    return "datetime-local"
  if (lower === "time" || lower === "localtime" || lower === "offsettime")
    return "time"
  if (
    lower === "timedelta" ||
    lower === "duration" ||
    lower === "period" ||
    lower === "timespan"
  )
    return "duration"
  return null
}

interface ObjectAttrRowProps {
  row: ObjectNodeAttribute
  /** Class attributes available on the linked classifier (when `classId` is set). */
  linkedClassAttrs: { id: string; name: string; type: string }[]
  classNames: string[]
  /** Sibling enumerations and their literals — drives enum dropdown widget. */
  enumerations: { name: string; literals: string[] }[]
  onPatch: (patch: Partial<ObjectNodeAttribute>) => void
  onDelete: () => void
}

const ObjectAttrRow: React.FC<ObjectAttrRowProps> = ({
  row,
  linkedClassAttrs,
  classNames,
  enumerations,
  onPatch,
  onDelete,
}) => {
  const attributeType = row.attributeType ?? "str"
  const isCustom = !isPrimitiveType(attributeType)
  const [customDraft, setCustomDraft] = useState(isCustom ? attributeType : "")

  const handleTypeSelect = (value: string) => {
    if (value === CUSTOM_TYPE_SENTINEL) {
      onPatch({ attributeType: customDraft || attributeType })
      return
    }
    onPatch({ attributeType: normalizeType(value) })
  }

  const handleAttrLinkSelect = (linkedId: string) => {
    if (!linkedId) {
      onPatch({ attributeId: undefined })
      return
    }
    const target = linkedClassAttrs.find((a) => a.id === linkedId)
    if (!target) return
    onPatch({
      attributeId: target.id,
      name: target.name,
      attributeType: target.type,
    })
  }

  /* ----- Type-aware value widget (SA-2.1) ------------------------------ */

  const matchingEnum = useMemo(
    () => enumerations.find((e) => e.name === attributeType),
    [enumerations, attributeType]
  )
  const dateKind = dateWidgetKindFor(attributeType)

  const valueAsString =
    row.value !== undefined && row.value !== null ? String(row.value) : ""

  const renderValueWidget = () => {
    // 1. Enumeration → dropdown of literals.
    if (matchingEnum && matchingEnum.literals.length > 0) {
      return (
        <Select
          size="small"
          value={valueAsString}
          displayEmpty
          onChange={(e) =>
            onPatch({
              value: e.target.value === "" ? undefined : e.target.value,
            })
          }
          fullWidth
        >
          <MenuItem value="">— no value —</MenuItem>
          {matchingEnum.literals.map((lit) => (
            <MenuItem key={lit} value={lit}>
              {lit}
            </MenuItem>
          ))}
        </Select>
      )
    }

    // 2. Date / datetime / time → matching <input type="...">.
    if (dateKind === "date" || dateKind === "datetime-local" || dateKind === "time") {
      return (
        <MuiTextField
          size="small"
          variant="outlined"
          fullWidth
          type={dateKind}
          value={valueAsString}
          onChange={(e) =>
            onPatch({
              value: e.target.value === "" ? undefined : e.target.value,
            })
          }
        />
      )
    }

    // 3. timedelta / duration → free-form duration input.
    if (dateKind === "duration") {
      return (
        <MuiTextField
          size="small"
          variant="outlined"
          fullWidth
          placeholder="e.g., 1d 2h 30m, P1DT2H30M, 1:30:00"
          value={valueAsString}
          onChange={(e) =>
            onPatch({
              value: e.target.value === "" ? undefined : e.target.value,
            })
          }
        />
      )
    }

    // 4. str → quote-wrapped textfield. Display as `"..."` but store
    // the unquoted value, mirroring v3 `uml-object-attribute-update.tsx`.
    if (attributeType === "str") {
      return (
        <MuiTextField
          size="small"
          variant="outlined"
          fullWidth
          placeholder='"value"'
          value={valueAsString ? `"${valueAsString}"` : ""}
          onChange={(e) => {
            // Strip surrounding quotes (paired or unpaired) before storing.
            const raw = e.target.value.replace(/^"|"$/g, "")
            onPatch({ value: raw === "" ? undefined : raw })
          }}
        />
      )
    }

    // 5. else → plain text input.
    return (
      <MuiTextField
        size="small"
        variant="outlined"
        fullWidth
        placeholder="value"
        value={valueAsString}
        onChange={(e) =>
          onPatch({
            value: e.target.value === "" ? undefined : e.target.value,
          })
        }
      />
    )
  }

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
          value={isCustom ? CUSTOM_TYPE_SENTINEL : attributeType}
          onChange={(e) => handleTypeSelect(String(e.target.value))}
          sx={{ minWidth: 110 }}
        >
          {PRIMITIVE_TYPES.map((p) => (
            <MenuItem key={p.value} value={p.value}>
              {p.label}
            </MenuItem>
          ))}
          {classNames.length > 0 && [
            <MenuItem key="__divider__" disabled>
              ── classes ──
            </MenuItem>,
            ...classNames.map((cn) => (
              <MenuItem key={`class-${cn}`} value={cn}>
                {cn}
              </MenuItem>
            )),
          ]}
          {enumerations.length > 0 && [
            <MenuItem key="__edivider__" disabled>
              ── enumerations ──
            </MenuItem>,
            ...enumerations.map((e) => (
              <MenuItem key={`enum-${e.name}`} value={e.name}>
                {e.name}
              </MenuItem>
            )),
          ]}
          <MenuItem value={CUSTOM_TYPE_SENTINEL}>custom…</MenuItem>
        </Select>
        <Tooltip title="Delete attribute">
          <IconButton size="small" onClick={onDelete}>
            <DeleteIcon width={14} height={14} />
          </IconButton>
        </Tooltip>
      </Stack>

      {isCustom && (
        <MuiTextField
          size="small"
          variant="outlined"
          fullWidth
          placeholder="custom type"
          value={customDraft || attributeType}
          onChange={(e) => setCustomDraft(e.target.value)}
          onBlur={() => {
            if (customDraft.trim()) {
              onPatch({ attributeType: normalizeType(customDraft.trim()) })
            }
          }}
        />
      )}

      {linkedClassAttrs.length > 0 && (
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <Typography variant="caption" sx={{ minWidth: 70 }}>
            link
          </Typography>
          <Select
            size="small"
            value={row.attributeId ?? ""}
            displayEmpty
            onChange={(e) => handleAttrLinkSelect(String(e.target.value))}
            sx={{ flex: 1 }}
          >
            <MenuItem value="">— Unlinked —</MenuItem>
            {linkedClassAttrs.map((a) => (
              <MenuItem key={a.id} value={a.id}>
                {a.name}: {a.type}
              </MenuItem>
            ))}
          </Select>
        </Stack>
      )}

      {renderValueWidget()}
    </Box>
  )
}

/**
 * Walk the bridge data and surface sibling Enumerations as
 * `{ name, literals }` rows. v3 used `availableEnumerations` for this;
 * v4 inlines the walk because no dedicated bridge accessor exists yet.
 */
const collectEnumerations = (): { name: string; literals: string[] }[] => {
  const bridgeData = diagramBridge.getClassDiagramData()
  if (!bridgeData) return []
  return (bridgeData.nodes || [])
    .filter(
      (n: { type?: string; data?: { stereotype?: string | null } }) =>
        // v4: stereotype === 'Enumeration' on a `class` node.
        // v3 leak: type === 'Enumeration'.
        (n.type === "class" && n.data?.stereotype === "Enumeration") ||
        n.type === "Enumeration"
    )
    .map((n: { data?: { name?: string; attributes?: { name: string }[] } }) => ({
      name: n.data?.name ?? "",
      literals: (n.data?.attributes ?? [])
        .map((a) => a.name)
        .filter((s): s is string => !!s),
    }))
    .filter((e) => !!e.name)
}

/**
 * BESSER ObjectDiagram inspector body. Mirrors `ClassEditPanel` but with
 * the per-instance shape:
 *  - top-level `classId` selector (+ classes from sibling ClassDiagram via
 *    `diagramBridge`),
 *  - per-attribute `attributeId` selector (linking back to the source
 *    class's attribute when known),
 *  - a runtime `value` field instead of `defaultValue`,
 *  - no visibility / id-flag controls (object instances inherit those
 *    from their class).
 *
 * SA-2.1: auto-populates attributes from the linked class on `classId`
 * change (mirrors v3 `uml-object-name-update.tsx:107-128`); per-row
 * value field is type-aware.
 */
export const ObjectEditPanel: React.FC<PopoverProps> = ({ elementId }) => {
  const { nodes, setNodes } = useDiagramStore(
    useShallow((state) => ({
      nodes: state.nodes,
      setNodes: state.setNodes,
    }))
  )
  const node = nodes.find((n) => n.id === elementId)

  const availableClasses = useMemo<IClassInfo[]>(() => {
    try {
      return diagramBridge.getAvailableClasses()
    } catch {
      return []
    }
  }, [nodes])

  const enumerations = useMemo(() => collectEnumerations(), [nodes])

  const classNames = availableClasses.map((c) => c.name).filter(Boolean)

  if (!node) return null
  const nodeData = node.data as ObjectNodeProps

  // Class attributes for the currently linked class (drives the per-row
  // attributeId selector).
  const linkedClass = nodeData.classId
    ? availableClasses.find((c) => c.id === nodeData.classId)
    : undefined
  const linkedClassAttrs = linkedClass?.attributes ?? []

  const update = (updater: (d: ObjectNodeProps) => ObjectNodeProps) => {
    setNodes((nodes) =>
      nodes.map((n) => {
        if (n.id !== elementId) return n
        const next = updater(n.data as ObjectNodeProps)
        return { ...n, data: { ...n.data, ...next } }
      })
    )
  }

  const handleDataFieldUpdate = (key: string, value: string) => {
    update((d) => ({ ...d, [key]: value }))
  }

  /**
   * SA-2.1: auto-populate attribute rows when the user picks a new
   * class — mirrors v3 `uml-object-name-update.tsx:107-128`. Existing
   * rows are dropped, then one new row is created per attribute on
   * the chosen class (including inherited attributes via
   * `getAvailableClasses()` which folds the inheritance chain).
   */
  const handleClassChange = (classId: string) => {
    if (!classId) {
      update((d) => ({
        ...d,
        classId: undefined,
        className: undefined,
        attributes: [],
      }))
      return
    }
    const selected = availableClasses.find((c) => c.id === classId)
    if (!selected) return

    const newRows: ObjectNodeAttribute[] = selected.attributes.map((a) => {
      const def =
        a.defaultValue !== undefined && a.defaultValue !== null
          ? String(a.defaultValue)
          : ""
      return {
        id: generateUUID(),
        name: a.name,
        attributeType: a.type || "str",
        attributeId: a.id,
        ...(def !== "" && { value: def }),
      }
    })

    // Auto-update name placeholder when the user hasn't customised it
    // yet. v3 only resets when `name` is empty or the literal "Object".
    setNodes((nodes) =>
      nodes.map((n) => {
        if (n.id !== elementId) return n
        const data = n.data as ObjectNodeProps
        const shouldRename = !data.name || data.name === "Object"
        return {
          ...n,
          data: {
            ...data,
            classId: selected.id,
            className: selected.name,
            attributes: newRows,
            ...(shouldRename && {
              name: `${selected.name.toLowerCase()}Instance`,
            }),
          },
        }
      })
    )
  }

  const patchAttribute = (
    attrId: string,
    patch: Partial<ObjectNodeAttribute>
  ) => {
    update((d) => ({
      ...d,
      attributes: d.attributes.map((a) =>
        a.id === attrId ? { ...a, ...patch } : a
      ),
    }))
  }

  const deleteAttribute = (attrId: string) => {
    setNodes((nodes) =>
      nodes.map((n) => {
        if (n.id !== elementId) return n
        const data = n.data as ObjectNodeProps
        return {
          ...n,
          data: {
            ...data,
            attributes: data.attributes.filter((a) => a.id !== attrId),
          },
          height: n.height ? n.height - 30 : n.height,
          measured: n.measured
            ? { ...n.measured, height: (n.measured.height ?? 0) - 30 }
            : n.measured,
        }
      })
    )
  }

  const addAttribute = (rawName: string) => {
    const trimmed = rawName.trim()
    if (!trimmed) return
    const newAttr: ObjectNodeAttribute = {
      id: generateUUID(),
      name: trimmed.replace(/[^a-zA-Z0-9_]/g, ""),
      attributeType: "str",
      visibility: "public",
    }
    setNodes((nodes) =>
      nodes.map((n) => {
        if (n.id !== elementId) return n
        const data = n.data as ObjectNodeProps
        return {
          ...n,
          data: { ...data, attributes: [...data.attributes, newAttr] },
          height: n.height ? n.height + 30 : n.height,
          measured: n.measured
            ? { ...n.measured, height: (n.measured.height ?? 0) + 30 }
            : n.measured,
        }
      })
    )
  }

  const patchMethod = (mid: string, patch: Partial<ClassNodeElement>) => {
    update((d) => ({
      ...d,
      methods: d.methods.map((m) => (m.id === mid ? { ...m, ...patch } : m)),
    }))
  }

  const [newAttrName, setNewAttrName] = useState("")
  const [newMethodName, setNewMethodName] = useState("")
  const onAttrKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      addAttribute(newAttrName)
      setNewAttrName("")
    }
  }
  const onAttrChange = (e: ChangeEvent<HTMLInputElement>) =>
    setNewAttrName(e.target.value)
  const onMethodKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const trimmed = newMethodName.trim()
      if (!trimmed) return
      const m: ClassNodeElement = {
        id: generateUUID(),
        name: trimmed,
        visibility: "public",
      }
      setNodes((nodes) =>
        nodes.map((n) => {
          if (n.id !== elementId) return n
          const data = n.data as ObjectNodeProps
          return { ...n, data: { ...data, methods: [...data.methods, m] } }
        })
      )
      setNewMethodName("")
    }
  }
  const onMethodChange = (e: ChangeEvent<HTMLInputElement>) =>
    setNewMethodName(e.target.value)

  const placeholderName =
    nodeData.className && nodeData.className.length > 0
      ? `${nodeData.className.toLowerCase()}Instance`
      : "objectName"

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <NodeStyleEditor
        nodeData={nodeData}
        handleDataFieldUpdate={handleDataFieldUpdate}
        inputPlaceholder={placeholderName}
      />
      <DividerLine width="100%" />

      {/* Linked class selector (cross-diagram bridge) */}
      <Stack direction="row" alignItems="center" spacing={0.5}>
        <Typography variant="caption" sx={{ minWidth: 70 }}>
          class
        </Typography>
        <Select
          size="small"
          value={nodeData.classId ?? ""}
          displayEmpty
          onChange={(e) => handleClassChange(String(e.target.value))}
          sx={{ flex: 1 }}
        >
          <MenuItem value="">— Unlinked —</MenuItem>
          {availableClasses.map((c) => (
            <MenuItem key={c.id} value={c.id}>
              {c.name} {c.attributes.length > 0
                ? `(${c.attributes.length} attrs)`
                : ""}
            </MenuItem>
          ))}
        </Select>
      </Stack>

      <DividerLine width="100%" />

      <Typography variant="h6">Attributes</Typography>
      {nodeData.attributes.map((row) => (
        <ObjectAttrRow
          key={row.id}
          row={row}
          linkedClassAttrs={linkedClassAttrs.map((a) => ({
            id: a.id,
            name: a.name,
            type: a.type,
          }))}
          classNames={classNames}
          enumerations={enumerations}
          onPatch={(patch) => patchAttribute(row.id, patch)}
          onDelete={() => deleteAttribute(row.id)}
        />
      ))}
      <MuiTextField
        size="small"
        variant="outlined"
        fullWidth
        placeholder="+ Add attribute (Enter)"
        value={newAttrName}
        onChange={onAttrChange}
        onKeyDown={onAttrKey}
        onBlur={() => {
          if (newAttrName.trim()) {
            addAttribute(newAttrName)
            setNewAttrName("")
          }
        }}
      />

      <DividerLine width="100%" />

      <Typography variant="h6">Methods</Typography>
      {nodeData.methods.map((row) => (
        <Stack
          key={row.id}
          direction="row"
          spacing={0.5}
          alignItems="center"
          sx={{ padding: "4px 0" }}
        >
          <MuiTextField
            size="small"
            variant="outlined"
            fullWidth
            placeholder="method name"
            value={row.name}
            onChange={(e) => patchMethod(row.id, { name: e.target.value })}
          />
          <IconButton
            size="small"
            onClick={() =>
              update((d) => ({
                ...d,
                methods: d.methods.filter((m) => m.id !== row.id),
              }))
            }
          >
            <DeleteIcon width={14} height={14} />
          </IconButton>
        </Stack>
      ))}
      <MuiTextField
        size="small"
        variant="outlined"
        fullWidth
        placeholder="+ Add method (Enter)"
        value={newMethodName}
        onChange={onMethodChange}
        onKeyDown={onMethodKey}
      />
    </Box>
  )
}
