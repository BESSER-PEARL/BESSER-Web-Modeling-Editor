import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
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
} from "@/types"
import { DividerLine, NodeStyleEditor, Typography } from "@/components/ui"
import { StereotypeButtonGroup } from "@/components/ui/StereotypeButtonGroup"
import { DeleteIcon, EditIcon } from "@/components/Icon"
import { PopoverProps } from "@/components/popovers/types"
import {
  VISIBILITY_SYMBOLS,
  normalizeType,
} from "@/utils/typeNormalization"
import {
  extractMethodSignatureFromCode,
  mergeParameterIds,
  parseAttributeInput,
  parseMethodInput,
  sanitizeIdentifier,
  sanitizeNumericDefault,
  selectDefaultValueWidget,
} from "@/utils/classifierMemberDisplay"
import { generateUUID } from "@/utils"
import { diagramBridge } from "@/services/diagramBridge"
import { InspectorSectionHeader, AddRowButton, RowColorSwatch } from "../_shared"

/**
 * Tiny up/down arrow glyphs used by the row reorder
 * gutter. Inline SVG (matches the rest of `@/components/Icon`) so we
 * don't need a new icon-pack dependency.
 */
const ArrowUpSvg: React.FC<{ width?: number; height?: number }> = ({
  width = 14,
  height = 14,
}) => (
  <svg
    width={width}
    height={height}
    viewBox="0 -960 960 960"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M440-160v-487L216-423l-56-57 320-320 320 320-56 57-224-224v487h-80Z" />
  </svg>
)

const ArrowDownSvg: React.FC<{ width?: number; height?: number }> = ({
  width = 14,
  height = 14,
}) => (
  <svg
    width={width}
    height={height}
    viewBox="0 -960 960 960"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M480-160 160-480l56-57 224 224v-487h80v487l224-224 56 57-320 320Z" />
  </svg>
)

/**
 * Left-gutter reorder controls for the attribute /
 * method rows. Mirrors v3 `uml-classifier-update.tsx:64-91, 254-274`.
 * Up-button hides on the first row, down-button hides on the last row.
 */
interface ReorderGutterProps {
  onMoveUp?: () => void
  onMoveDown?: () => void
}

const ReorderGutter: React.FC<ReorderGutterProps> = ({
  onMoveUp,
  onMoveDown,
}) => (
  <Stack
    direction="column"
    spacing={0}
    sx={{
      width: 18,
      flexShrink: 0,
      alignSelf: "stretch",
      justifyContent: "center",
    }}
  >
    {onMoveUp ? (
      <Tooltip title="Move row up">
        <IconButton
          size="small"
          onClick={onMoveUp}
          sx={{ padding: "1px" }}
          aria-label="Move row up"
        >
          <ArrowUpSvg />
        </IconButton>
      </Tooltip>
    ) : (
      <Box sx={{ height: 18 }} />
    )}
    {onMoveDown ? (
      <Tooltip title="Move row down">
        <IconButton
          size="small"
          onClick={onMoveDown}
          sx={{ padding: "1px" }}
          aria-label="Move row down"
        >
          <ArrowDownSvg />
        </IconButton>
      </Tooltip>
    ) : (
      <Box sx={{ height: 18 }} />
    )}
  </Stack>
)

/**
 * Helper: collect sibling Enumerations from the bridge data so the
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
 * Sanitiser for identifier-like fields. Mirrors v3
 * `uml-classifier-update.tsx:475` (class name) and the attribute-name
 * sanitiser already used elsewhere in this panel. Re-exported from the
 * shared parsing helpers so the add/rename shorthand parsers and this
 * panel share one definition.
 */
const safeIdentifier = sanitizeIdentifier

/**
 * Primitive type catalogue, mirrored verbatim from the v3 fork
 * (`v3 source: uml-classifier-attribute-update.tsx`). Anything
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

// Visibility dropdown shows only the canonical UML symbols
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
 * Seed template for code-based method implementations. Ported verbatim
 * from v3 `uml-classifier-method-update.tsx:getCodeTemplate` — switching
 * a method to `code` / `bal` with no body seeds a `def` line so the
 * (locked) signature stays editable through the code editor.
 */
const getCodeTemplate = (
  implType: ClassifierMethodImplementationType,
  methodName: string
): string => {
  if (implType === "bal") {
    return `def ${methodName}() -> nothing {\n    // Add your implementation here\n}\n`
  }
  return `def ${methodName}(self):\n    """Add your docstring here."""\n    # Add your implementation here\n    pass\n`
}

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
  /** Enumeration names from sibling Enumerations. */
  enumerationNames: string[]
  /**
   * Literal values of the Enumeration matching this row's current
   * `attributeType` (empty when the type is not an enumeration). Drives
   * the enum-literal default-value dropdown (v3 StylePane parity).
   */
  enumerationLiterals: string[]
  onPatch: (patch: Partial<ClassNodeElement>) => void
  onDelete: () => void
  /** Reorder gutter callbacks; undefined hides the button. */
  onMoveUp?: () => void
  onMoveDown?: () => void
  /**
   * When the parent class is an Enumeration the
   * row is a literal — hide the visibility dropdown and the type
   * dropdown columns. Just the name + delete remain.
   */
  isEnumerationParent?: boolean
}

const AttributeRow: React.FC<AttributeRowProps> = ({
  row,
  classNames,
  enumerationNames,
  enumerationLiterals,
  onPatch,
  onDelete,
  onMoveUp,
  onMoveDown,
  isEnumerationParent = false,
}) => {
  const visibility = row.visibility ?? "public"
  const attributeType = row.attributeType ?? "str"
  const isCustom = !isPrimitiveType(attributeType)
  const [customTypeDraft, setCustomTypeDraft] = useState(
    isCustom ? attributeType : ""
  )
  // Local draft so Apollon shorthand ("+ price: float") can be typed
  // into the name field without the structured per-keystroke commits
  // rewriting the visible text mid-typing. Mirrors the v3 Textfield's
  // `currentValue` draft (`textfield.tsx:55`); blur falls back to the
  // canonical bare name from the store.
  const [nameDraft, setNameDraft] = useState<string | null>(null)
  // Collapse the four flag checkboxes (`isId`,
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

  // v3 StylePane reset the default value whenever the attribute type
  // changed (`style-pane.tsx:80-85` componentDidUpdate) — a stale
  // default for the previous type would render in the wrong widget.
  const commitAttributeType = (nextType: string) => {
    onPatch({
      attributeType: nextType,
      ...(nextType !== attributeType && { defaultValue: undefined }),
    })
  }

  const handleTypeSelect = (value: string) => {
    if (value === CUSTOM_TYPE_SENTINEL) {
      commitAttributeType(customTypeDraft || attributeType)
      return
    }
    commitAttributeType(normalizeType(value))
  }

  const handleCustomTypeBlur = () => {
    if (customTypeDraft.trim()) {
      commitAttributeType(normalizeType(customTypeDraft.trim()))
    }
  }

  // Metamodel rule (v3 `style-pane.tsx:264-270`): an attribute marked as
  // an identifier (primary or external) cannot also be optional. Lock
  // the conflicting checkbox on each side — bidirectional, like develop —
  // instead of silently rewriting flags behind the user's back.
  const optionalLockedByIdFlag = Boolean(row.isId || row.isExternalId)
  const idLockedByOptional = Boolean(row.isOptional)

  // Type-aware default-value widget (v3 `StylePane.renderDefaultValueInput`).
  const defaultWidget = selectDefaultValueWidget(
    attributeType,
    enumerationLiterals
  )
  const defaultValueAsString =
    row.defaultValue !== undefined && row.defaultValue !== null
      ? String(row.defaultValue)
      : ""
  const commitDefaultValue = (value: string) =>
    onPatch({ defaultValue: value === "" ? undefined : value })

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
        {/* Reorder gutter (mirrors v3
            `uml-classifier-update.tsx:64-91`). */}
        <ReorderGutter onMoveUp={onMoveUp} onMoveDown={onMoveDown} />
        {/* Hide visibility dropdown for Enumeration
            literals — they're just names, no UML access modifier.
            Visibility column width 70 → 44 (v3 width). */}
        {!isEnumerationParent && (
          <Select
            size="small"
            value={visibility}
            onChange={(e) =>
              onPatch({ visibility: e.target.value as ClassifierVisibility })
            }
            sx={{ minWidth: 44 }}
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
          placeholder={
            isEnumerationParent ? "literal name" : "+ attribute: type"
          }
          value={nameDraft ?? row.name}
          onChange={(e) => {
            const raw = e.target.value
            setNameDraft(raw)
            if (isEnumerationParent) {
              onPatch({ name: safeIdentifier(raw) })
              return
            }
            // Apollon shorthand: "+ price: float" explodes into
            // structured visibility / name / type (v3 parseNameFormat).
            // Plain identifiers patch only the (sanitized) name.
            const parsed = parseAttributeInput(raw)
            onPatch({
              name: parsed.name,
              ...(parsed.visibility && { visibility: parsed.visibility }),
              ...(parsed.attributeType !== undefined && {
                attributeType: parsed.attributeType,
              }),
            })
          }}
          onBlur={() => setNameDraft(null)}
        />
        {/* Hide type dropdown for Enumeration
            literals — they don't carry an attribute type.
            Type column width 110 → 80 (v3 width). */}
        {!isEnumerationParent && (
          <Select
            size="small"
            value={isCustom ? CUSTOM_TYPE_SENTINEL : attributeType}
            onChange={(e) => handleTypeSelect(String(e.target.value))}
            sx={{ minWidth: 80 }}
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
        {/* Per-row fill / text color swatches — develop colored every
            attribute, method AND enum-literal row (ColorButton +
            StylePane with `fillColor textColor`), so they render for
            literals too. `strokeColor` is intentionally not exposed
            per-row (develop's member StylePane omitted lineColor). */}
        <RowColorSwatch
          label="Row fill color"
          value={row.fillColor}
          fallbackCss="var(--besser-background, #fff)"
          onChange={(color) => onPatch({ fillColor: color })}
        />
        <RowColorSwatch
          label="Row text color"
          value={row.textColor}
          fallbackCss="var(--besser-primary-contrast, #000)"
          onChange={(color) => onPatch({ textColor: color })}
        />
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

      {/* Flags + default value collapse behind the
          per-row settings (gear) toggle. v3 had the same affordance —
          see `uml-classifier-attribute-update.tsx`.
          Enumeration literals carry no flags or
          default value, so the gear icon is hidden and the panel must
          not render even if `showSettings` is initially true (legacy
          fixtures may have stamped flags on enum literals). */}
      {!isEnumerationParent && showSettings && (
        <>
          <Stack direction="row" spacing={1.5} flexWrap="wrap">
            {/* Mutual-exclusion locks mirror v3 StylePane
                (`optionalLockedByIdFlag` / `idLockedByOptional`): the
                conflicting checkbox is disabled on each side so the
                user can't save invalid state. */}
            <FormControlLabel
              title={
                idLockedByOptional
                  ? "Optional attributes cannot be the identifier."
                  : undefined
              }
              control={
                <Checkbox
                  size="small"
                  checked={!!row.isId}
                  disabled={idLockedByOptional}
                  onChange={(e) => onPatch({ isId: e.target.checked })}
                />
              }
              label={<Typography variant="caption">id</Typography>}
            />
            <FormControlLabel
              title={
                idLockedByOptional
                  ? "Optional attributes cannot be the external identifier."
                  : undefined
              }
              control={
                <Checkbox
                  size="small"
                  checked={!!row.isExternalId}
                  disabled={idLockedByOptional}
                  onChange={(e) => onPatch({ isExternalId: e.target.checked })}
                />
              }
              label={<Typography variant="caption">external id</Typography>}
            />
            <FormControlLabel
              title={
                optionalLockedByIdFlag
                  ? "Identifier attributes cannot be optional."
                  : undefined
              }
              control={
                <Checkbox
                  size="small"
                  checked={!!row.isOptional}
                  disabled={optionalLockedByIdFlag}
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

          {/* Type-aware default-value widget, ported from v3
              `StylePane.renderDefaultValueInput` (`style-pane.tsx:145`):
              enumeration-literal dropdown, true/false dropdown for bool,
              numeric-sanitized input for int/float, native date /
              datetime-local / time inputs, plain text otherwise. */}
          {defaultWidget === "enum" ? (
            <Select
              size="small"
              value={defaultValueAsString}
              displayEmpty
              onChange={(e) => commitDefaultValue(String(e.target.value))}
              inputProps={{ "aria-label": "default value" }}
            >
              <MenuItem value="">(none)</MenuItem>
              {enumerationLiterals.map((literal) => (
                <MenuItem key={literal} value={literal}>
                  {literal}
                </MenuItem>
              ))}
            </Select>
          ) : defaultWidget === "boolean" ? (
            <Select
              size="small"
              value={defaultValueAsString}
              displayEmpty
              onChange={(e) => commitDefaultValue(String(e.target.value))}
              inputProps={{ "aria-label": "default value" }}
            >
              <MenuItem value="">(none)</MenuItem>
              <MenuItem value="true">true</MenuItem>
              <MenuItem value="false">false</MenuItem>
            </Select>
          ) : (
            <MuiTextField
              size="small"
              variant="outlined"
              fullWidth
              type={
                defaultWidget === "numeric" || defaultWidget === "text"
                  ? "text"
                  : defaultWidget
              }
              placeholder={
                defaultWidget === "numeric"
                  ? attributeType === "int"
                    ? "Enter integer..."
                    : "Enter number..."
                  : defaultWidget === "date"
                    ? "YYYY-MM-DD"
                    : defaultWidget === "datetime-local"
                      ? "YYYY-MM-DD HH:MM:SS"
                      : defaultWidget === "time"
                        ? "HH:MM:SS"
                        : "default value (optional)"
              }
              value={defaultValueAsString}
              onChange={(e) =>
                commitDefaultValue(
                  defaultWidget === "numeric"
                    ? sanitizeNumericDefault(e.target.value)
                    : e.target.value
                )
              }
              inputProps={{ "aria-label": "default value" }}
            />
          )}
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
  /** Enumeration names from sibling Enumerations (return-type picker). */
  enumerationNames: string[]
  stateMachines: { id: string; name: string }[]
  quantumCircuits: { id: string; name: string }[]
  onPatch: (patch: Partial<ClassNodeElement>) => void
  onDelete: () => void
  /** Reorder gutter callbacks; undefined hides the button. */
  onMoveUp?: () => void
  onMoveDown?: () => void
}

const MethodRow: React.FC<MethodRowProps> = ({
  row,
  classNames,
  enumerationNames,
  stateMachines,
  quantumCircuits,
  onPatch,
  onDelete,
  onMoveUp,
  onMoveDown,
}) => {
  const visibility = row.visibility ?? "public"
  const implementationType: ClassifierMethodImplementationType =
    row.implementationType ?? "none"
  const parameters = row.parameters ?? []
  // Return type rides on `returnType`, mirrored onto `attributeType`
  // (legacy display + v3 export both read the latter). v3 exposed it as
  // the `: returnType` suffix of the signature field — restored here as
  // a dedicated dropdown (full method-signature authoring parity).
  const returnType = row.returnType ?? row.attributeType ?? "any"
  const isCustomReturn = !isPrimitiveType(returnType)
  const [customReturnDraft, setCustomReturnDraft] = useState(
    isCustomReturn ? returnType : ""
  )
  // Local draft so Apollon shorthand ("name(p: type): ret") can be typed
  // into the name field — see the matching draft on `AttributeRow`.
  const [nameDraft, setNameDraft] = useState<string | null>(null)
  // Collapse parameters + implementation type + code editor behind a
  // per-row settings toggle so the inline row stays compact.
  const [showSettings, setShowSettings] = useState(
    parameters.length > 0 ||
      implementationType !== "none" ||
      !!row.code ||
      !!row.stateMachineId ||
      !!row.quantumCircuitId
  )

  // v3 locked the whole signature when the method is implemented in
  // code / BAL — the `def` line is the source of truth
  // (`uml-classifier-method-update.tsx` `isSignatureLocked`).
  const signatureLocked =
    implementationType === "code" || implementationType === "bal"
  const signatureLockTitle =
    implementationType === "bal"
      ? "Method defined in BESSER Action Language code"
      : "Method defined in Python code"

  const patchParameters = (next: ClassifierMethodParameter[]) => {
    onPatch({ parameters: next })
  }

  const commitReturnType = (nextType: string) =>
    onPatch({ returnType: nextType, attributeType: nextType })

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
        {/* Reorder gutter. */}
        <ReorderGutter onMoveUp={onMoveUp} onMoveDown={onMoveDown} />
        <Select
          size="small"
          value={visibility}
          disabled={signatureLocked}
          onChange={(e) =>
            onPatch({ visibility: e.target.value as ClassifierVisibility })
          }
          sx={{ minWidth: 44 }}
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
          placeholder="method(param: type): returnType"
          value={nameDraft ?? row.name}
          // When the method is implemented in code/BAL the signature is
          // extracted from the `def` line and the field is read-only
          // (v3 `isSignatureLocked`).
          InputProps={{ readOnly: signatureLocked }}
          title={signatureLocked ? signatureLockTitle : undefined}
          onChange={(e) => {
            const raw = e.target.value
            setNameDraft(raw)
            // Apollon shorthand: "name(p: type): ret" explodes into
            // structured name / parameters / returnType (v3
            // parseNameFormat behavior, persisted structurally). Plain
            // identifiers patch only the (sanitized) name.
            const parsed = parseMethodInput(raw)
            const patch: Partial<ClassNodeElement> = { name: parsed.name }
            if (parsed.visibility) patch.visibility = parsed.visibility
            if (parsed.parameters) {
              patch.parameters = mergeParameterIds(
                parameters,
                parsed.parameters
              )
            }
            if (parsed.returnType !== undefined) {
              patch.returnType = parsed.returnType
              patch.attributeType = parsed.returnType
            }
            onPatch(patch)
          }}
          onBlur={() => setNameDraft(null)}
        />
        {/* Return-type dropdown — restored v3 parity (the v3 signature
            field carried `: returnType`; here it's the structured
            `returnType`, mirrored onto `attributeType`). */}
        <Select
          size="small"
          value={isCustomReturn ? CUSTOM_TYPE_SENTINEL : returnType}
          disabled={signatureLocked}
          onChange={(e) => {
            const value = String(e.target.value)
            if (value === CUSTOM_TYPE_SENTINEL) {
              commitReturnType(customReturnDraft || returnType)
              return
            }
            commitReturnType(normalizeType(value))
          }}
          sx={{ minWidth: 80 }}
          inputProps={{ "aria-label": "return type" }}
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
        {/* Per-row fill / text color swatches — mirrors the
            AttributeRow pair (develop's per-method ColorButton +
            StylePane with `fillColor textColor`). */}
        <RowColorSwatch
          label="Row fill color"
          value={row.fillColor}
          fallbackCss="var(--besser-background, #fff)"
          onChange={(color) => onPatch({ fillColor: color })}
        />
        <RowColorSwatch
          label="Row text color"
          value={row.textColor}
          fallbackCss="var(--besser-primary-contrast, #000)"
          onChange={(color) => onPatch({ textColor: color })}
        />
        <Tooltip title="Delete method">
          <IconButton size="small" onClick={onDelete}>
            <DeleteIcon width={14} height={14} />
          </IconButton>
        </Tooltip>
      </Stack>

      {isCustomReturn && !signatureLocked && (
        <MuiTextField
          size="small"
          variant="outlined"
          fullWidth
          placeholder="custom return type (free-text)"
          value={customReturnDraft || returnType}
          onChange={(e) => setCustomReturnDraft(e.target.value)}
          onBlur={() => {
            if (customReturnDraft.trim()) {
              commitReturnType(normalizeType(customReturnDraft.trim()))
            }
          }}
        />
      )}

      {/* Parameters + implementation type + code editor are
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
              InputProps={{ readOnly: signatureLocked }}
              title={signatureLocked ? signatureLockTitle : undefined}
              onChange={(e) => {
                const next = [...parameters]
                next[idx] = { ...p, name: safeIdentifier(e.target.value) }
                patchParameters(next)
              }}
              sx={{ flex: 1 }}
            />
            <MuiTextField
              size="small"
              variant="outlined"
              placeholder="type"
              value={p.parameterType ?? ""}
              InputProps={{ readOnly: signatureLocked }}
              title={signatureLocked ? signatureLockTitle : undefined}
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
              disabled={signatureLocked}
              onClick={() =>
                patchParameters(parameters.filter((_, i) => i !== idx))
              }
            >
              <DeleteIcon width={14} height={14} />
            </IconButton>
          </Stack>
        ))}
        {!signatureLocked && (
          <MuiTextField
            size="small"
            variant="outlined"
            placeholder="+ add parameter (name: type, Enter)"
            fullWidth
            sx={{ marginTop: 0.5 }}
            onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
              if (e.key === "Enter") {
                const target = e.target as HTMLInputElement
                const v = target.value.trim()
                if (!v) return
                // "name: type" shorthand parses into structured fields
                // (previously the raw string — colon included — was
                // stored as the parameter name).
                const parsed = parseAttributeInput(v)
                if (!parsed.name) return
                patchParameters([
                  ...parameters,
                  {
                    id: generateUUID(),
                    name: parsed.name,
                    ...(parsed.attributeType !== undefined && {
                      parameterType: parsed.attributeType,
                    }),
                  },
                ])
                target.value = ""
              }
            }}
          />
        )}
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
              // v3 seeded a def-line template when switching to a
              // code-based implementation with no body yet
              // (`getCodeTemplate`) — without it the locked signature
              // could never change.
              if (!row.code) {
                patch.code = getCodeTemplate(next, row.name || "new_method")
              }
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
              height: "100%",
              minHeight: 150,
            },
          }}
        >
          {/* Editor header — `{BAL|Python} Implementation` caption +
              "Clear Code" action, visible only while there is code to
              clear. Port of develop's `CodeEditorHeader` / `clearCode`
              (`uml-classifier-method-update.tsx:217-221, 459-473`).
              Develop's extra `setCodeEditorOpen(false)` maps to the
              per-row gear toggle here, which deliberately stays open. */}
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{
              px: 1,
              py: 0.25,
              borderBottom: "1px solid var(--besser-gray, #e9ecef)",
            }}
          >
            <Typography variant="caption" sx={{ fontWeight: 600 }}>
              {implementationType === "bal"
                ? "BESSER Action Language"
                : "Python"}{" "}
              Implementation
            </Typography>
            {(row.code ?? "").trim().length > 0 && (
              <Button
                size="small"
                variant="text"
                onClick={() => onPatch({ code: "" })}
                sx={{
                  minWidth: 0,
                  padding: "0 6px",
                  textTransform: "none",
                }}
              >
                Clear Code
              </Button>
            )}
          </Stack>
          {/* Drag-resizable wrapper — develop's
              `ResizableCodeMirrorWrapper` (`resize: both; overflow:
              auto; min/max-height 150/400`); `height="100%"` below is
              the CM6 equivalent of `.CodeMirror { height: 100% }`. */}
          <div
            data-testid="code-editor-resizable"
            style={{
              resize: "both",
              overflow: "auto",
              minHeight: 150,
              maxHeight: 400,
              boxSizing: "border-box",
            }}
          >
          {/*
           * CodeMirror port — replaces the plain MUI multiline
           * TextField for `code` / `bal` implementation types so the v3
           * Python-syntax-highlighting + tab-indent UX is preserved.
           * Source-of-truth: `uml-classifier-update.tsx` code editor.
           * BAL is treated as Python-flavored for syntax highlighting
           * (the v3 fork does the same — both share the same lexical
           * grammar; BAL is a domain-specific subset).
           */}
          <CodeMirror
            value={row.code ?? ""}
            height="100%"
            extensions={[python()]}
            onChange={(value) => {
              // v3 kept the (locked) signature in sync with the
              // `def name(params) -> ret:` line — port of
              // `uml-classifier-method-update.tsx:handleCodeChange`,
              // persisting the extracted signature structurally
              // (name / parameters[] / returnType) instead of fusing
              // it into the display name.
              const signature = extractMethodSignatureFromCode(value)
              if (signature) {
                onPatch({
                  code: value,
                  name: signature.name,
                  parameters: mergeParameterIds(
                    parameters,
                    signature.parameters
                  ),
                  returnType: signature.returnType ?? "any",
                  attributeType: signature.returnType ?? "any",
                })
              } else {
                onPatch({ code: value })
              }
            }}
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
          </div>
        </Box>
      )}
        </>
      )}
    </Box>
  )
}

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

  // Enumeration list for the attribute-type picker (P12).
  const enumerationNames = useMemo(() => collectEnumerationNames(), [nodes])

  // Enumeration name → literal values, sourced from the *live* nodes of
  // this diagram. Drives the enum-literal default-value dropdown — v3's
  // `renderDefaultValueInput` resolved `enumerationLiterals` from the
  // same diagram's Enumeration elements (`uml-classifier-attribute-update.tsx:386-402`).
  const enumerationLiteralsByName = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const n of nodes) {
      const data = n.data as Partial<ClassNodeProps> & { name?: string }
      const isEnum =
        (n.type === "class" && data?.stereotype === "Enumeration") ||
        n.type === "Enumeration"
      if (!isEnum) continue
      const name = data?.name
      if (typeof name !== "string" || name.length === 0) continue
      m.set(
        name,
        (data?.attributes ?? [])
          .map((a) => a?.name ?? "")
          .filter((s) => s.length > 0)
      )
    }
    return m
  }, [nodes])

  const stateMachineDiagrams = diagramBridge.getStateMachineDiagrams()
  const quantumCircuitDiagrams = diagramBridge.getQuantumCircuitDiagrams()

  if (!node) return null
  const nodeData = node.data as ClassNodeProps

  /* ----- Top-level node update helpers ----------------------------------- */

  const handleDataFieldUpdate = (key: string, value: string) => {
    // Class `name` field must be sanitised on commit, mirroring
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

  // When no name is provided, generate
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

  /**
   * Swap two attribute rows in place. Mirrors v3's
   * `ReorderControls` action at `uml-classifier-update.tsx:64-91`.
   */
  const moveAttribute = (attrId: string, direction: "up" | "down") => {
    updateNode((d) => {
      const idx = d.attributes.findIndex((a) => a.id === attrId)
      if (idx < 0) return d
      const swap = direction === "up" ? idx - 1 : idx + 1
      if (swap < 0 || swap >= d.attributes.length) return d
      const next = [...d.attributes]
      const tmp = next[idx]
      next[idx] = next[swap]
      next[swap] = tmp
      return { ...d, attributes: next }
    })
  }

  const addAttribute = (rawName: string) => {
    // Apollon shorthand: "+ price: float" parses into structured
    // visibility / name / type (v3 `create()` ran parseNameFormat on the
    // add-input — `uml-classifier-update.tsx:448-453`). Plain
    // identifiers keep working unchanged; the sanitiser only applies to
    // what remains of the name AFTER parsing.
    const parsed = parseAttributeInput(rawName)
    const data = (nodes.find((n) => n.id === elementId)?.data ??
      {}) as ClassNodeProps
    const attrName =
      parsed.name || nextAutoName(data.attributes ?? [], "attribute")
    const newAttr: ClassNodeElement = {
      id: generateUUID(),
      name: attrName,
      attributeType: parsed.attributeType ?? "str",
      visibility: parsed.visibility ?? "public",
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

  /**
   * Swap two method rows in place. Mirrors v3's
   * `ReorderControls` action at `uml-classifier-update.tsx:254-274`.
   */
  const moveMethod = (methodId: string, direction: "up" | "down") => {
    updateNode((d) => {
      const idx = d.methods.findIndex((m) => m.id === methodId)
      if (idx < 0) return d
      const swap = direction === "up" ? idx - 1 : idx + 1
      if (swap < 0 || swap >= d.methods.length) return d
      const next = [...d.methods]
      const tmp = next[idx]
      next[idx] = next[swap]
      next[swap] = tmp
      return { ...d, methods: next }
    })
  }

  const addMethod = (rawName: string) => {
    // Apollon shorthand: "+ name(p: type): ret" parses into structured
    // name / visibility / parameters[] / returnType (persisted
    // structurally on node data — never string-fused into the name).
    // Plain identifiers keep working unchanged, falling back to
    // `method1`, `method2`, … when the input is empty.
    const parsed = parseMethodInput(rawName)
    const data = (nodes.find((n) => n.id === elementId)?.data ??
      {}) as ClassNodeProps
    const methodName =
      parsed.name || nextAutoName(data.methods ?? [], "method")
    const newMethod: ClassNodeElement = {
      id: generateUUID(),
      name: methodName,
      visibility: parsed.visibility ?? "public",
      attributeType: parsed.returnType ?? "any",
      returnType: parsed.returnType ?? "any",
      parameters: (parsed.parameters ?? []).map((p) => ({
        id: generateUUID(),
        name: p.name,
        ...(p.parameterType !== undefined && {
          parameterType: p.parameterType,
        }),
      })),
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

      {/* Metadata fields (description /
          uri / icon) — mirror v3 `uml-classifier-update.tsx` `StylePane`.
          Stored on `data.description`, `data.uri`, `data.icon`;
          round-tripped by `convertV4ToV3Class`. Collapsed behind an
          Accordion when all three are empty so the panel doesn't burn
          ~120 px of vertical space on fields most authors leave blank. */}
      <Accordion
        defaultExpanded={
          !!nodeData.description || !!nodeData.uri || !!nodeData.icon
        }
        disableGutters
        elevation={0}
        sx={{
          background: "transparent",
          "&:before": { display: "none" },
          border: "1px solid var(--besser-gray, #e9ecef)",
          borderRadius: 1,
        }}
      >
        <AccordionSummary
          sx={{
            minHeight: 32,
            "& .MuiAccordionSummary-content": { margin: "4px 0" },
          }}
        >
          <InspectorSectionHeader>Metadata</InspectorSectionHeader>
        </AccordionSummary>
        <AccordionDetails
          sx={{ display: "flex", flexDirection: "column", gap: 1, pt: 0 }}
        >
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
            onChange={(e) =>
              updateNode((d) => ({ ...d, icon: e.target.value }))
            }
          />
        </AccordionDetails>
      </Accordion>
      <DividerLine width="100%" />

      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <InspectorSectionHeader>Attributes</InspectorSectionHeader>
        {/* Single `+ add attribute` text-link
            replaces the previous IconButton-with-glyph + duplicate
            inline `+ Add attribute (Enter)` textfield combo. The
            inline textfield is kept below for keyboard add. */}
        <AddRowButton
          label="add attribute"
          onClick={() => addAttribute("")}
        />
      </Stack>
      {nodeData.attributes.map((row, idx) => (
        <AttributeRow
          key={row.id}
          row={row}
          classNames={availableClassNames}
          enumerationNames={enumerationNames}
          enumerationLiterals={
            enumerationLiteralsByName.get(row.attributeType ?? "") ?? []
          }
          onPatch={(patch) => patchAttribute(row.id, patch)}
          onDelete={() => deleteAttribute(row.id)}
          onMoveUp={
            idx > 0 ? () => moveAttribute(row.id, "up") : undefined
          }
          onMoveDown={
            idx < nodeData.attributes.length - 1
              ? () => moveAttribute(row.id, "down")
              : undefined
          }
          /* Hide visibility + type columns for
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

      {/* V3 hid the Methods section for Enumeration stereotype
          (see `uml-classifier-update.tsx:344`). v4 mirrors that hide rule. */}
      {nodeData.stereotype !== "Enumeration" && (
        <>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
          >
            <InspectorSectionHeader>Methods</InspectorSectionHeader>
            {/* Unified `+ add method` text-link. */}
            <AddRowButton
              label="add method"
              onClick={() => addMethod("")}
            />
          </Stack>
          {nodeData.methods.map((row, idx) => (
            <MethodRow
              key={row.id}
              row={row}
              classNames={availableClassNames}
              enumerationNames={enumerationNames}
              stateMachines={stateMachineDiagrams}
              quantumCircuits={quantumCircuitDiagrams}
              onPatch={(patch) => patchMethod(row.id, patch)}
              onDelete={() => deleteMethod(row.id)}
              onMoveUp={
                idx > 0 ? () => moveMethod(row.id, "up") : undefined
              }
              onMoveDown={
                idx < nodeData.methods.length - 1
                  ? () => moveMethod(row.id, "down")
                  : undefined
              }
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
