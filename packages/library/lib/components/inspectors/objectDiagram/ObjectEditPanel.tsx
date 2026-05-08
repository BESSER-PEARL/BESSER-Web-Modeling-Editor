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
import React, { useMemo, useState, ChangeEvent, KeyboardEvent } from "react"
import { useShallow } from "zustand/shallow"
import { useDiagramStore } from "@/store/context"
import { ObjectNodeAttribute, ObjectNodeProps } from "@/types"
import { DividerLine, NodeStyleEditor, Typography } from "@/components/ui"
import { DeleteIcon } from "@/components/Icon"
import { PopoverProps } from "@/components/popovers/types"
import { generateUUID } from "@/utils"
import { diagramBridge, IClassInfo } from "@/services/diagramBridge"

interface ObjectAttrRowProps {
  row: ObjectNodeAttribute
  /** Cached read-only display type, auto-inherited from the linked class. */
  displayType?: string
  onPatch: (patch: Partial<ObjectNodeAttribute>) => void
  onDelete: () => void
}

/**
 * SA-FIX-OBJECT-DEEP: simplified per-attribute row for the
 * ObjectDiagram inspector. Renders a single inline `name = value`
 * widget — two compact fields side by side with a fixed `=` glyph.
 * The type is read-only (auto-inherited from the linked class) and
 * surfaces only as a small caption beside the value field; v3's
 * type-aware widgets (date pickers, enum dropdowns, custom-type
 * editors) are intentionally dropped here. The full v3 layout lives
 * in `packages/editor/.../uml-object-name-update.tsx`; we mirror its
 * minimal `name = value` shape because that's all an object instance
 * needs to capture (UML object diagrams show data values, not type
 * structure).
 */
const ObjectAttrRow: React.FC<ObjectAttrRowProps> = ({
  row,
  displayType,
  onPatch,
  onDelete,
}) => {
  const valueAsString =
    row.value !== undefined && row.value !== null ? String(row.value) : ""

  return (
    <Stack
      direction="row"
      spacing={0.5}
      alignItems="center"
      sx={{
        padding: "4px 0",
        borderBottom: "1px solid var(--besser-gray, #e9ecef)",
      }}
    >
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
      <MuiTextField
        size="small"
        variant="outlined"
        placeholder="value"
        value={valueAsString}
        onChange={(e) =>
          onPatch({
            value: e.target.value === "" ? undefined : e.target.value,
          })
        }
        sx={{ flex: 1 }}
      />
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
      <Tooltip title="Delete attribute">
        <IconButton size="small" onClick={onDelete}>
          <DeleteIcon width={14} height={14} />
        </IconButton>
      </Tooltip>
    </Stack>
  )
}

/**
 * BESSER ObjectDiagram inspector body. Mirrors `ClassEditPanel` but with
 * the per-instance shape:
 *  - top-level `classId` selector (+ classes from sibling ClassDiagram via
 *    `diagramBridge`),
 *  - per-attribute inline `name = value` text widget (SA-FIX-OBJECT-DEEP),
 *  - no Methods section — objects are instances, not types
 *    (SA-FIX-OBJECT-DEEP),
 *  - no visibility / id-flag controls (object instances inherit those
 *    from their class).
 *
 * SA-2.1: auto-populates attributes from the linked class on `classId`
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

  const availableClasses = useMemo<IClassInfo[]>(() => {
    try {
      return diagramBridge.getAvailableClasses()
    } catch {
      return []
    }
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
    // PC-4 Gap 3: object instances don't carry visibility semantics, so
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
          PC-4 Gap 2: mirror v3 `getClassDisplayName` and append the
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

      <Typography variant="h6">Attributes</Typography>
      {nodeData.attributes.map((row) => (
        <ObjectAttrRow
          key={row.id}
          row={row}
          displayType={resolveDisplayType(row)}
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
      {/* SA-FIX-OBJECT-DEEP: no Methods section — objects are
          instances, not types, so UML object diagrams don't show
          methods. */}
    </Box>
  )
}
