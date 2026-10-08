import {
  Box,
  Button,
  Checkbox,
  MenuItem,
  Select,
  Stack,
  TextField as MuiTextField,
} from "@mui/material"
import React from "react"
import { useShallow } from "zustand/shallow"
import type { Node } from "@xyflow/react"
import { useDiagramStore } from "@/store/context"
import { NNLayerNodeProps } from "@/types"
import { DividerLine, NodeStyleEditor, Typography } from "@/components/ui"
import { PopoverProps } from "@/components/popovers/types"
import { useTranslation, type Translate } from "@/i18n"
import { InspectorSectionHeader } from "../_shared"
import {
  AttributeWidgetConfig,
  COLLIDING_SLUGS,
  getLayerSchema,
  getTnsTypeAttributeNames,
  getTnsTypeCategory,
  NN_INPUT_MODULE,
  qualifySlug,
  TnsTypeCategory,
} from "@/nodes/nnDiagram/nnAttributeWidgetConfig"
import {
  getListExpectation,
  NN_ATTRIBUTE_DEFAULTS,
} from "@/nodes/nnDiagram/nnValidationDefaults"
import {
  interpolate,
  validateOnChange,
  validateOnSubmit,
  ValidationContext,
} from "@/nodes/nnDiagram/nnAttributeValidators"
import {
  formatLayersOfTensors as formatLayersOfTensorsList,
  formatPadAmount,
  formatRepeatDim,
  formatSubscriptIndices,
  formatSubscriptIndicesDisplay,
  isCompletePadAmountPair,
  PadAmountPair,
  parseLayersOfTensors as parseLayersOfTensorsList,
  parsePadAmount,
  parseRepeatDim,
  parseSubscriptIndices,
  SubscriptDimension,
} from "@/nodes/nnDiagram/nnAttributeValueFormats"
import { computeNNPredecessors } from "@/utils/nnPredecessors"

/**
 * Generic NN inspector: drives the 17 layer-kind panels from a single
 * body that reads its field schema from `nnAttributeWidgetConfig`.
 *
 * Ported behaviour (v3 develop + smart-generator):
 *   - per-layer conditional optional-attribute filtering — TensorOp by
 *     `tns_type` (`TNS_TYPE_ATTRIBUTES`, plus `actual_vars` only once a
 *     recurrent layer feeds the op and `pad_value` only for
 *     `pad_mode = constant`), Pooling by `pooling_type`, Datasets by
 *     `input_format`;
 *   - mandatory-attribute auto-population and legacy dropdown
 *     normalization on first render;
 *   - a per-row "enable this optional attribute" checkbox;
 *   - config-driven validation of every free-text value
 *     (`nnAttributeValidators`, smart-gen b8272e99): complete values
 *     commit while typing, invalid ones show a translated message, a
 *     submit of anything else falls back to the default;
 *   - structured editors for `layers_of_tensors` (operand count per
 *     `tns_type` category, numeric literals for binary ops, `INPUT` as a
 *     source), `subscript_indices`, `repeat_dim`, `pad_amount` and the
 *     `actual_vars` append list;
 *   - every string goes through the `popup.nn.*` translation keys.
 *
 * The `dimension` slug is stored qualified (`pooling.dimension` /
 * `batch_normalization.dimension`) on Pooling / BatchNorm; reads
 * tolerate both forms.
 */

/* -------------------------------------------------------------------------- */
/* Conditional optional-attribute filtering                                    */
/* -------------------------------------------------------------------------- */

/** TensorOp optional fields offered for `tns_type` (`TNS_TYPE_ATTRIBUTES`). */
function filterTensorOpOptionals(
  optionalSlugs: string[],
  tnsType: string,
  options: { hasRecurrentInput: boolean; padMode: string }
): string[] {
  const offered = new Set(getTnsTypeAttributeNames(tnsType))
  return optionalSlugs.filter((slug) => {
    if (!offered.has(slug)) return false
    // actual_vars only makes sense once a recurrent layer feeds this op.
    if (slug === "actual_vars") return options.hasRecurrentInput
    // pad_value is ignored by every pad_mode other than 'constant'.
    if (slug === "pad_value") return options.padMode === "constant"
    return true
  })
}

/** Pooling optional fields filtered by `pooling_type`. */
function filterPoolingOptionals(
  optionalSlugs: string[],
  poolingType: string
): string[] {
  // - `global_*` hide kernel/stride/padding/output_dim
  // - `adaptive_*` hide kernel/stride/padding (keep output_dim)
  // - `average`/`max` hide output_dim only
  const globalHidden = new Set([
    "kernel_dim",
    "stride_dim",
    "padding_amount",
    "padding_type",
    "output_dim",
  ])
  const adaptiveHidden = new Set([
    "kernel_dim",
    "stride_dim",
    "padding_amount",
    "padding_type",
  ])
  const standardHidden = new Set(["output_dim"])

  if (poolingType === "global_average" || poolingType === "global_max") {
    return optionalSlugs.filter((s) => !globalHidden.has(s))
  }
  if (poolingType === "adaptive_average" || poolingType === "adaptive_max") {
    return optionalSlugs.filter((s) => !adaptiveHidden.has(s))
  }
  if (poolingType === "average" || poolingType === "max") {
    return optionalSlugs.filter((s) => !standardHidden.has(s))
  }
  return optionalSlugs
}

/** Dataset optional fields filtered by `input_format`. */
function filterDatasetOptionals(
  optionalSlugs: string[],
  inputFormat: string
): string[] {
  if (inputFormat !== "images") {
    // shape and normalize only apply to image datasets.
    return optionalSlugs.filter((s) => s !== "shape" && s !== "normalize")
  }
  return optionalSlugs
}

/** Instance name of an NN node (`attributes.name`, else `data.name`). */
function nnNodeName(node: Node): string {
  const data = (node.data ?? {}) as {
    name?: string
    attributes?: Record<string, unknown>
  }
  const attrName = data.attributes?.name
  return typeof attrName === "string" && attrName !== ""
    ? attrName
    : (data.name ?? "")
}

const RECURRENT_KINDS = new Set(["RNNLayer", "LSTMLayer", "GRULayer"])

/** Whether `layers_of_tensors` references an RNN / LSTM / GRU layer. */
export function hasRecurrentLayersSelected(
  layersOfTensors: unknown,
  nodes: Node[]
): boolean {
  if (typeof layersOfTensors !== "string" || layersOfTensors === "") return false
  const names = parseLayersOfTensorsList(layersOfTensors).filter(
    (v) => v && !/^-?\d+\.?\d*$/.test(v)
  )
  if (names.length === 0) return false
  const recurrent = new Set(
    nodes.filter((n) => RECURRENT_KINDS.has(n.type ?? "")).map(nnNodeName)
  )
  return names.some((name) => recurrent.has(name))
}

/* -------------------------------------------------------------------------- */
/* Discriminator-change pruning                                                */
/* -------------------------------------------------------------------------- */

/**
 * TensorOp: a `tns_type` change starts the op fresh — every optional
 * attribute is deleted, only `name` and `tns_type` survive (smart-gen
 * `nn-attribute-update.tsx::handleValueChange`). Exported for unit tests.
 */
export function pruneTensorOpAttributes(
  attributes: Record<string, unknown>,
  _tnsType: string
): Record<string, unknown> {
  const next: Record<string, unknown> = {}
  for (const key of ["name", "tns_type"]) {
    if (key in attributes) next[key] = attributes[key]
  }
  return next
}

/** Pooling: `global_*` drops kernel/stride/padding/output_dim;
 *  `adaptive_*` drops kernel/stride/padding; `average`/`max` drop
 *  output_dim. (`pooling.dimension` is never auto-deleted.) */
export function prunePoolingAttributes(
  attributes: Record<string, unknown>,
  poolingType: string
): Record<string, unknown> {
  let doomed: string[] = []
  if (poolingType === "global_average" || poolingType === "global_max") {
    doomed = [
      "kernel_dim",
      "stride_dim",
      "padding_amount",
      "padding_type",
      "output_dim",
    ]
  } else if (
    poolingType === "adaptive_average" ||
    poolingType === "adaptive_max"
  ) {
    doomed = ["kernel_dim", "stride_dim", "padding_amount", "padding_type"]
  } else if (poolingType === "average" || poolingType === "max") {
    doomed = ["output_dim"]
  }
  const next = { ...attributes }
  for (const slug of doomed) delete next[slug]
  return next
}

/** Datasets: non-image input formats drop `shape` / `normalize`. */
export function pruneDatasetAttributes(
  attributes: Record<string, unknown>,
  inputFormat: string
): Record<string, unknown> {
  if (inputFormat === "images") return attributes
  const next = { ...attributes }
  delete next.shape
  delete next.normalize
  return next
}

/**
 * Pooling dimension sync (`handleDimensionChange`): rewrite
 * `kernel_dim` / `stride_dim` / `output_dim` to the new dimension's
 * arity **iff the key is currently present**.
 */
export function syncPoolingDimensionAttributes(
  attributes: Record<string, unknown>,
  dimension: string
): Record<string, unknown> {
  const next = { ...attributes }
  for (const slug of ["kernel_dim", "stride_dim", "output_dim"]) {
    if (next[slug] === undefined) continue
    next[slug] = getListExpectation("PoolingLayer", slug, dimension).example
  }
  return next
}

/* -------------------------------------------------------------------------- */
/* Metrics multiselect (de)serialization                                       */
/* -------------------------------------------------------------------------- */

/** Parse the canonical bracketed metrics string (`"[accuracy, mae]"` or
 *  the bare legacy `"accuracy, mae"`) into the selected list. */
export function parseMetricsValue(value: string): string[] {
  return value
    .replace(/^\[|\]$/g, "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
}

/** Serialize back to the canonical bracketed form; empty selection
 *  stores `""` (develop parity). */
export function formatMetricsValue(selected: string[]): string {
  return selected.length > 0 ? `[${selected.join(", ")}]` : ""
}

/* -------------------------------------------------------------------------- */
/* layers_of_tensors (de)serialization                                         */
/* -------------------------------------------------------------------------- */

/** Parse the wire form `"['layerA', 'layerB']"` / `"['x', 1.5]"`. */
export function parseLayersOfTensors(value: string): string[] {
  return parseLayersOfTensorsList(value)
}

/** Serialize operands to the wire form: names quoted, numbers bare. */
export function formatLayersOfTensors(...selections: string[]): string {
  return formatLayersOfTensorsList(selections)
}

/* -------------------------------------------------------------------------- */
/* Component                                                                   */
/* -------------------------------------------------------------------------- */

const SELECTION_WIDGETS = new Set([
  "predecessor",
  "layers_of_tensors",
  "subscript_indices",
  "pad_amount",
])

export const NNComponentEditPanel: React.FC<PopoverProps> = ({
  elementId,
}) => {
  const { t } = useTranslation()
  const { nodes, edges, setNodes } = useDiagramStore(
    useShallow((state) => ({
      nodes: state.nodes,
      edges: state.edges,
      setNodes: state.setNodes,
    }))
  )

  // UI-only "armed" rows: ticking the checkbox of a selection widget
  // shows its editor WITHOUT creating the attribute (it is only
  // persisted once a value is picked). Keyed by element.
  const [armedRows, setArmedRows] = React.useState<Record<string, boolean>>({})

  const node = nodes.find((n) => n.id === elementId)

  const layerKind = (node?.type as string) ?? ""
  const schema = getLayerSchema(layerKind)
  const data = (node?.data ?? {}) as NNLayerNodeProps
  const attributes = data.attributes ?? {}

  // Read the current value for an attribute slug, tolerating both the
  // qualified and unqualified key forms.
  const readAttribute = (slug: string): unknown => {
    if (COLLIDING_SLUGS.has(slug)) {
      const q = qualifySlug(layerKind, slug)
      if (q in attributes) return attributes[q]
    }
    return attributes[slug]
  }

  const updateAttributes = (next: Record<string, unknown>) => {
    setNodes((all) =>
      all.map((n) =>
        n.id === elementId
          ? {
              ...n,
              data: { ...n.data, attributes: next } as NNLayerNodeProps,
            }
          : n
      )
    )
  }

  /* ──────────── mandatory auto-fill + legacy normalization ─────────── */

  // Run once per node — populate mandatory attribute keys with defaults
  // when the layer was just dropped from the palette, and rewrite any
  // dropdown value outside the current whitelist to the schema default
  // (`cross_entropy` → `crossentropy`, `zeros` → `valid`, …).
  React.useEffect(() => {
    if (!node || schema.length === 0) return
    const patch: Record<string, unknown> = {}
    for (const f of schema) {
      const key = COLLIDING_SLUGS.has(f.slug)
        ? qualifySlug(layerKind, f.slug)
        : f.slug
      const stored = readAttribute(f.slug)

      if (
        f.widget === "dropdown" &&
        f.options &&
        typeof stored === "string" &&
        stored !== "" &&
        !(f.options as readonly string[]).includes(stored) &&
        f.defaultValue !== undefined
      ) {
        patch[key] = f.defaultValue
        continue
      }

      if (!f.mandatory) continue
      if (stored !== undefined && stored !== null && stored !== "") continue
      // `name` mirrors the node's own name (the backend reads
      // `attributes.name`).
      if (f.slug === "name") {
        patch[key] = data.name ?? ""
        continue
      }
      if (f.defaultValue !== undefined) {
        patch[key] = f.defaultValue
        continue
      }
      // List-shaped mandatory fields whose shape varies by layer kind
      // (Conv `kernel_dim`, LayerNormalization `normalized_shape`).
      const listExpectation = getListExpectation(layerKind, f.slug)
      if (listExpectation.count !== null) {
        patch[key] = listExpectation.example
        continue
      }
      const fallback = NN_ATTRIBUTE_DEFAULTS[f.slug]
      if (fallback !== undefined) {
        patch[key] = fallback
      }
    }
    if (Object.keys(patch).length > 0) {
      updateAttributes({ ...attributes, ...patch })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elementId])

  if (!node) return null

  // Predecessor candidates — graph-aware upstream walk over incoming
  // `NNNext` edges (TensorOps / NNReferences included, nearest first).
  const predecessorCandidates = computeNNPredecessors(nodes, edges, elementId)

  /* ─────────────────────────── State helpers ────────────────────────── */

  const updateName = (name: string) => {
    setNodes((all) =>
      all.map((n) => {
        if (n.id !== elementId) return n
        const current = (n.data as NNLayerNodeProps).attributes ?? {}
        // Keep `attributes.name` (what the backend reads) in sync with the
        // canvas label.
        const nextAttrs = schema.some((f) => f.slug === "name")
          ? { ...current, name }
          : current
        return {
          ...n,
          data: { ...n.data, name, attributes: nextAttrs } as NNLayerNodeProps,
        }
      })
    )
  }

  const keyFor = (slug: string) =>
    COLLIDING_SLUGS.has(slug) ? qualifySlug(layerKind, slug) : slug

  const updateAttribute = (slug: string, value: unknown) => {
    let next: Record<string, unknown> = {
      ...((node.data as NNLayerNodeProps).attributes ?? {}),
      [keyFor(slug)]: value,
    }
    // Discriminator-change pruning + pooling dimension sync — ONE
    // attributes patch per write.
    if (layerKind === "TensorOp" && slug === "tns_type") {
      next = pruneTensorOpAttributes(next, String(value))
    } else if (layerKind === "PoolingLayer" && slug === "pooling_type") {
      next = prunePoolingAttributes(next, String(value))
    } else if (
      (layerKind === "TrainingDataset" || layerKind === "TestDataset") &&
      slug === "input_format"
    ) {
      next = pruneDatasetAttributes(next, String(value))
    } else if (layerKind === "PoolingLayer" && slug === "dimension") {
      // BatchNorm dimension deliberately takes the plain write path.
      next = syncPoolingDimensionAttributes(next, String(value))
    }
    updateAttributes(next)
  }

  const removeAttribute = (slug: string) => {
    const next = { ...((node.data as NNLayerNodeProps).attributes ?? {}) }
    delete next[keyFor(slug)]
    delete next[slug] // tolerate both forms
    updateAttributes(next)
  }

  const handleStyleFieldUpdate = (key: string, value: string) => {
    if (key === "name") {
      updateName(value)
      return
    }
    setNodes((all) =>
      all.map((n) =>
        n.id === elementId
          ? { ...n, data: { ...n.data, [key]: value } as NNLayerNodeProps }
          : n
      )
    )
  }

  /* ─────────────────────────── Field filtering ─────────────────────── */

  const mandatoryFields = schema.filter((f) => f.mandatory && f.slug !== "name")
  let optionalFields = schema.filter((f) => !f.mandatory && f.slug !== "name")

  const readString = (slug: string, fallback: string): string => {
    const v = readAttribute(slug)
    return typeof v === "string" && v !== "" ? v : fallback
  }

  let tnsType: string | undefined
  if (layerKind === "TensorOp") {
    tnsType = readString("tns_type", "reshape")
    const allowed = new Set(
      filterTensorOpOptionals(
        optionalFields.map((f) => f.slug),
        tnsType,
        {
          hasRecurrentInput: hasRecurrentLayersSelected(
            readAttribute("layers_of_tensors"),
            nodes
          ),
          padMode: readString("pad_mode", ""),
        }
      )
    )
    optionalFields = optionalFields.filter((f) => allowed.has(f.slug))
  } else if (layerKind === "PoolingLayer") {
    const allowed = new Set(
      filterPoolingOptionals(
        optionalFields.map((f) => f.slug),
        readString("pooling_type", "max")
      )
    )
    optionalFields = optionalFields.filter((f) => allowed.has(f.slug))
  } else if (layerKind === "TrainingDataset" || layerKind === "TestDataset") {
    const allowed = new Set(
      filterDatasetOptionals(
        optionalFields.map((f) => f.slug),
        readString("input_format", "images")
      )
    )
    optionalFields = optionalFields.filter((f) => allowed.has(f.slug))
  }

  const poolingDimension =
    layerKind === "PoolingLayer" ? readString("dimension", "2D") : undefined

  const rowContext = {
    layerKind,
    poolingDimension,
    predecessorCandidates,
    tnsCategory: tnsType ? getTnsTypeCategory(tnsType) : ("binary" as const),
    t,
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <NodeStyleEditor
        nodeData={data as never}
        handleDataFieldUpdate={handleStyleFieldUpdate}
      />
      <DividerLine width="100%" />

      {mandatoryFields.map((field) => (
        <NNAttributeRow
          key={`m-${field.slug}`}
          field={field}
          value={readAttribute(field.slug)}
          {...rowContext}
          onChange={(v) => updateAttribute(field.slug, v)}
          onClear={() => removeAttribute(field.slug)}
          enabled
        />
      ))}

      {optionalFields.length > 0 && (
        <>
          <DividerLine width="100%" />
          <InspectorSectionHeader>
            {t("popup.nn.optionalAttributes", "optional attributes")}
          </InspectorSectionHeader>
          {optionalFields.map((field) => {
            const armedKey = `${elementId}:${field.slug}`
            const isSelectionWidget = SELECTION_WIDGETS.has(field.widget)
            const enabled =
              readAttribute(field.slug) !== undefined ||
              armedRows[armedKey] === true
            const arm = (on: boolean) =>
              setArmedRows((prev) => ({ ...prev, [armedKey]: on }))
            return (
              <NNAttributeRow
                // Re-mount per tns_type so structured editors start fresh.
                key={`o-${field.slug}-${tnsType ?? ""}`}
                field={field}
                value={readAttribute(field.slug)}
                {...rowContext}
                onChange={(v) => {
                  // Predecessor: the empty item REMOVES the attribute; the
                  // row stays armed so the dropdown remains visible.
                  if (field.widget === "predecessor" && (v === "" || v === null)) {
                    removeAttribute(field.slug)
                    arm(true)
                    return
                  }
                  updateAttribute(field.slug, v)
                }}
                onClear={() => {
                  removeAttribute(field.slug)
                  arm(true)
                }}
                enabled={enabled}
                onEnabledChange={(next) => {
                  if (!next) {
                    removeAttribute(field.slug)
                    arm(false)
                    return
                  }
                  // Selection widgets arm without creating the attribute.
                  if (isSelectionWidget) {
                    arm(true)
                    return
                  }
                  // Pooling list fields seed the dimension-aware example.
                  if (
                    layerKind === "PoolingLayer" &&
                    (field.slug === "kernel_dim" ||
                      field.slug === "stride_dim" ||
                      field.slug === "output_dim")
                  ) {
                    updateAttribute(
                      field.slug,
                      getListExpectation(layerKind, field.slug, poolingDimension)
                        .example
                    )
                    return
                  }
                  const def =
                    field.defaultValue ?? NN_ATTRIBUTE_DEFAULTS[field.slug] ?? ""
                  updateAttribute(field.slug, def)
                }}
              />
            )
          })}
        </>
      )}
    </Box>
  )
}

/* -------------------------------------------------------------------------- */
/* Per-widget row dispatch                                                     */
/* -------------------------------------------------------------------------- */

interface NNAttributeRowProps {
  field: AttributeWidgetConfig
  value: unknown
  predecessorCandidates: { id: string; name: string }[]
  layerKind: string
  poolingDimension?: string
  tnsCategory: TnsTypeCategory
  t: Translate
  onChange: (value: unknown) => void
  /** Remove the attribute while keeping the row open. */
  onClear: () => void
  /** Mandatory rows are always enabled and render no checkbox. */
  enabled: boolean
  onEnabledChange?: (next: boolean) => void
}

const asString = (value: unknown): string =>
  value === undefined || value === null ? "" : String(value)

const NNAttributeRow: React.FC<NNAttributeRowProps> = (props) => {
  const { field, enabled, onEnabledChange, t } = props
  const [error, setError] = React.useState<string | null>(null)
  const label = field.label ?? field.slug

  const checkboxId = React.useId()
  const checkbox = onEnabledChange ? (
    <Checkbox
      size="small"
      checked={enabled}
      onChange={(e) => onEnabledChange(e.target.checked)}
      inputProps={{ id: checkboxId }}
    />
  ) : null

  const stacked = field.widget === "layers_of_tensors"
  const below =
    enabled &&
    (field.widget === "subscript_indices" ||
      field.widget === "repeat_dim" ||
      field.widget === "pad_amount")

  return (
    <Box>
      <Stack
        direction="row"
        alignItems={stacked ? "flex-start" : "center"}
        spacing={0.5}
      >
        {checkbox}
        {/* An optional row's name is the checkbox's <label>: clicking it
            toggles the field. */}
        {checkbox ? (
          <Box
            component="label"
            htmlFor={checkboxId}
            sx={{
              typography: "caption",
              color: "var(--besser-primary-contrast, #000000)",
              minWidth: 100,
              pt: stacked ? 1 : 0,
              cursor: "pointer",
            }}
          >
            {label}
          </Box>
        ) : (
          <Typography variant="caption" sx={{ minWidth: 100, pt: stacked ? 1 : 0 }}>
            {label}
          </Typography>
        )}
        {enabled && <NNAttributeWidget {...props} onError={setError} />}
      </Stack>
      {below && <NNStructuredEditor {...props} />}
      {enabled && error && (
        <Typography variant="caption" sx={{ color: "error.main", display: "block", ml: 4 }}>
          {error}
        </Typography>
      )}
      {enabled && !error && field.helpTextKey && (
        <Typography
          variant="caption"
          sx={{ color: "text.secondary", display: "block", ml: 4 }}
        >
          {t(field.helpTextKey)}
        </Typography>
      )}
    </Box>
  )
}

/** Empty + INPUT + predecessor items shared by every module selector. */
const predecessorItems = (
  candidates: { id: string; name: string }[],
  emptyLabel: string
) => [
  <MenuItem key="__empty__" value="">
    {emptyLabel}
  </MenuItem>,
  <MenuItem key="__input__" value={NN_INPUT_MODULE}>
    {NN_INPUT_MODULE}
  </MenuItem>,
  ...candidates
    .filter((p) => p.name !== NN_INPUT_MODULE)
    .map((p) => (
      <MenuItem key={p.id} value={p.name}>
        {p.name}
      </MenuItem>
    )),
]

const NNAttributeWidget: React.FC<
  NNAttributeRowProps & { onError: (error: string | null) => void }
> = ({
  field,
  value,
  predecessorCandidates,
  layerKind,
  poolingDimension,
  tnsCategory,
  t,
  onChange,
  onClear,
  onError,
}) => {
  switch (field.widget) {
    case "dropdown": {
      const opts = field.options ?? []
      const stored = asString(value)
      // Legacy values outside the whitelist render as the default.
      const current =
        stored !== "" && (opts as readonly string[]).includes(stored)
          ? stored
          : (field.defaultValue ?? opts[0] ?? "")
      return (
        <Select
          size="small"
          value={current}
          onChange={(e) => onChange(String(e.target.value))}
          sx={{ flex: 1 }}
        >
          {opts.map((o) => (
            <MenuItem key={o} value={o}>
              {o}
            </MenuItem>
          ))}
        </Select>
      )
    }
    case "multiselect": {
      // Metrics-style toggle multi-select.
      const opts = field.options ?? []
      const selected = parseMetricsValue(asString(value)).filter((m) =>
        (opts as readonly string[]).includes(m)
      )
      return (
        <Select
          multiple
          displayEmpty
          size="small"
          value={selected}
          onChange={(e) => {
            const next =
              typeof e.target.value === "string"
                ? e.target.value.split(",").map((s) => s.trim())
                : e.target.value
            onChange(formatMetricsValue(next))
          }}
          renderValue={(picked) =>
            picked.length > 0
              ? `[${picked.join(", ")}]`
              : t("popup.nn.row.selectMetrics", "Select metrics")
          }
          sx={{ flex: 1 }}
        >
          {opts.map((o) => (
            <MenuItem key={o} value={o}>
              <Checkbox size="small" checked={selected.includes(o)} />
              {o}
            </MenuItem>
          ))}
        </Select>
      )
    }
    case "append_list":
      return (
        <AppendListWidget
          value={asString(value)}
          options={field.options ?? []}
          t={t}
          onChange={onChange}
        />
      )
    case "predecessor":
      return (
        <Select
          size="small"
          value={asString(value)}
          onChange={(e) => onChange(String(e.target.value))}
          displayEmpty
          sx={{ flex: 1 }}
        >
          {predecessorItems(
            predecessorCandidates,
            t("popup.nn.row.selectPredecessor", "(select predecessor)")
          )}
        </Select>
      )
    case "layers_of_tensors":
      return (
        <LayersOfTensorsWidget
          value={asString(value)}
          category={tnsCategory}
          predecessorCandidates={predecessorCandidates}
          t={t}
          onCommit={onChange}
          onClear={onClear}
        />
      )
    case "subscript_indices":
    case "repeat_dim":
    case "pad_amount":
      return (
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          {t("popup.nn.row.seeBelow", "see below")}
        </Typography>
      )
    case "text":
    default:
      return (
        <ValidatedTextField
          value={asString(value)}
          field={field}
          layerKind={layerKind}
          poolingDimension={poolingDimension}
          t={t}
          onCommit={onChange}
          onError={onError}
        />
      )
  }
}

/* -------------------------------------------------------------------------- */
/* Validated free-text field                                                   */
/* -------------------------------------------------------------------------- */

const ValidatedTextField: React.FC<{
  value: string
  field: AttributeWidgetConfig
  layerKind: string
  poolingDimension?: string
  t: Translate
  onCommit: (value: string) => void
  onError: (error: string | null) => void
}> = ({ value, field, layerKind, poolingDimension, t, onCommit, onError }) => {
  // Draft keeps an incomplete / invalid entry visible without storing it.
  const [draft, setDraft] = React.useState<string | null>(null)
  const ctx = (): ValidationContext => ({
    attributeName: field.slug,
    attributeType: field.valueType ?? "str",
    layerKind,
    poolingDimension,
    currentValue: value,
    translate: (key) => t(key),
  })

  const expectation = getListExpectation(layerKind, field.slug, poolingDimension)
  const placeholder =
    field.valueType === "List" && expectation.count !== null
      ? expectation.example
      : t(field.placeholderKey ?? "popup.nn.row.valuePlaceholder", "value")

  const handleChange = (next: string) => {
    const outcome = validateOnChange(next, ctx())
    if (!outcome) {
      setDraft(null)
      onError(null)
      onCommit(next)
      return
    }
    setDraft(next)
    onError(outcome.error)
    if (outcome.commit) onCommit(next)
  }

  const handleSubmit = () => {
    if (draft === null) return
    const outcome = validateOnSubmit(draft.trim(), ctx())
    setDraft(null)
    if (!outcome) return
    // An invalid submit reverts the field, so say so next to the error.
    onError(
      outcome.error && outcome.reset
        ? `${outcome.error.replace(/[.\s]+$/, "")}. ${t("popup.nn.row.reverted", "Reverted to {{value}}.", {
            value: outcome.value === "" ? '""' : outcome.value,
          })}`
        : outcome.error
    )
    if (outcome.value !== value) onCommit(outcome.value)
  }

  return (
    <MuiTextField
      size="small"
      variant="outlined"
      fullWidth
      value={draft ?? value}
      placeholder={placeholder}
      onChange={(e) => handleChange(e.target.value)}
      onBlur={handleSubmit}
      onKeyDown={(e) => {
        if (e.key === "Enter") handleSubmit()
      }}
      sx={{ flex: 1 }}
    />
  )
}

/* -------------------------------------------------------------------------- */
/* actual_vars append list                                                     */
/* -------------------------------------------------------------------------- */

const AppendListWidget: React.FC<{
  value: string
  options: readonly string[]
  t: Translate
  onChange: (value: string) => void
}> = ({ value, options, t, onChange }) => {
  const current = value
    .replace(/^\[|\]$/g, "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)
  return (
    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flex: 1 }}>
      <Select
        size="small"
        displayEmpty
        value=""
        renderValue={() =>
          current.length > 0
            ? `[${current.join(", ")}]`
            : t("popup.nn.row.selectValues", "Select values")
        }
        // Always appends (one entry per input tensor, duplicates allowed).
        onChange={(e) => {
          const picked = String(e.target.value)
          if (picked) onChange(`[${[...current, picked].join(", ")}]`)
        }}
        sx={{ flex: 1 }}
      >
        {options.map((o) => (
          <MenuItem key={o} value={o}>
            {o}
          </MenuItem>
        ))}
      </Select>
      {current.length > 0 && (
        <Button
          size="small"
          aria-label="remove last"
          onClick={() => onChange(`[${current.slice(0, -1).join(", ")}]`)}
          sx={{ minWidth: 0 }}
        >
          ✕
        </Button>
      )}
    </Stack>
  )
}

/* -------------------------------------------------------------------------- */
/* layers_of_tensors                                                           */
/* -------------------------------------------------------------------------- */

const NUMERIC_LITERAL_REGEX = /^-?(\d+\.?\d*|\.\d*)$/

const ordinal = (t: Translate, index: number): string => {
  if (index === 0) return t("popup.nn.row.ordinal1", "1st")
  if (index === 1) return t("popup.nn.row.ordinal2", "2nd")
  return interpolate(t("popup.nn.row.ordinalN", "{n}th"), { n: index + 1 })
}

const dimensionLabel = (t: Translate, index: number): string =>
  interpolate(t("popup.nn.row.dim", "Dim {n}:"), { n: index + 1 })

/**
 * Operand editor sized by the `tns_type` category (smart-gen
 * `renderLayersOfTensors`): unary = 1 selector; binary = 2 operands,
 * each a module OR a numeric literal (floats included, 216e12b7);
 * double = 2 modules; n-ary = 2+ modules with add/remove. `INPUT` is
 * always offered (d128be4f). The value is stored once the minimum
 * operand count is reached, and removed only when every operand is
 * cleared.
 */
const LayersOfTensorsWidget: React.FC<{
  value: string
  category: TnsTypeCategory
  predecessorCandidates: { id: string; name: string }[]
  t: Translate
  onCommit: (value: string) => void
  onClear: () => void
}> = ({ value, category, predecessorCandidates, t, onCommit, onClear }) => {
  const [selections, setSelections] = React.useState<string[]>(() =>
    parseLayersOfTensorsList(value)
  )
  const minimum = category === "unary" ? 1 : 2
  const display = [...selections]
  while (display.length < minimum) display.push("")

  const store = (next: string[]) => {
    setSelections(next)
    const nonEmpty = next.filter((s) => s !== "")
    if (nonEmpty.length >= minimum) {
      onCommit(formatLayersOfTensorsList(nonEmpty))
    } else if (nonEmpty.length === 0) {
      onClear()
    }
  }

  const pick = (index: number, picked: string) => {
    const next = [...display]
    next[index] = picked
    store(next)
  }

  const remove = (index: number) => {
    const next = display.filter((_, i) => i !== index)
    setSelections(next)
    const nonEmpty = next.filter((s) => s !== "")
    if (nonEmpty.length >= 2) onCommit(formatLayersOfTensorsList(nonEmpty))
    else onClear()
  }

  return (
    <Stack spacing={0.5} sx={{ flex: 1 }}>
      {display.map((selection, index) => {
        const isNumber = NUMERIC_LITERAL_REGEX.test(selection)
        return (
          <Stack key={index} direction="row" alignItems="center" spacing={0.5}>
            <Typography variant="caption" sx={{ minWidth: 30 }}>
              {ordinal(t, index)}:
            </Typography>
            <Select
              size="small"
              value={isNumber ? "" : selection}
              onChange={(e) => pick(index, String(e.target.value))}
              displayEmpty
              sx={{ flex: 1 }}
            >
              {predecessorItems(
                predecessorCandidates,
                category === "binary"
                  ? t("popup.nn.row.selectOrEnterNumber", "(select or enter number)")
                  : t("popup.nn.row.select", "(select)")
              )}
            </Select>
            {category === "binary" && (
              <>
                <Typography variant="caption">
                  {t("popup.nn.row.or", "or")}
                </Typography>
                <MuiTextField
                  size="small"
                  value={isNumber ? selection : ""}
                  placeholder={t("popup.nn.row.numericPlaceholder", "numeric")}
                  onChange={(e) => pick(index, e.target.value)}
                  sx={{ width: 90 }}
                />
              </>
            )}
            {category === "n-ary" && index >= 2 && (
              <Button size="small" onClick={() => remove(index)} sx={{ minWidth: 0 }}>
                ✕
              </Button>
            )}
          </Stack>
        )
      })}
      {category === "n-ary" && (
        <Button
          size="small"
          variant="text"
          onClick={() => setSelections([...display, ""])}
          sx={{ alignSelf: "flex-start", textTransform: "none" }}
        >
          {t("popup.nn.row.addElement", "+ Add Element")}
        </Button>
      )}
    </Stack>
  )
}

/* -------------------------------------------------------------------------- */
/* subscript_indices / repeat_dim / pad_amount                                 */
/* -------------------------------------------------------------------------- */

const NNStructuredEditor: React.FC<NNAttributeRowProps> = ({
  field,
  value,
  predecessorCandidates,
  t,
  onChange,
  onClear,
}) => {
  const stored = asString(value)
  switch (field.widget) {
    case "subscript_indices":
      return (
        <SubscriptIndicesEditor value={stored} t={t} onChange={onChange} onClear={onClear} />
      )
    case "repeat_dim":
      return (
        <RepeatDimEditor
          value={stored}
          predecessorCandidates={predecessorCandidates}
          t={t}
          onChange={onChange}
          onClear={onClear}
        />
      )
    case "pad_amount":
      return <PadAmountEditor value={stored} t={t} onChange={onChange} onClear={onClear} />
    default:
      return null
  }
}

const EditorBox: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Stack spacing={0.5} sx={{ ml: 4, mt: 0.5 }}>
    {children}
  </Stack>
)

const ValuePreview: React.FC<{ t: Translate; text: string }> = ({ t, text }) => (
  <Typography
    variant="caption"
    sx={{ fontFamily: "monospace", color: "text.secondary" }}
  >
    <strong>{t("popup.nn.row.value", "Value:")}</strong> {text}
  </Typography>
)

const SubscriptIndicesEditor: React.FC<{
  value: string
  t: Translate
  onChange: (value: string) => void
  onClear: () => void
}> = ({ value, t, onChange, onClear }) => {
  const [dims, setDims] = React.useState<SubscriptDimension[]>(() =>
    parseSubscriptIndices(value)
  )
  const shown = dims.length > 0 ? dims : [{ type: "index" } as SubscriptDimension]

  const store = (next: SubscriptDimension[]) => {
    setDims(next)
    if (next.length > 0) onChange(formatSubscriptIndices(next))
    else onClear()
  }

  const setField = (
    index: number,
    key: "value" | "start" | "stop" | "step",
    raw: string
  ) => {
    const text = raw.trim()
    const num = text === "" ? undefined : parseInt(text, 10)
    if (text !== "" && (num === undefined || isNaN(num))) return
    const next = [...shown]
    next[index] = { ...next[index], [key]: num }
    store(next)
  }

  return (
    <EditorBox>
      {shown.map((dim, index) => (
        <Stack key={index} direction="row" spacing={0.5} alignItems="center">
          <Typography variant="caption" sx={{ minWidth: 44 }}>
            {dimensionLabel(t, index)}
          </Typography>
          <Select
            size="small"
            value={dim.type}
            onChange={(e) => {
              const next = [...shown]
              next[index] =
                e.target.value === "index"
                  ? { type: "index", value: 0 }
                  : { type: "slice" }
              store(next)
            }}
            sx={{ minWidth: 80 }}
          >
            <MenuItem value="index">{t("popup.nn.row.index", "index")}</MenuItem>
            <MenuItem value="slice">{t("popup.nn.row.slice", "slice")}</MenuItem>
          </Select>
          {dim.type === "index" ? (
            <MuiTextField
              size="small"
              value={dim.value !== undefined ? String(dim.value) : ""}
              placeholder="0"
              onChange={(e) => setField(index, "value", e.target.value)}
              sx={{ flex: 1 }}
            />
          ) : (
            (["start", "stop", "step"] as const).map((key, i) => (
              <React.Fragment key={key}>
                {i > 0 && <Typography variant="caption">:</Typography>}
                <MuiTextField
                  size="small"
                  value={dim[key] !== undefined ? String(dim[key]) : ""}
                  placeholder={t(`popup.nn.row.${key}Placeholder`, key)}
                  onChange={(e) => setField(index, key, e.target.value)}
                  sx={{ flex: 1, minWidth: 50 }}
                />
              </React.Fragment>
            ))
          )}
          {index > 0 && (
            <Button
              size="small"
              onClick={() => store(shown.filter((_, i) => i !== index))}
              sx={{ minWidth: 0 }}
            >
              ✕
            </Button>
          )}
        </Stack>
      ))}
      <Button
        size="small"
        variant="text"
        onClick={() => store([...shown, { type: "index", value: 0 }])}
        sx={{ alignSelf: "flex-start", textTransform: "none" }}
      >
        {t("popup.nn.row.addDimension", "+ Add Dimension")}
      </Button>
      <ValuePreview t={t} text={formatSubscriptIndicesDisplay(dims)} />
    </EditorBox>
  )
}

const INT_REGEX = /^-?\d+$/

const RepeatDimEditor: React.FC<{
  value: string
  predecessorCandidates: { id: string; name: string }[]
  t: Translate
  onChange: (value: string) => void
  onClear: () => void
}> = ({ value, predecessorCandidates, t, onChange, onClear }) => {
  const [dims, setDims] = React.useState<string[]>(() => parseRepeatDim(value))
  const shown = dims.length > 0 ? dims : [""]

  const store = (next: string[]) => {
    setDims(next)
    if (next.some((d) => d.trim() !== "")) onChange(formatRepeatDim(next))
    else onClear()
  }

  const setAt = (index: number, v: string) => {
    const next = [...shown]
    next[index] = v
    store(next)
  }

  return (
    <EditorBox>
      {shown.map((dim, index) => {
        const isInt = INT_REGEX.test(dim.trim())
        return (
          <Stack key={index} direction="row" spacing={0.5} alignItems="center">
            <Typography variant="caption" sx={{ minWidth: 50 }}>
              {dimensionLabel(t, index)}
            </Typography>
            <Select
              size="small"
              value={isInt ? "" : dim}
              displayEmpty
              onChange={(e) => setAt(index, String(e.target.value))}
              sx={{ flex: 1 }}
            >
              {predecessorItems(
                predecessorCandidates,
                t("popup.nn.row.selectLayerOrTensorOp", "(select layer/tensorop)")
              )}
            </Select>
            <Typography variant="caption">{t("popup.nn.row.or", "or")}</Typography>
            <MuiTextField
              size="small"
              value={isInt ? dim : ""}
              placeholder={t("popup.nn.row.enterIntPlaceholder", "enter int")}
              onChange={(e) => setAt(index, e.target.value)}
              sx={{ width: 90 }}
            />
            {index > 0 && (
              <Button
                size="small"
                onClick={() => store(shown.filter((_, i) => i !== index))}
                sx={{ minWidth: 0 }}
              >
                ✕
              </Button>
            )}
          </Stack>
        )
      })}
      <Button
        size="small"
        variant="text"
        onClick={() => setDims([...shown, ""])}
        sx={{ alignSelf: "flex-start", textTransform: "none" }}
      >
        {t("popup.nn.row.addDimension", "+ Add Dimension")}
      </Button>
      <ValuePreview t={t} text={formatRepeatDim(dims)} />
    </EditorBox>
  )
}

const PadAmountEditor: React.FC<{
  value: string
  t: Translate
  onChange: (value: string) => void
  onClear: () => void
}> = ({ value, t, onChange, onClear }) => {
  const [pairs, setPairs] = React.useState<PadAmountPair[]>(() =>
    parsePadAmount(value)
  )

  const store = (next: PadAmountPair[]) => {
    setPairs(next)
    if (next.some(isCompletePadAmountPair)) onChange(formatPadAmount(next))
    else onClear()
  }

  return (
    <EditorBox>
      {pairs.map((pair, index) => (
        <Stack key={index} direction="row" spacing={0.5} alignItems="center">
          <Typography variant="caption" sx={{ minWidth: 50 }}>
            {dimensionLabel(t, index)}
          </Typography>
          {(["left", "right"] as const).map((side) => (
            <React.Fragment key={side}>
              <Typography variant="caption">
                {t(`popup.nn.row.${side}`, `${side}:`)}
              </Typography>
              <MuiTextField
                size="small"
                value={pair[side]}
                placeholder={t("popup.nn.row.intPlaceholder", "int")}
                onChange={(e) => {
                  const next = [...pairs]
                  next[index] = { ...next[index], [side]: e.target.value }
                  store(next)
                }}
                sx={{ width: 70 }}
              />
            </React.Fragment>
          ))}
          {index > 0 && (
            <Button
              size="small"
              onClick={() => store(pairs.filter((_, i) => i !== index))}
              sx={{ minWidth: 0 }}
            >
              ✕
            </Button>
          )}
        </Stack>
      ))}
      <Button
        size="small"
        variant="text"
        onClick={() => setPairs([...pairs, { left: "", right: "" }])}
        sx={{ alignSelf: "flex-start", textTransform: "none" }}
      >
        {t("popup.nn.row.addDimension", "+ Add Dimension")}
      </Button>
      <ValuePreview t={t} text={formatPadAmount(pairs)} />
    </EditorBox>
  )
}
