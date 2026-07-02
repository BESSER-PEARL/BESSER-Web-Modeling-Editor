import {
  Box,
  IconButton,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField as MuiTextField,
  Tooltip,
  Typography as MuiTypography,
} from "@mui/material"
import React, {
  useMemo,
  useRef,
  useState,
  ChangeEvent,
  KeyboardEvent,
} from "react"
import { useShallow } from "zustand/shallow"
import { useDiagramStore } from "@/store/context"
import { ObjectNodeAttribute, ObjectNodeProps } from "@/types"
import { DividerLine, NodeStyleEditor, Typography } from "@/components/ui"
import { DeleteIcon } from "@/components/Icon"
import { PaintRollerIcon } from "@/components/Icon/PaintRollerIcon"
import { PopoverProps } from "@/components/popovers/types"
import { generateUUID } from "@/utils"
import { diagramBridge, IClassInfo } from "@/services/diagramBridge"
import { InspectorSectionHeader } from "../_shared"

interface ObjectAttrRowProps {
  row: ObjectNodeAttribute
  /** Cached read-only display type, auto-inherited from the linked class. */
  displayType?: string
  /** Map of enumeration name → its literal values, sourced from sibling
   *  ClassDiagram via `diagramBridge.getClassDiagramData()`. */
  enumLiterals: Map<string, string[]>
  onPatch: (patch: Partial<ObjectNodeAttribute>) => void
  onDelete: () => void
  /**
   * Receives the row's value `<input>` so the panel can drive
   * Enter-to-next-slot navigation (v3 `onSubmitKeyUp` parity —
   * `uml-object-name-update.tsx` focused the next attribute Textfield
   * or fell through to the add field). `null` is reported for widget
   * types without a focusable text input (bool switch / enum select).
   */
  valueInputRef?: (el: HTMLInputElement | null) => void
  /** Fired when Enter is pressed inside the row's value input. */
  onEnter?: () => void
}

/**
 * Per-attribute-slot fill / text color controls — v3 parity with the
 * `ColorButton` + `StylePane fillColor textColor` block that every
 * `UMLObjectAttributeUpdate` row carried
 * (`uml-object-attribute-update.tsx`). The paint-roller toggles a
 * two-swatch panel; right-click on a swatch resets that color to the
 * theme default. The canvas side (`RowBlockSection`) already paints
 * per-row `fillColor` / `textColor`, so the patch repaints live.
 */
const SlotColorControls: React.FC<{
  row: Pick<ObjectNodeAttribute, "fillColor" | "textColor">
  onPatch: (patch: Partial<ObjectNodeAttribute>) => void
}> = ({ row, onPatch }) => {
  const swatch = (
    label: string,
    key: "fillColor" | "textColor",
    fallback: string
  ) => (
    <Stack direction="row" alignItems="center" spacing={1}>
      <MuiTypography variant="caption" sx={{ minWidth: 70 }}>
        {label}
      </MuiTypography>
      <Tooltip title={`${label} (right-click to reset)`}>
        <Box
          component="label"
          sx={{
            width: 18,
            height: 18,
            borderRadius: "50%",
            border: "1px solid var(--besser-gray, #ccc)",
            backgroundColor: row[key] || fallback,
            cursor: "pointer",
            display: "inline-block",
            flexShrink: 0,
            overflow: "hidden",
          }}
          onContextMenu={(e: React.MouseEvent) => {
            e.preventDefault()
            onPatch({ [key]: undefined })
          }}
        >
          <input
            type="color"
            value={
              typeof row[key] === "string" && row[key]
                ? (row[key] as string)
                : key === "fillColor"
                  ? "#ffffff"
                  : "#000000"
            }
            onChange={(e) => onPatch({ [key]: e.target.value })}
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
    </Stack>
  )

  return (
    <Stack
      direction="row"
      spacing={2}
      sx={{
        padding: "2px 0 4px 0",
        marginLeft: "4px",
      }}
    >
      {swatch("Fill Color", "fillColor", "var(--besser-background, #fff)")}
      {swatch("Text Color", "textColor", "var(--besser-text, #000)")}
    </Stack>
  )
}

const INT_TYPES = new Set(["int", "integer", "number"])
const FLOAT_TYPES = new Set(["float", "double", "real"])
const BOOL_TYPES = new Set(["bool", "boolean"])
const DATE_TYPES = new Set(["date"])
const DATETIME_TYPES = new Set(["datetime"])
const TIME_TYPES = new Set(["time"])
const DURATION_TYPES = new Set(["timedelta", "duration", "period", "timespan"])
const STRING_TYPES = new Set(["str", "string"])

/**
 * Restore per-attribute-type value widgets in the
 * ObjectDiagram inspector. Mirrors the v3 source-of-truth at
 * `v3 source: uml-object-diagram/uml-object-attribute/uml-object-attribute-update.tsx`:
 *
 *  - `bool` / `boolean` → MUI `Switch` (committing the canonical
 *    `"True"` / `"False"` string values so the BESSER round-trip is
 *    preserved).
 *  - `int` / `float` → `MuiTextField` with `type="number"`.
 *  - `date` / `datetime` / `time` → native HTML date/time inputs styled
 *    as MUI text-fields.
 *  - enum (when the inherited type matches a sibling Enumeration's
 *    name) → `Select` of literal values.
 *  - anything else → plain `MuiTextField`.
 *
 * The row keeps the same compact `name = widget` shape as the previous
 * minimal port; the value widget is the only column that becomes
 * type-aware.
 */
const ObjectAttrRow: React.FC<ObjectAttrRowProps> = ({
  row,
  displayType,
  enumLiterals,
  onPatch,
  onDelete,
  valueInputRef,
  onEnter,
}) => {
  const [colorOpen, setColorOpen] = useState(false)
  const valueAsString =
    row.value !== undefined && row.value !== null ? String(row.value) : ""

  // Shared wiring for every text-input-based value widget:
  // expose the input element for slot navigation and translate Enter
  // into the panel-level `onEnter` callback (v3 `onSubmitKeyUp`).
  const navigationProps = {
    inputRef: (el: HTMLInputElement | null) => valueInputRef?.(el),
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      if (e.key === "Enter") {
        e.preventDefault()
        onEnter?.()
      }
    },
  }

  // Resolve the canonical type-string to lower-case for matching. The
  // raw type (preserving case, e.g. `GenderEnum`) is used as the enum
  // map key.
  const rawType = (displayType ?? row.attributeType ?? "").toString()
  const lowerType = rawType.toLowerCase()
  const isBool = BOOL_TYPES.has(lowerType)
  const isInt = INT_TYPES.has(lowerType)
  const isFloat = FLOAT_TYPES.has(lowerType)
  const isDate = DATE_TYPES.has(lowerType)
  const isDatetime = DATETIME_TYPES.has(lowerType)
  const isTime = TIME_TYPES.has(lowerType)
  const isDuration = DURATION_TYPES.has(lowerType)
  const isString = STRING_TYPES.has(lowerType)
  const enumValues = rawType ? enumLiterals.get(rawType) ?? [] : []
  const isEnum = enumValues.length > 0

  const commitValue = (next: string | undefined) =>
    onPatch({ value: next === "" || next === undefined ? undefined : next })

  let valueWidget: React.ReactNode
  if (isBool) {
    const checked = valueAsString.toLowerCase() === "true"
    valueWidget = (
      <Stack
        direction="row"
        alignItems="center"
        spacing={0.5}
        sx={{ flex: 1 }}
      >
        <Switch
          size="small"
          checked={checked}
          onChange={(_, c) => commitValue(c ? "True" : "False")}
        />
        <MuiTypography variant="caption" sx={{ userSelect: "none" }}>
          {checked ? "True" : "False"}
        </MuiTypography>
      </Stack>
    )
  } else if (isInt || isFloat) {
    valueWidget = (
      <MuiTextField
        size="small"
        variant="outlined"
        placeholder={isInt ? "0" : "0.0"}
        type="number"
        inputProps={isInt ? { step: 1 } : { step: "any" }}
        value={valueAsString}
        onChange={(e) => commitValue(e.target.value)}
        sx={{ flex: 1 }}
        {...navigationProps}
      />
    )
  } else if (isDate || isDatetime || isTime) {
    valueWidget = (
      <MuiTextField
        size="small"
        variant="outlined"
        type={isDate ? "date" : isTime ? "time" : "datetime-local"}
        placeholder={
          isDate ? "YYYY-MM-DD" : isTime ? "HH:MM" : "YYYY-MM-DDTHH:MM"
        }
        value={valueAsString}
        onChange={(e) => commitValue(e.target.value)}
        sx={{ flex: 1 }}
        InputLabelProps={{ shrink: true }}
        {...navigationProps}
      />
    )
  } else if (isDuration) {
    // v3 parity: renderDurationInput (uml-object-attribute-update.tsx:169-176,304-317).
    valueWidget = (
      <MuiTextField
        size="small"
        variant="outlined"
        placeholder="e.g., 1d 2h 30m, P1DT2H30M, 1:30:00"
        value={valueAsString}
        onChange={(e) => commitValue(e.target.value)}
        sx={{ flex: 1 }}
        inputProps={{
          title:
            "Enter duration in formats like: '1d 2h 30m', 'P1DT2H30M' (ISO 8601), or 'HH:mm:ss'",
        }}
        {...navigationProps}
      />
    )
  } else if (isEnum) {
    valueWidget = (
      <Select
        size="small"
        value={valueAsString}
        displayEmpty
        onChange={(e) => commitValue(String(e.target.value))}
        sx={{ flex: 1 }}
      >
        <MenuItem value="">— select literal —</MenuItem>
        {enumValues.map((lit) => (
          <MenuItem key={lit} value={lit}>
            {lit}
          </MenuItem>
        ))}
      </Select>
    )
  } else {
    const textfield = (
      <MuiTextField
        size="small"
        variant="outlined"
        placeholder="value"
        value={valueAsString}
        onChange={(e) => commitValue(e.target.value)}
        sx={{ flex: 1 }}
        {...navigationProps}
      />
    )
    // v3 parity: isStringType + QuoteWrapper/Quote
    // (uml-object-attribute-update.tsx:360-386).
    valueWidget = isString ? (
      <Stack
        direction="row"
        alignItems="center"
        spacing={0.25}
        sx={{ flex: 1 }}
      >
        <MuiTypography component="span" sx={{ userSelect: "none" }}>
          "
        </MuiTypography>
        {textfield}
        <MuiTypography component="span" sx={{ userSelect: "none" }}>
          "
        </MuiTypography>
      </Stack>
    ) : (
      textfield
    )
  }

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        padding: "4px 0",
        borderBottom: "1px solid var(--besser-gray, #e9ecef)",
      }}
    >
      <Stack direction="row" spacing={0.5} alignItems="center">
        <MuiTextField
          size="small"
          variant="outlined"
          placeholder="name"
          value={row.name}
          onChange={(e) =>
            onPatch({ name: e.target.value.replace(/[^a-zA-Z0-9_]/g, "") })
          }
          sx={{ flex: 1 }}
        />
        <MuiTypography
          component="span"
          sx={{ px: 0.5, fontWeight: 500, userSelect: "none" }}
        >
          =
        </MuiTypography>
        {valueWidget}
        {displayType && (
          <Tooltip title={`type inherited from class: ${displayType}`}>
            <MuiTypography
              variant="caption"
              sx={{
                minWidth: 40,
                color: "var(--besser-text-muted, #6c757d)",
                fontStyle: "italic",
                userSelect: "none",
              }}
            >
              : {displayType}
            </MuiTypography>
          </Tooltip>
        )}
        <Tooltip title="Row colors">
          <IconButton
            size="small"
            aria-label="Row colors"
            onClick={() => setColorOpen((open) => !open)}
          >
            <PaintRollerIcon width={14} height={14} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete attribute">
          <IconButton size="small" onClick={onDelete}>
            <DeleteIcon width={14} height={14} />
          </IconButton>
        </Tooltip>
      </Stack>
      {colorOpen && <SlotColorControls row={row} onPatch={onPatch} />}
    </Box>
  )
}

/**
 * BESSER ObjectDiagram inspector body. Mirrors `ClassEditPanel` but with
 * the per-instance shape:
 *  - top-level `classId` selector (+ classes from sibling ClassDiagram via
 *    `diagramBridge`),
 *  - per-attribute inline `name = value` text widget,
 *  - no Methods section — objects are instances, not types
 *    ,
 *  - no visibility / id-flag controls (object instances inherit those
 *    from their class).
 *
 * Auto-populates attributes from the linked class on `classId`
 * change (mirrors v3 `uml-object-name-update.tsx:107-128`); the
 * attribute type is auto-inherited and shown read-only.
 */
export const ObjectEditPanel: React.FC<PopoverProps> = ({ elementId }) => {
  const { nodes, setNodes } = useDiagramStore(
    useShallow((state) => ({
      nodes: state.nodes,
      setNodes: state.setNodes,
    }))
  )
  const node = nodes.find((n) => n.id === elementId)

  // Enter-to-next-slot navigation (v3 `onSubmitKeyUp` parity).
  // `valueRefs` is re-populated on every render by the rows' `inputRef`
  // callbacks; rows whose value widget has no text input (bool switch,
  // enum select) simply leave a hole and are skipped.
  const valueRefs = useRef<(HTMLInputElement | null)[]>([])
  const addFieldRef = useRef<HTMLInputElement | null>(null)
  valueRefs.current = []

  const availableClasses = useMemo<IClassInfo[]>(() => {
    try {
      return diagramBridge.getAvailableClasses()
    } catch {
      return []
    }
  }, [nodes])

  /**
   * Build a `Map<enumName, literals[]>` from the sibling
   * ClassDiagram so the type-aware row can render a `Select` for any
   * enum-typed attribute. Mirrors the v3 `getEnumerationValues` helper
   * at `v3 source: uml-object-attribute-update.tsx`.
   */
  const enumLiterals = useMemo<Map<string, string[]>>(() => {
    const m = new Map<string, string[]>()
    try {
      const data = diagramBridge.getClassDiagramData()
      if (!data) return m
      for (const n of data.nodes ?? []) {
        const nd = (n as {
          type?: string
          data?: {
            name?: string
            stereotype?: string | null
            attributes?: { name?: string }[]
          }
        })
        const isEnum =
          (nd.type === "class" && nd.data?.stereotype === "Enumeration") ||
          nd.type === "Enumeration"
        if (!isEnum) continue
        const name = nd.data?.name
        if (typeof name !== "string" || name.length === 0) continue
        const lits = (nd.data?.attributes ?? [])
          .map((a) => (typeof a.name === "string" ? a.name : ""))
          .filter((s) => s.length > 0)
        m.set(name, lits)
      }
    } catch {
      /* swallow — empty map is the safe fallback */
    }
    return m
  }, [nodes])

  if (!node) return null
  const nodeData = node.data as ObjectNodeProps

  // Class attributes for the currently linked class (drives the
  // read-only type lookup for each row).
  const linkedClass = nodeData.classId
    ? availableClasses.find((c) => c.id === nodeData.classId)
    : undefined
  const linkedClassAttrs = linkedClass?.attributes ?? []

  /**
   * Resolve the read-only display type for a row. Lookup order:
   *  1. linked class attribute by `attributeId`,
   *  2. linked class attribute by `name` (when the attribute id was
   *     never bound),
   *  3. row's stored `attributeType` (legacy / unlinked rows).
   */
  const resolveDisplayType = (
    row: ObjectNodeAttribute
  ): string | undefined => {
    if (row.attributeId) {
      const byId = linkedClassAttrs.find((a) => a.id === row.attributeId)
      if (byId?.type) return byId.type
    }
    if (row.name) {
      const byName = linkedClassAttrs.find((a) => a.name === row.name)
      if (byName?.type) return byName.type
    }
    return row.attributeType
  }

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
   * Auto-populate attribute rows when the user picks a new
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
        // The icon mirrors the linked class — unlinking drops it.
        icon: undefined,
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
            // Inherit the linked class's icon (develop's per-class
            // palette instances copied `classInfo.icon`; the inspector
            // class-picker must match). Cleared when the new class has
            // no icon so the node never shows a stale glyph.
            icon: selected.icon || undefined,
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
    // Object instances don't carry visibility semantics, so
    // omit `visibility` here. The canvas formatter `formatObjectMember`
    // also strips it, but skipping the field at construction keeps the
    // BESSER round-trip output clean.
    const newAttr: ObjectNodeAttribute = {
      id: generateUUID(),
      name: trimmed.replace(/[^a-zA-Z0-9_]/g, ""),
      attributeType: "str",
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

  const [newAttrName, setNewAttrName] = useState("")
  const onAttrKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      addAttribute(newAttrName)
      setNewAttrName("")
    }
  }
  const onAttrChange = (e: ChangeEvent<HTMLInputElement>) =>
    setNewAttrName(e.target.value)

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

      {/* Linked class selector (cross-diagram bridge).
          Mirror v3 `getClassDisplayName` and append the
          inheritance chain (`extends Parent, Other`) so similarly-named
          subclasses are distinguishable. */}
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
          {availableClasses.map((c) => {
            // v3 parity (`uml-object-name-update.tsx:63-79`):
            // hierarchy[0] is the class itself; the rest are parents.
            let hierarchy: string[] = []
            try {
              hierarchy = diagramBridge.getClassHierarchy(c.id)
            } catch {
              hierarchy = []
            }
            const parents = hierarchy.length > 1 ? hierarchy.slice(1) : []
            const extendsHint =
              parents.length > 0 ? ` extends ${parents.join(", ")}` : ""
            const attrHint =
              c.attributes.length > 0 ? ` (${c.attributes.length} attrs)` : ""
            return (
              <MenuItem key={c.id} value={c.id}>
                {`${c.name}${extendsHint}${attrHint}`}
              </MenuItem>
            )
          })}
        </Select>
      </Stack>

      <DividerLine width="100%" />

      <InspectorSectionHeader>Attributes</InspectorSectionHeader>
      {nodeData.attributes.map((row, index) => (
        <ObjectAttrRow
          key={row.id}
          row={row}
          displayType={resolveDisplayType(row)}
          enumLiterals={enumLiterals}
          onPatch={(patch) => patchAttribute(row.id, patch)}
          onDelete={() => deleteAttribute(row.id)}
          valueInputRef={(el) => {
            valueRefs.current[index] = el
          }}
          onEnter={() => {
            // Focus the next slot's value input; when this was the
            // last slot, fall through to the add-attribute field (v3
            // focused `newAttributeField` at the end of the list).
            for (
              let i = index + 1;
              i < valueRefs.current.length;
              i++
            ) {
              const el = valueRefs.current[i]
              if (el) {
                el.focus()
                el.select?.()
                return
              }
            }
            addFieldRef.current?.focus()
          }}
        />
      ))}
      {/* Hide the free-form "Add attribute" input when
          this object is linked to a class — its attributes are
          auto-populated from the linked class and editing them ad-hoc
          would diverge from the class definition. The picker is only
          relevant for unlinked / ad-hoc instances. */}
      {!nodeData.classId && (
        <MuiTextField
          size="small"
          variant="outlined"
          fullWidth
          placeholder="+ Add attribute (Enter)"
          value={newAttrName}
          onChange={onAttrChange}
          onKeyDown={onAttrKey}
          inputRef={addFieldRef}
          onBlur={() => {
            if (newAttrName.trim()) {
              addAttribute(newAttrName)
              setNewAttrName("")
            }
          }}
        />
      )}
      {/* No Methods section — objects are
          instances, not types, so UML object diagrams don't show
          methods. */}
    </Box>
  )
}
