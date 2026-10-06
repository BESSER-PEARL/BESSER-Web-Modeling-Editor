import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Checkbox,
  FormControlLabel,
  InputBase,
  MenuItem,
  Select,
  Stack,
  TextField as MuiTextField,
  Tooltip,
} from "@mui/material"
import React, {
  useMemo,
  useRef,
  useState,
  ChangeEvent,
  KeyboardEvent,
} from "react"
import { useShallow } from "zustand/shallow"
import CodeMirror from "@uiw/react-codemirror"
import { python } from "@codemirror/lang-python"
import { useDiagramStore } from "@/store/context"
import { useTranslation } from "@/i18n"
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
import {
  InspectorSectionHeader,
  AddRowButton,
  RowColorSwatch,
  RowActionButton,
  ChevronDownIcon,
  ChevronUpIcon,
  CodeIcon,
  SlidersIcon,
  TrashIcon,
} from "../_shared"

/**
 * Left-gutter reorder controls for the attribute / method rows. Mirrors v3
 * `uml-classifier-update.tsx:64-91, 254-274`. Revealed on row hover /
 * focus-within; the up button is disabled (and hidden) on the first row,
 * the down button on the last, so both keep their slot and rows align.
 */
interface ReorderGutterProps {
  onMoveUp?: () => void
  onMoveDown?: () => void
}

const ReorderGutter: React.FC<ReorderGutterProps> = ({
  onMoveUp,
  onMoveDown,
}) => {
  const { t } = useTranslation()
  return (
    <div className="bp-reorder">
      <button
        type="button"
        disabled={!onMoveUp}
        onClick={onMoveUp}
        aria-label={t("popup.classifier.moveUp", "Move up")}
        title={t("popup.classifier.moveUp", "Move up")}
      >
        <ChevronUpIcon size={12} />
      </button>
      <button
        type="button"
        disabled={!onMoveDown}
        onClick={onMoveDown}
        aria-label={t("popup.classifier.moveDown", "Move down")}
        title={t("popup.classifier.moveDown", "Move down")}
      >
        <ChevronDownIcon size={12} />
      </button>
    </div>
  )
}

/** No chevron on the visibility picker: the symbol itself is the trigger. */
const NoIcon: React.FC = () => null

/** Field-sized menu that opens under its trigger, aligned to its start. */
const FIELD_MENU_PROPS = {
  anchorOrigin: { vertical: "bottom", horizontal: "left" },
  transformOrigin: { vertical: "top", horizontal: "left" },
  slotProps: { paper: { sx: { marginTop: "4px", minWidth: 160 } } },
} as const

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

/** Visibility menu items: the UML symbol plus the keyword, for scanning. */
const visibilityMenuItems = () =>
  VISIBILITIES.map((v) => (
    <MenuItem key={v.value} value={v.value}>
      <span
        style={{
          display: "inline-block",
          width: 16,
          fontFamily: "var(--bp-mono, monospace)",
        }}
      >
        {v.label}
      </span>
      <span style={{ color: "var(--bp-muted, inherit)" }}>{v.value}</span>
    </MenuItem>
  ))

/** Type-picker menu: primitives, then sibling classes and enumerations. */
const typeMenuItems = (
  t: (key: string, fallback: string) => string,
  classNames: string[],
  enumerationNames: string[]
) => [
  ...PRIMITIVE_TYPES.map((p) => (
    <MenuItem key={p.value} value={p.value}>
      {p.label}
    </MenuItem>
  )),
  ...(classNames.length > 0
    ? [
        <MenuItem key="__divider__" disabled>
          {t("popup.class.classesDivider", "── classes ──")}
        </MenuItem>,
        ...classNames.map((cn) => (
          <MenuItem key={`class-${cn}`} value={cn}>
            {cn}
          </MenuItem>
        )),
      ]
    : []),
  ...(enumerationNames.length > 0
    ? [
        <MenuItem key="__edivider__" disabled>
          {t("popup.class.enumerationsDivider", "── enumerations ──")}
        </MenuItem>,
        ...enumerationNames.map((en) => (
          <MenuItem key={`enum-${en}`} value={en}>
            {en}
          </MenuItem>
        )),
      ]
    : []),
  <MenuItem key={CUSTOM_TYPE_SENTINEL} value={CUSTOM_TYPE_SENTINEL}>
    {t("popup.class.customType", "custom…")}
  </MenuItem>,
]

const IMPLEMENTATION_TYPES: {
  value: ClassifierMethodImplementationType
  label: string
  /** i18n key; `undefined` for product names that stay untranslated. */
  labelKey?: string
}[] = [
  { value: "none", label: "None (UML)", labelKey: "popup.method.implNone" },
  { value: "code", label: "Python Code", labelKey: "popup.method.implCode" },
  { value: "bal", label: "BESSER Action Language" },
  {
    value: "state_machine",
    label: "State Machine",
    labelKey: "popup.method.implStateMachine",
  },
  {
    value: "quantum_circuit",
    label: "Quantum Circuit",
    labelKey: "popup.method.implQuantumCircuit",
  },
  {
    value: "neural_network",
    label: "Neural Network",
    labelKey: "popup.method.implNeuralNetwork",
  },
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

/** develop `onSubmitKeyUp`: Enter in a row's name field moves to the next row. */
const submitOnEnter =
  (onSubmit?: () => void) => (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === "Enter" && onSubmit) {
      e.preventDefault()
      onSubmit()
    }
  }

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
  /** Ref to the name input (keyboard row navigation). */
  nameInputRef?: React.Ref<HTMLInputElement>
  /** Enter in the name field — focus the next row (develop `onSubmitKeyUp`). */
  onSubmitKeyUp?: () => void
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
  nameInputRef,
  onSubmitKeyUp,
}) => {
  const { t } = useTranslation()
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
      (row.defaultValue !== undefined && row.defaultValue !== "") ||
      !!row.fillColor ||
      !!row.textColor
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
    <div className={`bp-member${showSettings ? " is-open" : ""}`}>
      <div className="bp-member__row">
        {/* Reorder gutter (mirrors v3 `uml-classifier-update.tsx:64-91`). */}
        <ReorderGutter onMoveUp={onMoveUp} onMoveDown={onMoveDown} />
        {/* One bordered field that reads like the UML line: `+ name : type`.
            Enumeration literals are just names — no visibility, no type. */}
        <div className="bp-field">
          {!isEnumerationParent && (
            <Select
              value={visibility}
              onChange={(e) =>
                onPatch({ visibility: e.target.value as ClassifierVisibility })
              }
              input={<InputBase className="bp-field__vis" />}
              IconComponent={NoIcon}
              renderValue={(v) => VISIBILITY_SYMBOLS[v as ClassifierVisibility]}
              MenuProps={FIELD_MENU_PROPS}
              inputProps={{
                "aria-label": t("popup.attribute.visibility", "Visibility"),
              }}
            >
              {visibilityMenuItems()}
            </Select>
          )}
          <InputBase
            className="bp-field__name"
            placeholder={
              isEnumerationParent
                ? t("popup.attribute.literalNamePlaceholder", "literal name")
                : t("popup.attribute.shorthandPlaceholder", "+ attribute: type")
            }
            value={nameDraft ?? row.name}
            inputRef={nameInputRef}
            inputProps={{
              "aria-label": isEnumerationParent
                ? t("popup.attribute.literalName", "Literal name")
                : t("popup.attribute.name", "Attribute name"),
              autoComplete: "off",
              spellCheck: false,
            }}
            onKeyDown={submitOnEnter(onSubmitKeyUp)}
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
          {!isEnumerationParent && (
            <span className="bp-field__typebox">
              <span className="bp-field__sep" aria-hidden="true">
                :
              </span>
              {/* A custom (non-primitive) type is typed inline; the chevron
                  next to it still opens the full type menu. */}
              {isCustom && (
                <InputBase
                  className="bp-field__type-input"
                  placeholder={t(
                    "popup.attribute.customTypePlaceholder",
                    "custom type (free-text)"
                  )}
                  value={customTypeDraft || attributeType}
                  onChange={(e) => setCustomTypeDraft(e.target.value)}
                  onBlur={handleCustomTypeBlur}
                  inputProps={{
                    "aria-label": t("popup.attribute.customType", "Custom type"),
                    autoComplete: "off",
                    spellCheck: false,
                  }}
                />
              )}
              <Select
                value={isCustom ? CUSTOM_TYPE_SENTINEL : attributeType}
                onChange={(e) => handleTypeSelect(String(e.target.value))}
                input={
                  <InputBase
                    className={`bp-field__type${isCustom ? " bp-field__type--chevron" : ""}`}
                  />
                }
                // The trigger shows the bare type (`str`); the menu keeps
                // the descriptive labels (`str (string)`).
                renderValue={(v) => (isCustom ? "" : String(v))}
                MenuProps={FIELD_MENU_PROPS}
                inputProps={{
                  "aria-label": t("popup.attribute.type", "Attribute type"),
                }}
              >
                {typeMenuItems(t, classNames, enumerationNames)}
              </Select>
            </span>
          )}
        </div>
        <div className="bp-member__actions">
          {/* Per-row options (flags + default + colors). Shown for enum
              literals too — they still expose colors. */}
          <RowActionButton
            label={
              showSettings
                ? t("popup.attribute.hideOptions", "Hide options")
                : isEnumerationParent
                  ? t("popup.attribute.showColors", "Show colors")
                  : t("popup.attribute.showOptions", "Show flags, default & colors")
            }
            ariaLabel={t("popup.attribute.rowOptions", "Attribute row options")}
            expanded={showSettings}
            onClick={() => setShowSettings((s) => !s)}
          >
            <SlidersIcon size={14} />
          </RowActionButton>
          <RowActionButton
            danger
            label={
              isEnumerationParent
                ? t("popup.attribute.deleteLiteral", "Delete literal")
                : t("popup.attribute.deleteAttribute", "Delete attribute")
            }
            onClick={onDelete}
          >
            <TrashIcon size={14} />
          </RowActionButton>
        </div>
      </div>

      {/* Enumeration literals carry no flags or default value — the
          details only offer colors for them, even if legacy fixtures
          stamped flags on a literal. */}
      {showSettings && (
        <div className="bp-member__details">
          {!isEnumerationParent && (
          <>
          <div className="bp-flags">
            {/* Mutual-exclusion locks mirror v3 StylePane
                (`optionalLockedByIdFlag` / `idLockedByOptional`): the
                conflicting checkbox is disabled on each side so the
                user can't save invalid state. */}
            <FormControlLabel
              title={
                idLockedByOptional
                  ? t(
                      "stylePane.idLockedByOptional",
                      "Optional attributes cannot be the identifier."
                    )
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
              label={t("stylePane.id", "ID")}
            />
            <FormControlLabel
              title={
                idLockedByOptional
                  ? t(
                      "stylePane.externalIdLockedByOptional",
                      "Optional attributes cannot be the external identifier."
                    )
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
              label={t("stylePane.externalId", "External ID")}
            />
            <FormControlLabel
              title={
                optionalLockedByIdFlag
                  ? t(
                      "stylePane.optionalLockedById",
                      "Identifier attributes cannot be optional."
                    )
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
              label={t("stylePane.optional", "Optional")}
            />
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={!!row.isDerived}
                  onChange={(e) => onPatch({ isDerived: e.target.checked })}
                />
              }
              label={t("stylePane.derived", "Derived")}
            />
          </div>

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
              inputProps={{
                "aria-label": t("popup.attribute.defaultValue", "Default value"),
              }}
            >
              <MenuItem value="">{t("stylePane.none", "(none)")}</MenuItem>
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
              inputProps={{
                "aria-label": t("popup.attribute.defaultValue", "Default value"),
              }}
            >
              <MenuItem value="">{t("stylePane.none", "(none)")}</MenuItem>
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
                    ? t("stylePane.enterInteger", "Enter integer...")
                    : t("stylePane.enterNumber", "Enter number...")
                  : defaultWidget === "date"
                    ? "YYYY-MM-DD"
                    : defaultWidget === "datetime-local"
                      ? "YYYY-MM-DD HH:MM:SS"
                      : defaultWidget === "time"
                        ? "HH:MM:SS"
                        : t(
                            "popup.attribute.defaultValueOptionalPlaceholder",
                            "default value (optional)"
                          )
              }
              value={defaultValueAsString}
              onChange={(e) =>
                commitDefaultValue(
                  defaultWidget === "numeric"
                    ? sanitizeNumericDefault(e.target.value)
                    : e.target.value
                )
              }
              inputProps={{
                "aria-label": t("popup.attribute.defaultValue", "Default value"),
                autoComplete: "off",
              }}
            />
          )}
          </>
          )}
          {/* Per-row fill / text colors (develop colored every attribute,
              method AND enum-literal row). `strokeColor` is intentionally
              not exposed per-row. */}
          <div className="bp-detail-row">
            <span className="bp-detail-label" style={{ minWidth: 44 }}>
              {t("popup.class.colors", "Colors")}
            </span>
            <RowColorSwatch
              label={t("stylePane.rowFillColor", "Row fill color")}
              value={row.fillColor}
              fallbackCss="var(--besser-background, #fff)"
              onChange={(color) => onPatch({ fillColor: color })}
            />
            <RowColorSwatch
              label={t("stylePane.rowTextColor", "Row text color")}
              value={row.textColor}
              fallbackCss="var(--besser-primary-contrast, #000)"
              onChange={(color) => onPatch({ textColor: color })}
            />
          </div>
        </div>
      )}
    </div>
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
  /** NNDiagram references for `implementationType: 'neural_network'`. */
  neuralNetworks: { id: string; name: string }[]
  onPatch: (patch: Partial<ClassNodeElement>) => void
  onDelete: () => void
  /** Reorder gutter callbacks; undefined hides the button. */
  onMoveUp?: () => void
  onMoveDown?: () => void
  /** Ref to the name input (keyboard row navigation). */
  nameInputRef?: React.Ref<HTMLInputElement>
  /** Enter in the name field — focus the next row (develop `onSubmitKeyUp`). */
  onSubmitKeyUp?: () => void
}

const MethodRow: React.FC<MethodRowProps> = ({
  row,
  classNames,
  enumerationNames,
  stateMachines,
  quantumCircuits,
  neuralNetworks,
  onPatch,
  onDelete,
  onMoveUp,
  onMoveDown,
  nameInputRef,
  onSubmitKeyUp,
}) => {
  const { t } = useTranslation()
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
      !!row.quantumCircuitId ||
      !!row.neuralNetworkId ||
      !!row.fillColor ||
      !!row.textColor
  )

  // v3 locked the whole signature when the method is implemented in
  // code / BAL — the `def` line is the source of truth
  // (`uml-classifier-method-update.tsx` `isSignatureLocked`).
  const signatureLocked =
    implementationType === "code" || implementationType === "bal"
  const signatureLockTitle =
    implementationType === "bal"
      ? t(
          "popup.method.definedInBal",
          "Method defined in BESSER Action Language code"
        )
      : t("popup.method.definedInPython", "Method defined in Python code")

  const patchParameters = (next: ClassifierMethodParameter[]) => {
    onPatch({ parameters: next })
  }

  const commitReturnType = (nextType: string) =>
    onPatch({ returnType: nextType, attributeType: nextType })

  return (
    <div className={`bp-member${showSettings ? " is-open" : ""}`}>
      <div className="bp-member__row">
        <ReorderGutter onMoveUp={onMoveUp} onMoveDown={onMoveDown} />
        <div className="bp-field">
          <Select
            value={visibility}
            disabled={signatureLocked}
            onChange={(e) =>
              onPatch({ visibility: e.target.value as ClassifierVisibility })
            }
            input={<InputBase className="bp-field__vis" />}
            IconComponent={NoIcon}
            renderValue={(v) => VISIBILITY_SYMBOLS[v as ClassifierVisibility]}
            MenuProps={FIELD_MENU_PROPS}
            inputProps={{
              "aria-label": t("popup.attribute.visibility", "Visibility"),
            }}
          >
            {visibilityMenuItems()}
          </Select>
          <InputBase
            className="bp-field__name"
            placeholder={t(
              "popup.method.signaturePlaceholder",
              "method(param: type): returnType"
            )}
            value={nameDraft ?? row.name}
            inputRef={nameInputRef}
            onKeyDown={submitOnEnter(onSubmitKeyUp)}
            // When the method is implemented in code/BAL the signature is
            // extracted from the `def` line and the field is read-only
            // (v3 `isSignatureLocked`).
            readOnly={signatureLocked}
            title={signatureLocked ? signatureLockTitle : undefined}
            inputProps={{
              "aria-label": t("popup.method.name", "Method name"),
              autoComplete: "off",
              spellCheck: false,
            }}
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
          <span className="bp-field__typebox">
          <span className="bp-field__sep" aria-hidden="true">
            :
          </span>
          {/* Return type — the structured `returnType`, mirrored onto
              `attributeType` (v3 carried it as the `: returnType` suffix). */}
          {isCustomReturn && (
            <InputBase
              className="bp-field__type-input"
              placeholder={t(
                "popup.method.customReturnTypePlaceholder",
                "custom return type (free-text)"
              )}
              value={customReturnDraft || returnType}
              readOnly={signatureLocked}
              onChange={(e) => setCustomReturnDraft(e.target.value)}
              onBlur={() => {
                if (!signatureLocked && customReturnDraft.trim()) {
                  commitReturnType(normalizeType(customReturnDraft.trim()))
                }
              }}
              inputProps={{
                "aria-label": t("popup.method.customReturnType", "Custom return type"),
                autoComplete: "off",
                spellCheck: false,
              }}
            />
          )}
          <Select
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
            input={
              <InputBase
                className={`bp-field__type${isCustomReturn ? " bp-field__type--chevron" : ""}`}
              />
            }
            renderValue={(v) => (isCustomReturn ? "" : String(v))}
            MenuProps={FIELD_MENU_PROPS}
            inputProps={{
              "aria-label": t("popup.method.returnType", "Return type"),
            }}
          >
            {typeMenuItems(t, classNames, enumerationNames)}
          </Select>
          </span>
        </div>
        <div className="bp-member__actions">
          <RowActionButton
            label={
              showSettings
                ? t("popup.method.hideOptions", "Hide parameters, code & colors")
                : t("popup.method.showOptions", "Parameters, code & colors")
            }
            ariaLabel={t("popup.method.rowOptions", "Method row options")}
            expanded={showSettings}
            onClick={() => setShowSettings((s) => !s)}
          >
            <SlidersIcon size={14} />
          </RowActionButton>
          <RowActionButton
            danger
            label={t("popup.method.deleteMethod", "Delete method")}
            onClick={onDelete}
          >
            <TrashIcon size={14} />
          </RowActionButton>
        </div>
      </div>

      {/* Parameters + implementation type + code editor are collapsed
          behind the per-row options toggle so the row stays compact when
          the user is just naming methods. */}
      {showSettings && (
        <div className="bp-member__details">
      {/* Parameter rows */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <span className="bp-detail-label">
          {t("popup.parameters", "Parameters")}
        </span>
        {parameters.map((p, idx) => (
          <div key={p.id} className="bp-member__row">
            <div className={`bp-field${signatureLocked ? " is-disabled" : ""}`}>
              <InputBase
                className="bp-field__name"
                placeholder={t("popup.method.paramNamePlaceholder", "name")}
                value={p.name}
                readOnly={signatureLocked}
                title={signatureLocked ? signatureLockTitle : undefined}
                inputProps={{
                  "aria-label": t("popup.method.paramName", "Parameter name"),
                  autoComplete: "off",
                  spellCheck: false,
                }}
                onChange={(e) => {
                  const next = [...parameters]
                  next[idx] = { ...p, name: safeIdentifier(e.target.value) }
                  patchParameters(next)
                }}
              />
              <span className="bp-field__typebox">
              <span className="bp-field__sep" aria-hidden="true">
                :
              </span>
              <InputBase
                className="bp-field__type-input"
                placeholder={t("popup.method.paramTypePlaceholder", "type")}
                value={p.parameterType ?? ""}
                readOnly={signatureLocked}
                title={signatureLocked ? signatureLockTitle : undefined}
                inputProps={{
                  "aria-label": t("popup.method.paramType", "Parameter type"),
                  autoComplete: "off",
                  spellCheck: false,
                }}
                onChange={(e) => {
                  const next = [...parameters]
                  next[idx] = { ...p, parameterType: e.target.value }
                  patchParameters(next)
                }}
                onBlur={() => {
                  const t = p.parameterType
                  if (t) {
                    const next = [...parameters]
                    next[idx] = { ...p, parameterType: normalizeType(t) }
                    patchParameters(next)
                  }
                }}
              />
              </span>
            </div>
            <RowActionButton
              danger
              label={t("popup.method.deleteParameter", "Delete parameter")}
              disabled={signatureLocked}
              onClick={() =>
                patchParameters(parameters.filter((_, i) => i !== idx))
              }
            >
              <TrashIcon size={14} />
            </RowActionButton>
          </div>
        ))}
        {!signatureLocked && (
          <div className="bp-field bp-field--add">
            <InputBase
              className="bp-field__name"
              placeholder={t(
                "popup.method.addParameterPlaceholder",
                "+ add parameter (name: type, Enter)"
              )}
              inputProps={{
                "aria-label": t("popup.method.addParameter", "Add parameter"),
                autoComplete: "off",
                spellCheck: false,
              }}
              onKeyDown={(e: KeyboardEvent<HTMLElement>) => {
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
          </div>
        )}
      </Box>

      {/* Implementation type and cross-diagram dropdowns */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <span className="bp-detail-label">
          {t("popup.method.typeLabel", "Type:").replace(/:\s*$/, "")}
        </span>
        <Select
          size="small"
          fullWidth
          value={implementationType}
          onChange={(e) => {
            const next = e.target.value as ClassifierMethodImplementationType
            const patch: Partial<ClassNodeElement> = { implementationType: next }
            // Only the reference field of the chosen implementation
            // survives (v3 `handleImplementationTypeChange`).
            if (next === "state_machine") {
              patch.code = ""
              patch.quantumCircuitId = ""
              patch.neuralNetworkId = ""
            } else if (next === "quantum_circuit") {
              patch.code = ""
              patch.stateMachineId = ""
              patch.neuralNetworkId = ""
            } else if (next === "neural_network") {
              patch.code = ""
              patch.stateMachineId = ""
              patch.quantumCircuitId = ""
            } else if (next === "none") {
              patch.code = ""
              patch.stateMachineId = ""
              patch.quantumCircuitId = ""
              patch.neuralNetworkId = ""
            } else {
              patch.stateMachineId = ""
              patch.quantumCircuitId = ""
              patch.neuralNetworkId = ""
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
          inputProps={{
            "aria-label": t("popup.method.implementationType", "Implementation"),
          }}
        >
          {IMPLEMENTATION_TYPES.map((it) => (
            <MenuItem key={it.value} value={it.value}>
              {it.labelKey ? t(it.labelKey, it.label) : it.label}
            </MenuItem>
          ))}
        </Select>
        {implementationType === "state_machine" &&
          (stateMachines.length > 0 ? (
            <Select
              size="small"
              value={row.stateMachineId ?? ""}
              displayEmpty
              onChange={(e) =>
                onPatch({ stateMachineId: String(e.target.value) })
              }
              fullWidth
            >
              <MenuItem value="">
                {t(
                  "popup.method.selectStateMachine",
                  "-- Select State Machine --"
                )}
              </MenuItem>
              {stateMachines.map((sm) => (
                <MenuItem key={sm.id} value={sm.id}>
                  {sm.name}
                </MenuItem>
              ))}
            </Select>
          ) : (
            <Typography
              variant="caption"
              title={t(
                "popup.method.createStateMachineFirst",
                "Create a State Machine diagram in your project first"
              )}
            >
              {t("popup.method.noStateMachines", "No state machines available")}
            </Typography>
          ))}
        {implementationType === "quantum_circuit" &&
          (quantumCircuits.length > 0 ? (
            <Select
              size="small"
              value={row.quantumCircuitId ?? ""}
              displayEmpty
              onChange={(e) =>
                onPatch({ quantumCircuitId: String(e.target.value) })
              }
              fullWidth
            >
              <MenuItem value="">
                {t(
                  "popup.method.selectQuantumCircuit",
                  "-- Select Quantum Circuit --"
                )}
              </MenuItem>
              {quantumCircuits.map((qc) => (
                <MenuItem key={qc.id} value={qc.id}>
                  {qc.name}
                </MenuItem>
              ))}
            </Select>
          ) : (
            <Typography
              variant="caption"
              title={t(
                "popup.method.createQuantumCircuitFirst",
                "Create a Quantum Circuit diagram in your project first"
              )}
            >
              {t(
                "popup.method.noQuantumCircuits",
                "No quantum circuits available"
              )}
            </Typography>
          ))}
        {implementationType === "neural_network" &&
          (neuralNetworks.length > 0 ? (
            <Select
              size="small"
              value={row.neuralNetworkId ?? ""}
              displayEmpty
              onChange={(e) =>
                onPatch({ neuralNetworkId: String(e.target.value) })
              }
              fullWidth
              data-testid="method-neural-network-select"
            >
              <MenuItem value="">
                {t(
                  "popup.method.selectNeuralNetwork",
                  "-- Select Neural Network --"
                )}
              </MenuItem>
              {neuralNetworks.map((nn) => (
                <MenuItem key={nn.id} value={nn.id}>
                  {nn.name}
                </MenuItem>
              ))}
            </Select>
          ) : (
            <Typography
              variant="caption"
              title={t(
                "popup.method.createNeuralNetworkFirst",
                "Create a Neural Network diagram in your project first"
              )}
            >
              {t(
                "popup.method.noNeuralNetworks",
                "No neural networks available"
              )}
            </Typography>
          ))}
      </Box>

      {(implementationType === "code" || implementationType === "bal") && (
        <Box
          sx={{
            border: "1px solid var(--bp-border)",
            borderRadius: "8px",
            overflow: "hidden",
            backgroundColor: "var(--bp-surface)",
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
              minHeight: 32,
              pl: 1.25,
              pr: 0.5,
              borderBottom: "1px solid var(--bp-border)",
            }}
          >
            <Typography variant="caption" sx={{ fontWeight: 600, fontSize: 12 }}>
              {implementationType === "bal"
                ? "BESSER Action Language"
                : "Python"}{" "}
              {t("popup.method.implementation", "Implementation")}
            </Typography>
            {(row.code ?? "").trim().length > 0 && (
              <button
                type="button"
                className="bp-add-btn"
                onClick={() => onPatch({ code: "" })}
              >
                {t("popup.method.clearCode", "Clear Code")}
              </button>
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
                ? t("popup.method.balBodyPlaceholder", "BAL method body…")
                : t("popup.method.pythonBodyPlaceholder", "Python method body…")
            }
          />
          </div>
        </Box>
      )}
      {/* Per-method fill / text colors (mirrors the AttributeRow pair). */}
      <div className="bp-detail-row">
        <span className="bp-detail-label" style={{ minWidth: 44 }}>
          {t("popup.class.colors", "Colors")}
        </span>
        <RowColorSwatch
          label={t("stylePane.rowFillColor", "Row fill color")}
          value={row.fillColor}
          fallbackCss="var(--besser-background, #fff)"
          onChange={(color) => onPatch({ fillColor: color })}
        />
        <RowColorSwatch
          label={t("stylePane.rowTextColor", "Row text color")}
          value={row.textColor}
          fallbackCss="var(--besser-primary-contrast, #000)"
          onChange={(color) => onPatch({ textColor: color })}
        />
      </div>
        </div>
      )}
    </div>
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
  const { t } = useTranslation()

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
  const neuralNetworkDiagrams = diagramBridge.getNeuralNetworkDiagrams()

  // Local "add new row" inputs — declared before the early return (Rules
  // of Hooks: a node deleted while the panel is open changed hook order).
  const [newAttrName, setNewAttrName] = useState("")
  const [newMethodName, setNewMethodName] = useState("")
  // Keyboard row navigation targets (develop `attributeRefs` / `methodRefs`).
  const attributeInputRefs = useRef<(HTMLInputElement | null)[]>([])
  const methodInputRefs = useRef<(HTMLInputElement | null)[]>([])
  const newAttributeInputRef = useRef<HTMLInputElement | null>(null)
  const newMethodInputRef = useRef<HTMLInputElement | null>(null)

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

  const addMethod = (
    rawName: string,
    overrides?: (methodName: string) => Partial<ClassNodeElement>
  ) => {
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
      ...overrides?.(methodName),
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
  // v3 parity (`uml-classifier-update.tsx` createMethodWithCode): the
  // "📝 Code" quick-create button adds a method (named from the pending
  // input, else `new_method`) that already carries a Python code body.
  const addMethodWithCode = () => {
    addMethod(newMethodName.trim() || "new_method", (methodName) => ({
      implementationType: "code",
      code: `def ${methodName || "new_method"}(self):\n    """Add your docstring here."""\n    # Add your implementation here\n    pass\n`,
    }))
    setNewMethodName("")
  }

  /* ----- Render --------------------------------------------------------- */

  const isEnumeration = nodeData.stereotype === "Enumeration"

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 1.5,
      }}
    >
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <NodeStyleEditor
          nodeData={nodeData}
          handleDataFieldUpdate={handleDataFieldUpdate}
        />
        <StereotypeButtonGroup
          nodeId={elementId}
          selectedStereotype={
            nodeData.stereotype as unknown as ClassType | undefined
          }
        />
      </Box>

      {/* Metadata fields (description / uri / icon) — mirror v3
          `uml-classifier-update.tsx` `StylePane`. Stored on
          `data.description`, `data.uri`, `data.icon`; round-tripped by
          `convertV4ToV3Class`. Collapsed when all three are empty so the
          panel doesn't spend space on fields most authors leave blank. */}
      <Accordion
        className="bp-disclosure"
        defaultExpanded={
          !!nodeData.description || !!nodeData.uri || !!nodeData.icon
        }
        disableGutters
        elevation={0}
      >
        <AccordionSummary expandIcon={<ChevronDownIcon size={14} />}>
          <InspectorSectionHeader>
            {t("popup.class.metadata", "Metadata")}
          </InspectorSectionHeader>
        </AccordionSummary>
        <AccordionDetails>
          <MuiTextField
            size="small"
            variant="outlined"
            fullWidth
            multiline
            minRows={2}
            placeholder={t("stylePane.description", "Description")}
            inputProps={{
              "aria-label": t("stylePane.description", "Description"),
            }}
            value={nodeData.description ?? ""}
            onChange={(e) =>
              updateNode((d) => ({ ...d, description: e.target.value }))
            }
          />
          <MuiTextField
            size="small"
            variant="outlined"
            fullWidth
            placeholder={t(
              "popup.class.uriPlaceholder",
              "uri (e.g. https://example.com/MyClass)"
            )}
            inputProps={{
              "aria-label": "URI",
              autoComplete: "off",
              spellCheck: false,
            }}
            value={nodeData.uri ?? ""}
            onChange={(e) => updateNode((d) => ({ ...d, uri: e.target.value }))}
          />
          <MuiTextField
            size="small"
            variant="outlined"
            fullWidth
            placeholder={t(
              "popup.class.iconPlaceholder",
              "icon (svg body or url)"
            )}
            inputProps={{
              "aria-label": t("popup.class.icon", "Icon"),
              autoComplete: "off",
              spellCheck: false,
            }}
            value={nodeData.icon ?? ""}
            onChange={(e) =>
              updateNode((d) => ({ ...d, icon: e.target.value }))
            }
          />
        </AccordionDetails>
      </Accordion>
      <DividerLine width="100%" />

      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
        <div className="bp-section-head">
          <InspectorSectionHeader>
            {isEnumeration
              ? t("popup.literals", "Literals")
              : t("popup.attributes", "Attributes")}
            <span className="bp-section-count">
              {nodeData.attributes.length}
            </span>
          </InspectorSectionHeader>
          <AddRowButton
            label={
              isEnumeration
                ? t("popup.class.addLiteral", "add literal")
                : t("popup.class.addAttribute", "add attribute")
            }
            onClick={() => addAttribute("")}
          />
        </div>
        <div className="bp-members">
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
              /* Hide visibility + type columns for Enumeration literals. */
              isEnumerationParent={isEnumeration}
              nameInputRef={(el) => {
                attributeInputRefs.current[idx] = el
              }}
              onSubmitKeyUp={() =>
                (idx === nodeData.attributes.length - 1
                  ? newAttributeInputRef.current
                  : attributeInputRefs.current[idx + 1]
                )?.focus()
              }
            />
          ))}
          {/* Keyboard add: type a name (or `+ name: type`) and press Enter. */}
          <div className="bp-member__row">
            <span className="bp-reorder" aria-hidden="true" />
            <div className="bp-field bp-field--add">
              <InputBase
                className="bp-field__name"
                placeholder={
                  isEnumeration
                    ? t(
                        "popup.class.addLiteralInputPlaceholder",
                        "+ Add literal (Enter for auto-name)"
                      )
                    : t(
                        "popup.class.addAttributeInputPlaceholder",
                        "+ Add attribute (Enter for auto-name)"
                      )
                }
                value={newAttrName}
                inputRef={newAttributeInputRef}
                inputProps={{
                  "aria-label": isEnumeration
                    ? t("popup.class.addLiteral", "add literal")
                    : t("popup.class.addAttribute", "add attribute"),
                  autoComplete: "off",
                  spellCheck: false,
                }}
                onChange={onAttrChange}
                onKeyDown={onAttrKey}
                onBlur={() => {
                  if (newAttrName.trim()) {
                    addAttribute(newAttrName)
                    setNewAttrName("")
                  }
                }}
              />
            </div>
          </div>
        </div>
      </Box>

      {/* V3 hid the Methods section for Enumeration stereotype
          (see `uml-classifier-update.tsx:344`). v4 mirrors that hide rule. */}
      {!isEnumeration && (
        <>
          <DividerLine width="100%" />
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
            <div className="bp-section-head">
              <InspectorSectionHeader>
                {t("popup.methods", "Methods")}
                <span className="bp-section-count">
                  {nodeData.methods.length}
                </span>
              </InspectorSectionHeader>
              <AddRowButton
                label={t("popup.class.addMethod", "add method")}
                onClick={() => addMethod("")}
              />
            </div>
            <div className="bp-members">
              {nodeData.methods.map((row, idx) => (
                <MethodRow
                  key={row.id}
                  row={row}
                  classNames={availableClassNames}
                  enumerationNames={enumerationNames}
                  stateMachines={stateMachineDiagrams}
                  quantumCircuits={quantumCircuitDiagrams}
                  neuralNetworks={neuralNetworkDiagrams}
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
                  nameInputRef={(el) => {
                    methodInputRefs.current[idx] = el
                  }}
                  onSubmitKeyUp={() =>
                    (idx === nodeData.methods.length - 1
                      ? newMethodInputRef.current
                      : methodInputRefs.current[idx + 1]
                    )?.focus()
                  }
                />
              ))}
              <div className="bp-member__row" style={{ gap: 6 }}>
                <span className="bp-reorder" aria-hidden="true" />
                <div className="bp-field bp-field--add">
                  <InputBase
                    className="bp-field__name"
                    placeholder={t(
                      "popup.class.addMethodInputPlaceholder",
                      "+ Add method (Enter)"
                    )}
                    value={newMethodName}
                    inputRef={newMethodInputRef}
                    inputProps={{
                      "aria-label": t("popup.class.addMethod", "add method"),
                      autoComplete: "off",
                      spellCheck: false,
                    }}
                    onChange={onMethodChange}
                    onKeyDown={onMethodKey}
                    onBlur={() => {
                      if (newMethodName.trim()) {
                        addMethod(newMethodName)
                        setNewMethodName("")
                      }
                    }}
                  />
                </div>
                <Tooltip
                  title={t(
                    "popup.classifier.createMethodWithCode",
                    "Create method with code behaviour"
                  )}
                  enterDelay={400}
                  describeChild
                >
                  <button
                    type="button"
                    className="bp-text-btn"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      height: 30,
                      flexShrink: 0,
                    }}
                    aria-label={t(
                      "popup.classifier.createMethodWithCode",
                      "Create method with code behaviour"
                    )}
                    // Keep focus in the name input so its onBlur doesn't
                    // first create a plain (code-less) method.
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={addMethodWithCode}
                  >
                    <CodeIcon size={14} />
                    {t("popup.classifier.codeButton", "Code")}
                  </button>
                </Tooltip>
              </div>
            </div>
          </Box>
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
