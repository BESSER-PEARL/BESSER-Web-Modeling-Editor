import {
  Box,
  Checkbox,
  FormControlLabel,
  IconButton,
  MenuItem,
  Select,
  Stack,
  TextField as MuiTextField,
  Tooltip,
} from "@mui/material"
import React, { useMemo, useState, ChangeEvent, KeyboardEvent } from "react"
import { useShallow } from "zustand/shallow"
import CodeMirror from "@uiw/react-codemirror"
import { python } from "@codemirror/lang-python"
import { useDiagramStore } from "@/store/context"
import {
  ClassNodeElement,
  ClassNodeProps,
  ClassType,
  ClassifierMethodImplementationType,
  ClassifierMethodParameter,
  ClassifierVisibility,
  ClassOCLConstraint,
} from "@/types"
import { DividerLine, NodeStyleEditor, Typography } from "@/components/ui"
import { StereotypeButtonGroup } from "@/components/ui/StereotypeButtonGroup"
import { DeleteIcon, EditIcon } from "@/components/Icon"
import { PopoverProps } from "@/components/popovers/types"
import {
  VISIBILITY_SYMBOLS,
  normalizeType,
} from "@/utils/typeNormalization"
import { generateUUID } from "@/utils"
import { diagramBridge } from "@/services/diagramBridge"

/**
 * SA-2.1 helper: collect sibling Enumerations from the bridge data so the
 * attribute-type picker can offer them. Mirrors v3
 * `uml-classifier-update.tsx:200-202`.
 */
const collectEnumerationNames = (): string[] => {
  const data = diagramBridge.getClassDiagramData()
  if (!data) return []
  return (data.nodes || [])
    .filter(
      (n: { type?: string; data?: { stereotype?: string | null } }) =>
        // v4: stereotype === 'Enumeration' on `class`. v3 leak: type === 'Enumeration'.
        (n.type === "class" && n.data?.stereotype === "Enumeration") ||
        n.type === "Enumeration"
    )
    .map((n: { data?: { name?: string } }) => n.data?.name ?? "")
    .filter((s): s is string => !!s)
}

/**
 * SA-2.1 sanitiser for identifier-like fields. Mirrors v3
 * `uml-classifier-update.tsx:475` (class name) and the attribute-name
 * sanitiser already used elsewhere in this panel.
 */
const safeIdentifier = (raw: string): string =>
  raw.replace(/[^a-zA-Z0-9_]/g, "")

/**
 * Primitive type catalogue, mirrored verbatim from the v3 fork
 * (`packages/editor/.../uml-classifier-attribute-update.tsx`). Anything
 * outside this list is committed as a "custom" type after running
 * through `normalizeType()` so aliases (`String` → `str`) collapse
 * before reaching the round-trip layer.
 */
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

// SA-UX-FIX B7: visibility dropdown shows only the canonical UML symbols
// (`+ / - / # / ~`). The full word (`public`, etc.) is still the stored
// value — only the display label is the symbol.
const VISIBILITIES: { value: ClassifierVisibility; label: string }[] = [
  { value: "public", label: VISIBILITY_SYMBOLS.public },
  { value: "private", label: VISIBILITY_SYMBOLS.private },
  { value: "protected", label: VISIBILITY_SYMBOLS.protected },
  { value: "package", label: VISIBILITY_SYMBOLS.package },
]

const IMPLEMENTATION_TYPES: {
  value: ClassifierMethodImplementationType
  label: string
}[] = [
  { value: "none", label: "None (UML)" },
  { value: "code", label: "Python Code" },
  { value: "bal", label: "BESSER Action Language" },
  { value: "state_machine", label: "State Machine" },
  { value: "quantum_circuit", label: "Quantum Circuit" },
]

const CUSTOM_TYPE_SENTINEL = "__custom__"

/**
 * Hook helper: write a partial node update through Zustand. Used by every
 * row-level commit below.
 */
const useUpdateNode = (elementId: string) => {
  const { setNodes } = useDiagramStore(
    useShallow((state) => ({ setNodes: state.setNodes }))
  )
  return (updater: (data: ClassNodeProps) => ClassNodeProps) => {
    setNodes((nodes) =>
      nodes.map((node) => {
        if (node.id !== elementId) return node
        const next = updater(node.data as ClassNodeProps)
        return { ...node, data: { ...node.data, ...next } }
      })
    )
  }
}

const isPrimitiveType = (t: string | undefined): boolean =>
  !!t && PRIMITIVE_TYPES.some((p) => p.value === t)

/* -------------------------------------------------------------------------- */
/* Attribute row                                                               */
/* -------------------------------------------------------------------------- */

interface AttributeRowProps {
  row: ClassNodeElement
  classNames: string[]
  /** SA-2.1: enumeration names from sibling Enumerations. */
  enumerationNames: string[]
  onPatch: (patch: Partial<ClassNodeElement>) => void
  onDelete: () => void
  /**
   * SA-FIX-CRITICAL-2 #2: when the parent class is an Enumeration the
   * row is a literal — hide the visibility dropdown and the type
   * dropdown columns. Just the name + delete remain.
   */
  isEnumerationParent?: boolean
}

const AttributeRow: React.FC<AttributeRowProps> = ({
  row,
  classNames,
  enumerationNames,
  onPatch,
  onDelete,
  isEnumerationParent = false,
}) => {
  const visibility = row.visibility ?? "public"
  const attributeType = row.attributeType ?? "str"
  const isCustom = !isPrimitiveType(attributeType)
  const [customTypeDraft, setCustomTypeDraft] = useState(
    isCustom ? attributeType : ""
  )
  // SA-UX-FIX B3: collapse the four flag checkboxes (`isId`,
  // `isExternalId`, `isOptional`, `isDerived`) and the default-value
  // input behind a per-row settings toggle so the inline row is just
  // visibility + name + type + delete.
  const [showSettings, setShowSettings] = useState(
    !!row.isId ||
      !!row.isExternalId ||
      !!row.isOptional ||
      !!row.isDerived ||
      (row.defaultValue !== undefined && row.defaultValue !== "")
  )

  const handleTypeSelect = (value: string) => {
    if (value === CUSTOM_TYPE_SENTINEL) {
      onPatch({ attributeType: customTypeDraft || attributeType })
      return
    }
    onPatch({ attributeType: normalizeType(value) })
  }

  const handleCustomTypeBlur = () => {
    if (customTypeDraft.trim()) {
      onPatch({ attributeType: normalizeType(customTypeDraft.trim()) })
    }
  }

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
        {/* SA-FIX-CRITICAL-2 #2: hide visibility dropdown for Enumeration
            literals — they're just names, no UML access modifier. */}
        {!isEnumerationParent && (
          <Select
            size="small"
            value={visibility}
            onChange={(e) =>
              onPatch({ visibility: e.target.value as ClassifierVisibility })
            }
            sx={{ minWidth: 70 }}
          >
            {VISIBILITIES.map((v) => (
              <MenuItem key={v.value} value={v.value}>
                {v.label}
              </MenuItem>
            ))}
          </Select>
        )}
        <MuiTextField
          size="small"
          variant="outlined"
          fullWidth
          placeholder={isEnumerationParent ? "literal name" : "attribute name"}
          value={row.name}
          onChange={(e) =>
            onPatch({
              name: e.target.value.replace(/[^a-zA-Z0-9_]/g, ""),
            })
          }
        />
        {/* SA-FIX-CRITICAL-2 #2: hide type dropdown for Enumeration
            literals — they don't carry an attribute type. */}
        {!isEnumerationParent && (
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
            {enumerationNames.length > 0 && [
              <MenuItem key="__edivider__" disabled>
                ── enumerations ──
              </MenuItem>,
              ...enumerationNames.map((en) => (
                <MenuItem key={`enum-${en}`} value={en}>
                  {en}
                </MenuItem>
              )),
            ]}
            <MenuItem value={CUSTOM_TYPE_SENTINEL}>custom…</MenuItem>
          </Select>
        )}
        {!isEnumerationParent && (
          <Tooltip title={showSettings ? "Hide flags" : "Show flags & default"}>
            <IconButton
              size="small"
              onClick={() => setShowSettings((s) => !s)}
              sx={{
                color: showSettings ? "var(--besser-primary, #3e8acc)" : undefined,
              }}
            >
              <EditIcon width={14} height={14} />
            </IconButton>
          </Tooltip>
        )}
        <Tooltip title={isEnumerationParent ? "Delete literal" : "Delete attribute"}>
          <IconButton size="small" onClick={onDelete}>
            <DeleteIcon width={14} height={14} />
          </IconButton>
        </Tooltip>
      </Stack>

      {!isEnumerationParent && isCustom && (
        <MuiTextField
          size="small"
          variant="outlined"
          fullWidth
          placeholder="custom type (free-text)"
          value={customTypeDraft || attributeType}
          onChange={(e) => setCustomTypeDraft(e.target.value)}
          onBlur={handleCustomTypeBlur}
        />
      )}

      {/* SA-UX-FIX B3: flags + default value collapse behind the
          per-row settings (gear) toggle. v3 had the same affordance —
          see `uml-classifier-attribute-update.tsx`.
          SA-FIX-CRITICAL-2 #2: Enumeration literals carry no flags or
          default value, so the gear icon is hidden and the panel must
          not render even if `showSettings` is initially true (legacy
          fixtures may have stamped flags on enum literals). */}
      {!isEnumerationParent && showSettings && (
        <>
          <Stack direction="row" spacing={1.5} flexWrap="wrap">
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={!!row.isId}
                  onChange={(e) =>
                    onPatch({
                      isId: e.target.checked,
                      // Mutual-exclusion mirroring v3 metamodel constraint.
                      isOptional: e.target.checked ? false : row.isOptional,
                    })
                  }
                />
              }
              label={<Typography variant="caption">id</Typography>}
            />
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={!!row.isExternalId}
                  onChange={(e) =>
                    onPatch({
                      isExternalId: e.target.checked,
                      isOptional: e.target.checked ? false : row.isOptional,
                    })
                  }
                />
              }
              label={<Typography variant="caption">external id</Typography>}
            />
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={!!row.isOptional}
                  onChange={(e) => onPatch({ isOptional: e.target.checked })}
                />
              }
              label={<Typography variant="caption">optional</Typography>}
            />
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={!!row.isDerived}
                  onChange={(e) => onPatch({ isDerived: e.target.checked })}
                />
              }
              label={<Typography variant="caption">derived</Typography>}
            />
          </Stack>

          {/* SA-UX-FIX B6: default value is always a plain string text
              input — class attribute types aren't enforced at this
              layer, so type-aware widgets are wrong here. (Object
              diagram values keep their type-aware widget — see
              `ObjectEditPanel`.) */}
          <MuiTextField
            size="small"
            variant="outlined"
            fullWidth
            type="text"
            placeholder="default value (optional)"
            value={row.defaultValue !== undefined ? String(row.defaultValue) : ""}
            onChange={(e) =>
              onPatch({
                defaultValue: e.target.value === "" ? undefined : e.target.value,
              })
            }
          />
        </>
      )}
    </Box>
  )
}

/* -------------------------------------------------------------------------- */
/* Method row                                                                  */
/* -------------------------------------------------------------------------- */

interface MethodRowProps {
  row: ClassNodeElement
  classNames: string[]
  stateMachines: { id: string; name: string }[]
  quantumCircuits: { id: string; name: string }[]
  onPatch: (patch: Partial<ClassNodeElement>) => void
  onDelete: () => void
}

const MethodRow: React.FC<MethodRowProps> = ({
  row,
  classNames,
  stateMachines,
  quantumCircuits,
  onPatch,
  onDelete,
}) => {
  const visibility = row.visibility ?? "public"
  const returnType = row.returnType ?? row.attributeType ?? "any"
  const isCustomReturn = !isPrimitiveType(returnType)
  const [customReturnDraft, setCustomReturnDraft] = useState(
    isCustomReturn ? returnType : ""
  )
  const implementationType: ClassifierMethodImplementationType =
    row.implementationType ?? "none"
  const parameters = row.parameters ?? []
  // SA-UX-FIX B3: collapse the parameters block + implementation-type
  // section behind a per-row settings toggle so the inline row stays
  // compact (visibility + name + return type only).
  const [showSettings, setShowSettings] = useState(
    parameters.length > 0 ||
      implementationType !== "none" ||
      !!row.code ||
      !!row.stateMachineId ||
      !!row.quantumCircuitId
  )

  const handleReturnSelect = (value: string) => {
    if (value === CUSTOM_TYPE_SENTINEL) {
      const t = customReturnDraft || returnType
      onPatch({ returnType: t, attributeType: t })
      return
    }
    const t = normalizeType(value)
    onPatch({ returnType: t, attributeType: t })
  }

  const patchParameters = (next: ClassifierMethodParameter[]) => {
    onPatch({ parameters: next })
  }

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
        <Select
          size="small"
          value={visibility}
          onChange={(e) =>
            onPatch({ visibility: e.target.value as ClassifierVisibility })
          }
          sx={{ minWidth: 70 }}
        >
          {VISIBILITIES.map((v) => (
            <MenuItem key={v.value} value={v.value}>
              {v.label}
            </MenuItem>
          ))}
        </Select>
        <MuiTextField
          size="small"
          variant="outlined"
          fullWidth
          placeholder="method name"
          value={row.name}
          // SA-FIX-CLASS-FUND #3: method names are committed as Python
          // identifiers (no spaces, no punctuation other than `_`).
          // Mirrors the attribute-name sanitiser at the row above and
          // v3 `uml-classifier-update.tsx:475`.
          onChange={(e) =>
            onPatch({ name: e.target.value.replace(/[^a-zA-Z0-9_]/g, "") })
          }
        />
        <Tooltip
          title={showSettings ? "Hide parameters & code" : "Parameters & code"}
        >
          <IconButton
            size="small"
            onClick={() => setShowSettings((s) => !s)}
            sx={{
              color: showSettings ? "var(--besser-primary, #3e8acc)" : undefined,
            }}
          >
            <EditIcon width={14} height={14} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete method">
          <IconButton size="small" onClick={onDelete}>
            <DeleteIcon width={14} height={14} />
          </IconButton>
        </Tooltip>
      </Stack>

      {/* Return-type dropdown — same options as attribute type. */}
      <Stack direction="row" spacing={0.5} alignItems="center">
        <Typography variant="caption" sx={{ minWidth: 70 }}>
          returns
        </Typography>
        <Select
          size="small"
          value={isCustomReturn ? CUSTOM_TYPE_SENTINEL : returnType}
          onChange={(e) => handleReturnSelect(String(e.target.value))}
          sx={{ minWidth: 110 }}
        >
          {PRIMITIVE_TYPES.map((p) => (
            <MenuItem key={p.value} value={p.value}>
              {p.label}
            </MenuItem>
          ))}
          {classNames.length > 0 && [
            <MenuItem key="__rdivider__" disabled>
              ── classes ──
            </MenuItem>,
            ...classNames.map((cn) => (
              <MenuItem key={`rclass-${cn}`} value={cn}>
                {cn}
              </MenuItem>
            )),
          ]}
          <MenuItem value={CUSTOM_TYPE_SENTINEL}>custom…</MenuItem>
        </Select>
        {isCustomReturn && (
          <MuiTextField
            size="small"
            variant="outlined"
            placeholder="custom return type"
            value={customReturnDraft || returnType}
            onChange={(e) => setCustomReturnDraft(e.target.value)}
            onBlur={() => {
              if (customReturnDraft.trim()) {
                const t = normalizeType(customReturnDraft.trim())
                onPatch({ returnType: t, attributeType: t })
              }
            }}
            sx={{ flex: 1 }}
          />
        )}
      </Stack>

      {/* SA-UX-FIX B3: parameters + implementation type + code editor are
          collapsed behind the per-row settings toggle so the row stays
          compact when the user is just naming methods. */}
      {showSettings && (
        <>
      {/* Parameter rows */}
      <Box>
        <Typography variant="caption" sx={{ fontWeight: 600 }}>
          Parameters
        </Typography>
        {parameters.map((p, idx) => (
          <Stack
            key={p.id}
            direction="row"
            spacing={0.5}
            alignItems="center"
            sx={{ marginTop: 0.5 }}
          >
            <MuiTextField
              size="small"
              variant="outlined"
              placeholder="name"
              value={p.name}
              onChange={(e) => {
                const next = [...parameters]
                next[idx] = { ...p, name: e.target.value }
                patchParameters(next)
              }}
              sx={{ flex: 1 }}
            />
            <MuiTextField
              size="small"
              variant="outlined"
              placeholder="type"
              value={p.parameterType ?? ""}
              onChange={(e) => {
                const next = [...parameters]
                next[idx] = { ...p, parameterType: e.target.value }
                patchParameters(next)
              }}
              sx={{ width: 90 }}
              onBlur={() => {
                const t = p.parameterType
                if (t) {
                  const next = [...parameters]
                  next[idx] = { ...p, parameterType: normalizeType(t) }
                  patchParameters(next)
                }
              }}
            />
            <IconButton
              size="small"
              onClick={() =>
                patchParameters(parameters.filter((_, i) => i !== idx))
              }
            >
              <DeleteIcon width={14} height={14} />
            </IconButton>
          </Stack>
        ))}
        <MuiTextField
          size="small"
          variant="outlined"
          placeholder="+ add parameter (Enter)"
          fullWidth
          sx={{ marginTop: 0.5 }}
          onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
            if (e.key === "Enter") {
              const target = e.target as HTMLInputElement
              const v = target.value.trim()
              if (!v) return
              patchParameters([
                ...parameters,
                { id: generateUUID(), name: v },
              ])
              target.value = ""
            }
          }}
        />
      </Box>

      {/* Implementation type and cross-diagram dropdowns */}
      <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap">
        <Typography variant="caption" sx={{ minWidth: 70 }}>
          impl
        </Typography>
        <Select
          size="small"
          value={implementationType}
          onChange={(e) => {
            const next = e.target.value as ClassifierMethodImplementationType
            const patch: Partial<ClassNodeElement> = { implementationType: next }
            if (next === "state_machine") {
              patch.code = ""
              patch.quantumCircuitId = ""
            } else if (next === "quantum_circuit") {
              patch.code = ""
              patch.stateMachineId = ""
            } else if (next === "none") {
              patch.code = ""
              patch.stateMachineId = ""
              patch.quantumCircuitId = ""
            } else {
              patch.stateMachineId = ""
              patch.quantumCircuitId = ""
            }
            onPatch(patch)
          }}
          sx={{ minWidth: 140 }}
        >
          {IMPLEMENTATION_TYPES.map((it) => (
            <MenuItem key={it.value} value={it.value}>
              {it.label}
            </MenuItem>
          ))}
        </Select>
        {implementationType === "state_machine" && (
          <Select
            size="small"
            value={row.stateMachineId ?? ""}
            displayEmpty
            onChange={(e) =>
              onPatch({ stateMachineId: String(e.target.value) })
            }
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="">— Select State Machine —</MenuItem>
            {stateMachines.map((sm) => (
              <MenuItem key={sm.id} value={sm.id}>
                {sm.name}
              </MenuItem>
            ))}
          </Select>
        )}
        {implementationType === "quantum_circuit" && (
          <Select
            size="small"
            value={row.quantumCircuitId ?? ""}
            displayEmpty
            onChange={(e) =>
              onPatch({ quantumCircuitId: String(e.target.value) })
            }
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="">— Select Quantum Circuit —</MenuItem>
            {quantumCircuits.map((qc) => (
              <MenuItem key={qc.id} value={qc.id}>
                {qc.name}
              </MenuItem>
            ))}
          </Select>
        )}
      </Stack>

      {(implementationType === "code" || implementationType === "bal") && (
        <Box
          sx={{
            border: "1px solid var(--besser-gray, #e9ecef)",
            borderRadius: 1,
            overflow: "hidden",
            "& .cm-editor": {
              fontSize: "13px",
              minHeight: 80,
            },
          }}
        >
          {/*
           * SA-2.1 CodeMirror port — replaces the plain MUI multiline
           * TextField for `code` / `bal` implementation types so the v3
           * Python-syntax-highlighting + tab-indent UX is preserved.
           * Source-of-truth: `uml-classifier-update.tsx` code editor.
           * BAL is treated as Python-flavored for syntax highlighting
           * (the v3 fork does the same — both share the same lexical
           * grammar; BAL is a domain-specific subset).
           */}
          <CodeMirror
            value={row.code ?? ""}
            extensions={[python()]}
            onChange={(value) => onPatch({ code: value })}
            basicSetup={{
              lineNumbers: true,
              tabSize: 4,
              indentOnInput: true,
            }}
            placeholder={
              implementationType === "bal"
                ? "BAL method body…"
                : "Python method body…"
            }
          />
        </Box>
      )}
        </>
      )}
    </Box>
  )
}

/* -------------------------------------------------------------------------- */
/* OCL constraint row                                                          */
/* -------------------------------------------------------------------------- */

interface OCLConstraintRowProps {
  row: ClassOCLConstraint
  onPatch: (patch: Partial<ClassOCLConstraint>) => void
  onDelete: () => void
}

const OCLConstraintRow: React.FC<OCLConstraintRowProps> = ({
  row,
  onPatch,
  onDelete,
}) => (
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
      <MuiTextField
        size="small"
        variant="outlined"
        placeholder="constraint name"
        value={row.name}
        onChange={(e) => onPatch({ name: e.target.value })}
        sx={{ flex: 1 }}
      />
      <IconButton size="small" onClick={onDelete}>
        <DeleteIcon width={14} height={14} />
      </IconButton>
    </Stack>
    <MuiTextField
      size="small"
      variant="outlined"
      multiline
      minRows={2}
      maxRows={8}
      placeholder="OCL expression…"
      value={row.expression}
      onChange={(e) => onPatch({ expression: e.target.value })}
    />
  </Box>
)

/* -------------------------------------------------------------------------- */
/* Main panel                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * BESSER ClassDiagram inspector body. Renders identically in popover and
 * properties-panel contexts — `PropertiesPanel` and `PopoverManager` both
 * pull this component from the inspector registry.
 *
 * Source-of-truth port: combines the v3 fork's
 * `uml-classifier-attribute-update.tsx`,
 * `uml-classifier-method-update.tsx`, and the old `ClassEditPopover`
 * popup body.
 */
export const ClassEditPanel: React.FC<PopoverProps> = ({ elementId }) => {
  const { nodes, setNodes } = useDiagramStore(
    useShallow((state) => ({
      nodes: state.nodes,
      setNodes: state.setNodes,
    }))
  )
  const node = nodes.find((n) => n.id === elementId)
  const updateNode = useUpdateNode(elementId)

  // Cross-diagram pickers. The bridge service is populated by the embedding
  // webapp via `setStateMachineDiagrams` / `setQuantumCircuitDiagrams`
  // before opening the editor (see frontend/CLAUDE.md
  // `BesserEditorComponent.tsx`).
  const availableClassNames = useMemo(() => {
    try {
      return diagramBridge
        .getAvailableClasses()
        .map((c) => c.name)
        .filter((n) => !!n)
    } catch {
      return []
    }
  }, [nodes])

  // SA-2.1: enumeration list for the attribute-type picker (P12).
  const enumerationNames = useMemo(() => collectEnumerationNames(), [nodes])

  const stateMachineDiagrams = diagramBridge.getStateMachineDiagrams()
  const quantumCircuitDiagrams = diagramBridge.getQuantumCircuitDiagrams()

  if (!node) return null
  const nodeData = node.data as ClassNodeProps

  /* ----- Top-level node update helpers ----------------------------------- */

  const handleDataFieldUpdate = (key: string, value: string) => {
    // SA-2.1 (P10): class `name` field must be sanitised on commit, mirroring
    // v3 `uml-classifier-update.tsx:475`. Other fields (style colors, etc.)
    // pass through unchanged.
    const sanitised = key === "name" ? safeIdentifier(value) : value
    updateNode((d) => ({ ...d, [key]: sanitised }))
  }

  /* ----- Attribute helpers ----------------------------------------------- */

  const patchAttribute = (
    attrId: string,
    patch: Partial<ClassNodeElement>
  ) => {
    updateNode((d) => ({
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
        const data = n.data as ClassNodeProps
        const nextAttrs = data.attributes.filter((a) => a.id !== attrId)
        return {
          ...n,
          data: { ...data, attributes: nextAttrs },
          height: n.height ? n.height - 30 : n.height,
          measured: n.measured
            ? { ...n.measured, height: (n.measured.height ?? 0) - 30 }
            : n.measured,
        }
      })
    )
  }

  // SA-FIX-CLASS-FUND #10: when no name is provided, generate
  // `attribute1`, `attribute2`, … by scanning existing attribute names
  // for the highest `attribute<N>` (or `method<N>`) suffix. Mirrors the
  // v3 add-row affordance (auto-named on click).
  const nextAutoName = (
    existing: ClassNodeElement[],
    base: "attribute" | "method"
  ): string => {
    const re = new RegExp(`^${base}(\\d+)$`)
    let max = 0
    for (const r of existing) {
      const m = r.name?.match(re)
      if (m) {
        const n = parseInt(m[1], 10)
        if (Number.isFinite(n) && n > max) max = n
      }
    }
    return `${base}${max + 1}`
  }

  const addAttribute = (rawName: string) => {
    const sanitised = rawName.trim().replace(/[^a-zA-Z0-9_]/g, "")
    const data = (nodes.find((n) => n.id === elementId)?.data ??
      {}) as ClassNodeProps
    const attrName =
      sanitised || nextAutoName(data.attributes ?? [], "attribute")
    const newAttr: ClassNodeElement = {
      id: generateUUID(),
      name: attrName,
      attributeType: "str",
      visibility: "public",
    }
    setNodes((nodes) =>
      nodes.map((n) => {
        if (n.id !== elementId) return n
        const data = n.data as ClassNodeProps
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

  /* ----- Method helpers -------------------------------------------------- */

  const patchMethod = (methodId: string, patch: Partial<ClassNodeElement>) => {
    updateNode((d) => ({
      ...d,
      methods: d.methods.map((m) =>
        m.id === methodId ? { ...m, ...patch } : m
      ),
    }))
  }

  const deleteMethod = (methodId: string) => {
    setNodes((nodes) =>
      nodes.map((n) => {
        if (n.id !== elementId) return n
        const data = n.data as ClassNodeProps
        const nextMethods = data.methods.filter((m) => m.id !== methodId)
        return {
          ...n,
          data: { ...data, methods: nextMethods },
          height: n.height ? n.height - 30 : n.height,
          measured: n.measured
            ? { ...n.measured, height: (n.measured.height ?? 0) - 30 }
            : n.measured,
        }
      })
    )
  }

  const addMethod = (rawName: string) => {
    // SA-FIX-CLASS-FUND #3 + #10: sanitise to Python identifier and
    // fall back to `method1`, `method2`, … when the input is empty.
    const sanitised = rawName.trim().replace(/[^a-zA-Z0-9_]/g, "")
    const data = (nodes.find((n) => n.id === elementId)?.data ??
      {}) as ClassNodeProps
    const methodName =
      sanitised || nextAutoName(data.methods ?? [], "method")
    const newMethod: ClassNodeElement = {
      id: generateUUID(),
      name: methodName,
      visibility: "public",
      attributeType: "any",
      returnType: "any",
      parameters: [],
      implementationType: "none",
    }
    setNodes((nodes) =>
      nodes.map((n) => {
        if (n.id !== elementId) return n
        const data = n.data as ClassNodeProps
        return {
          ...n,
          data: { ...data, methods: [...data.methods, newMethod] },
          height: n.height ? n.height + 30 : n.height,
          measured: n.measured
            ? { ...n.measured, height: (n.measured.height ?? 0) + 30 }
            : n.measured,
        }
      })
    )
  }

  /* ----- OCL constraint helpers ----------------------------------------- */

  const patchOcl = (oclId: string, patch: Partial<ClassOCLConstraint>) => {
    updateNode((d) => ({
      ...d,
      oclConstraints: (d.oclConstraints ?? []).map((c) =>
        c.id === oclId ? { ...c, ...patch } : c
      ),
    }))
  }

  const deleteOcl = (oclId: string) => {
    updateNode((d) => ({
      ...d,
      oclConstraints: (d.oclConstraints ?? []).filter((c) => c.id !== oclId),
    }))
  }

  const addOcl = () => {
    updateNode((d) => ({
      ...d,
      oclConstraints: [
        ...(d.oclConstraints ?? []),
        { id: generateUUID(), name: "constraint", expression: "" },
      ],
    }))
  }

  /* ----- Local "add new row" inputs ------------------------------------- */

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
      addMethod(newMethodName)
      setNewMethodName("")
    }
  }
  const onMethodChange = (e: ChangeEvent<HTMLInputElement>) =>
    setNewMethodName(e.target.value)

  /* ----- Render --------------------------------------------------------- */

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 1,
      }}
    >
      <NodeStyleEditor
        nodeData={nodeData}
        handleDataFieldUpdate={handleDataFieldUpdate}
      />
      <DividerLine width="100%" />
      <StereotypeButtonGroup
        nodeId={elementId}
        selectedStereotype={
          nodeData.stereotype as unknown as ClassType | undefined
        }
      />
      <DividerLine width="100%" />

      {/* SA-FINAL C4: Metadata fields (description / uri / icon) — mirror v3
          `uml-classifier-update.tsx` `StylePane`. Stored on `data.description`,
          `data.uri`, `data.icon`; round-tripped by `convertV4ToV3Class`. */}
      <Typography variant="h6">Metadata</Typography>
      <MuiTextField
        size="small"
        variant="outlined"
        fullWidth
        multiline
        minRows={2}
        placeholder="description"
        value={nodeData.description ?? ""}
        onChange={(e) =>
          updateNode((d) => ({ ...d, description: e.target.value }))
        }
      />
      <MuiTextField
        size="small"
        variant="outlined"
        fullWidth
        placeholder="uri (e.g. https://example.com/MyClass)"
        value={nodeData.uri ?? ""}
        onChange={(e) => updateNode((d) => ({ ...d, uri: e.target.value }))}
      />
      <MuiTextField
        size="small"
        variant="outlined"
        fullWidth
        placeholder="icon (svg body or url)"
        value={nodeData.icon ?? ""}
        onChange={(e) => updateNode((d) => ({ ...d, icon: e.target.value }))}
      />
      <DividerLine width="100%" />

      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="h6">Attributes</Typography>
        {/* SA-FIX-CLASS-FUND #10: explicit + button auto-names the new
            row as `attribute1`, `attribute2`, … */}
        <Tooltip title="Add attribute">
          <IconButton size="small" onClick={() => addAttribute("")}>
            <Typography variant="caption">+</Typography>
          </IconButton>
        </Tooltip>
      </Stack>
      {nodeData.attributes.map((row) => (
        <AttributeRow
          key={row.id}
          row={row}
          classNames={availableClassNames}
          enumerationNames={enumerationNames}
          onPatch={(patch) => patchAttribute(row.id, patch)}
          onDelete={() => deleteAttribute(row.id)}
          /* SA-FIX-CRITICAL-2 #2: hide visibility + type columns for
             Enumeration literals. */
          isEnumerationParent={nodeData.stereotype === "Enumeration"}
        />
      ))}
      <MuiTextField
        size="small"
        variant="outlined"
        fullWidth
        placeholder="+ Add attribute (Enter for auto-name)"
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

      {/* SA-2.1 (P11): v3 hid the Methods section for Enumeration stereotype
          (see `uml-classifier-update.tsx:344`). v4 mirrors that hide rule. */}
      {nodeData.stereotype !== "Enumeration" && (
        <>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
          >
            <Typography variant="h6">Methods</Typography>
            {/* SA-FIX-CLASS-FUND #10: + button auto-names new method
                as `method1`, `method2`, … */}
            <Tooltip title="Add method">
              <IconButton size="small" onClick={() => addMethod("")}>
                <Typography variant="caption">+</Typography>
              </IconButton>
            </Tooltip>
          </Stack>
          {nodeData.methods.map((row) => (
            <MethodRow
              key={row.id}
              row={row}
              classNames={availableClassNames}
              stateMachines={stateMachineDiagrams}
              quantumCircuits={quantumCircuitDiagrams}
              onPatch={(patch) => patchMethod(row.id, patch)}
              onDelete={() => deleteMethod(row.id)}
            />
          ))}
          <MuiTextField
            size="small"
            variant="outlined"
            fullWidth
            placeholder="+ Add method (Enter)"
            value={newMethodName}
            onChange={onMethodChange}
            onKeyDown={onMethodKey}
            onBlur={() => {
              if (newMethodName.trim()) {
                addMethod(newMethodName)
                setNewMethodName("")
              }
            }}
          />

          <DividerLine width="100%" />
        </>
      )}

      {/*
        OCL Constraints section intentionally NOT rendered in the
        Class inspector. Per user direction, OCL constraints are
        edited only via the dedicated sticky-note node
        (`ClassOCLConstraint`) and its `ClassOCLConstraintEditPanel`.
        Any constraints already collapsed onto `data.oclConstraints`
        by the v3→v4 migrator are still preserved on the data and
        round-trip cleanly — they're just not exposed in this UI.
      */}
    </Box>
  )
}
