import {
  Box,
  InputBase,
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
import { DividerLine, NodeStyleEditor, TextField } from "@/components/ui"
import { PopoverProps } from "@/components/popovers/types"
import { generateUUID } from "@/utils"
import { diagramBridge, IClassInfo } from "@/services/diagramBridge"
import {
  InspectorSectionHeader,
  PaletteIcon,
  RowActionButton,
  TrashIcon,
} from "../_shared"
import { useTranslation } from "@/i18n"

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
  /** Slot names of a class-linked object come from the class. */
  nameReadOnly?: boolean
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
  const { t } = useTranslation()
  const swatch = (
    label: string,
    key: "fillColor" | "textColor",
    fallback: string
  ) => (
    <Stack direction="row" alignItems="center" spacing={1}>
      <span className="bp-detail-label">{label}</span>
      <Tooltip
        title={t("popup.object.colorResetHint", "{{label}} (right-click to reset)", {
          label,
        })}
      >
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
    <Stack direction="row" spacing={2} className="bp-member__details" sx={{ ml: 0 }}>
      {swatch(t("stylePane.fillColor", "Fill Color"), "fillColor", "var(--besser-background, #fff)")}
      {swatch(t("stylePane.textColor", "Text Color"), "textColor", "var(--besser-text, #000)")}
    </Stack>
  )
}

const INT_TYPES = new Set(["int", "integer", "number"])
const FLOAT_TYPES = new Set(["float", "double", "real"])
const BOOL_TYPES = new Set(["bool", "boolean"])
// develop `isDateTimeAttribute` (uml-object-attribute-update.tsx).
const DATE_TYPES = new Set(["date", "localdate"])
const DATETIME_TYPES = new Set([
  "datetime",
  "timestamp",
  "localdatetime",
  "offsetdatetime",
  "zoneddatetime",
  "instant",
])
const TIME_TYPES = new Set(["time", "localtime", "offsettime"])

/**
 * Bring a stored value into the shape a native date / time input accepts
 * (`2000-01-01 10:30:00` -> `2000-01-01T10:30` for datetime-local,
 * `9:05:00` -> `09:05` for time); anything else passes through.
 */
const toNativeDateTimeValue = (
  value: string,
  kind: "date" | "datetime-local" | "time"
): string => {
  if (kind === "datetime-local") {
    const m = value.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/)
    return m ? `${m[1]}T${m[2]}` : value
  }
  if (kind === "time") {
    const m = value.match(/^(\d{1,2}):(\d{2})/)
    return m ? `${m[1].padStart(2, "0")}:${m[2]}` : value
  }
  const m = value.match(/^(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : value
}
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
  nameReadOnly = false,
}) => {
  const { t } = useTranslation()
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
    // A text input (develop used one): a native number input drops a
    // comma decimal ("9,99" -> 999). Floats accept a comma as the decimal
    // separator and store it as a dot.
    valueWidget = (
      <MuiTextField
        size="small"
        variant="outlined"
        placeholder={isInt ? "0" : "0.0"}
        inputProps={{ inputMode: isInt ? "numeric" : "decimal" }}
        value={valueAsString}
        onChange={(e) =>
          commitValue(
            isFloat ? e.target.value.replace(",", ".") : e.target.value
          )
        }
        sx={{ flex: 1 }}
        {...navigationProps}
      />
    )
  } else if (isDate || isDatetime || isTime) {
    const nativeType = isDate ? "date" : isTime ? "time" : "datetime-local"
    valueWidget = (
      <MuiTextField
        size="small"
        variant="outlined"
        type={nativeType}
        placeholder={
          isDate ? "YYYY-MM-DD" : isTime ? "HH:MM" : "YYYY-MM-DDTHH:MM"
        }
        value={toNativeDateTimeValue(valueAsString, nativeType)}
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
        placeholder={t(
          "popup.durationPlaceholder",
          "e.g., 1d 2h 30m, P1DT2H30M, 1:30:00"
        )}
        value={valueAsString}
        onChange={(e) => commitValue(e.target.value)}
        sx={{ flex: 1 }}
        inputProps={{
          title: t(
            "popup.durationTooltip",
            "Enter duration in formats like: '1d 2h 30m', 'P1DT2H30M' (ISO 8601), or 'HH:mm:ss'"
          ),
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
        <MenuItem value="">
          {t("popup.object.selectLiteral", "— select literal —")}
        </MenuItem>
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
        placeholder={t("popup.attributeValuePlaceholder", "value")}
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
    <div className={`bp-member${colorOpen ? " is-open" : ""}`}>
      <div className="bp-member__row" style={{ gap: 4 }}>
        {/* One compound field: `name = value : type`. The MUI widgets
            inside render borderless (see `.bp-field--compound`). */}
        <div className="bp-field bp-field--compound">
          <InputBase
            className="bp-field__name"
            placeholder={t("popup.object.slotNamePlaceholder", "name")}
            value={row.name}
            readOnly={nameReadOnly}
            onChange={(e) =>
              onPatch({ name: e.target.value.replace(/[^a-zA-Z0-9_]/g, "") })
            }
            inputProps={{
              "aria-label": t("popup.object.slotName", "Attribute name"),
              autoComplete: "off",
              spellCheck: false,
            }}
          />
          <span className="bp-field__sep" aria-hidden="true">
            =
          </span>
          <div className="bp-field__value">{valueWidget}</div>
          {displayType && (
            <Tooltip
              title={t(
                "popup.object.typeInherited",
                "type inherited from class: {{type}}",
                { type: displayType }
              )}
            >
              <span className="bp-field__hint">: {displayType}</span>
            </Tooltip>
          )}
        </div>
        <div className="bp-member__actions">
          <RowActionButton
            label={t("stylePane.rowColors", "Row colors")}
            expanded={colorOpen}
            onClick={() => setColorOpen((open) => !open)}
          >
            <PaletteIcon size={14} />
          </RowActionButton>
          <RowActionButton
            danger
            label={t("popup.object.deleteAttribute", "Delete attribute")}
            onClick={onDelete}
          >
            <TrashIcon size={14} />
          </RowActionButton>
        </div>
      </div>
      {colorOpen && <SlotColorControls row={row} onPatch={onPatch} />}
    </div>
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
  const { t } = useTranslation()
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

  // Declared before the early return (Rules of Hooks).
  const [newAttrName, setNewAttrName] = useState("")

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
        // Own name field: its label must say "name" so the properties
        // panel focuses it, not the first slot's name.
        showNameInputChange={false}
        preElements={[
          <TextField
            key="object-name"
            variant="outlined"
            size="small"
            sx={{ flex: 1 }}
            value={nodeData.name ?? ""}
            placeholder={placeholderName}
            onChange={(e) => handleDataFieldUpdate("name", e.target.value)}
            inputProps={{
              "aria-label": t("popup.object.objectName", "Object name"),
              autoComplete: "off",
              spellCheck: false,
            }}
          />,
        ]}
      />
      <DividerLine width="100%" />

      {/* Linked class selector (cross-diagram bridge).
          Mirror v3 `getClassDisplayName` and append the
          inheritance chain (`extends Parent, Other`) so similarly-named
          subclasses are distinguishable. */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
        <span id={`object-class-${elementId}`} className="bp-section-title">
          {t("popup.object.classLabel", "class")}
        </span>
        <Select
          size="small"
          value={nodeData.classId ?? ""}
          displayEmpty
          onChange={(e) => handleClassChange(String(e.target.value))}
          labelId={`object-class-${elementId}`}
          fullWidth
        >
          <MenuItem value="">
            {t("popup.object.unlinked", "— Unlinked —")}
          </MenuItem>
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
              parents.length > 0
                ? ` ${t("popup.object.extendsHint", "extends {{parents}}", {
                    parents: parents.join(", "),
                  })}`
                : ""
            const attrHint =
              c.attributes.length > 0
                ? ` ${t("popup.object.attributeCount", "({{count}} attrs)", {
                    count: c.attributes.length,
                  })}`
                : ""
            return (
              <MenuItem key={c.id} value={c.id}>
                {`${c.name}${extendsHint}${attrHint}`}
              </MenuItem>
            )
          })}
        </Select>
      </Box>

      <DividerLine width="100%" />

      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
      <div className="bp-section-head">
        <InspectorSectionHeader>
          {t("popup.attributes", "Attributes")}
          <span className="bp-section-count">{nodeData.attributes.length}</span>
        </InspectorSectionHeader>
      </div>
      <div className="bp-members">
      {nodeData.attributes.map((row, index) => (
        <ObjectAttrRow
          key={row.id}
          row={row}
          displayType={resolveDisplayType(row)}
          enumLiterals={enumLiterals}
          onPatch={(patch) => patchAttribute(row.id, patch)}
          onDelete={() => deleteAttribute(row.id)}
          nameReadOnly={!!nodeData.classId}
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
        <div className="bp-field bp-field--add">
          <InputBase
            className="bp-field__name"
            placeholder={t(
              "popup.object.addAttributePlaceholder",
              "+ Add attribute (Enter)"
            )}
            value={newAttrName}
            onChange={onAttrChange}
            onKeyDown={onAttrKey}
            inputRef={addFieldRef}
            inputProps={{
              "aria-label": t("popup.object.addAttribute", "Add attribute"),
              autoComplete: "off",
              spellCheck: false,
            }}
            onBlur={() => {
              if (newAttrName.trim()) {
                addAttribute(newAttrName)
                setNewAttrName("")
              }
            }}
          />
        </div>
      )}
      </div>
      </Box>
      {/* No Methods section — objects are
          instances, not types, so UML object diagrams don't show
          methods. */}
    </Box>
  )
}
