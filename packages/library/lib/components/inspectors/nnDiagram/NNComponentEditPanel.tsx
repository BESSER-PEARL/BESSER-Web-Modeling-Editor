import {
  Box,
  Checkbox,
  MenuItem,
  Select,
  Stack,
  TextField as MuiTextField,
} from "@mui/material"
import React from "react"
import { useShallow } from "zustand/shallow"
import { useDiagramStore } from "@/store/context"
import { NNLayerNodeProps } from "@/types"
import { DividerLine, NodeStyleEditor, Typography } from "@/components/ui"
import { PopoverProps } from "@/components/popovers/types"
import { InspectorSectionHeader } from "../_shared"
import {
  AttributeWidgetConfig,
  COLLIDING_SLUGS,
  getLayerSchema,
  qualifySlug,
} from "@/nodes/nnDiagram/nnAttributeWidgetConfig"
import {
  getAttributeDefaultValue,
  getListExpectation,
  LIST_STRICT_REGEX,
  NN_ATTRIBUTE_DEFAULTS,
} from "@/nodes/nnDiagram/nnValidationDefaults"
import { computeNNPredecessors } from "@/utils/nnPredecessors"

/**
 * Generic NN inspector.
 *
 * Baseline: drives 17 layer-kind panels from a single body that
 * reads its field schema from `nnAttributeWidgetConfig`.
 *
 * Deltas (audit recommendations 29–33):
 *   - #29: per-layer conditional optional-attribute filtering for
 *     TensorOp (by `tns_type`), Pooling (by `pooling_type`), and
 *     Datasets (by `input_format`). Source-of-truth port of v3's
 *     `getTensorOpOptionalAttributes`, `getPoolingOptionalAttributes`,
 *     and `getDatasetOptionalAttributes` at
 *     `nn-component-update.tsx:614-669`.
 *   - #30: mandatory-attribute auto-population on first render. v3's
 *     `componentDidMount` (`nn-component-update.tsx:588-605`) created
 *     the mandatory attribute children with default values when none
 *     existed; this runs the equivalent for v4 nodes via a `useEffect`
 *     that fills missing keys on `data.attributes`.
 *   - #31: per-row "enable this optional attribute" checkbox. When
 *     unchecked, the attribute key is removed from `data.attributes`.
 *     Mirrors v3's `OptionalAttributeRow` toggle behaviour.
 *   - #33: `getListExpectation` placeholder + `LIST_STRICT_REGEX`
 *     warning for kernel_dim / stride_dim / output_dim fields. Pooling
 *     placeholders re-resolve when the user changes the layer's
 *     `dimension`.
 *
 * (DimensionAttribute slug collision) — the panel
 * stores the value under the qualified slug (`pooling.dimension` /
 * `batch_normalization.dimension`) when the slug appears in
 * `COLLIDING_SLUGS`. Reads tolerate both forms for backward-compat.
 */

/* -------------------------------------------------------------------------- */
/* Conditional optional-attribute filtering                                    */
/* -------------------------------------------------------------------------- */

/** TensorOp optional fields filtered by `tns_type`. */
function filterTensorOpOptionals(
  optionalSlugs: string[],
  tnsType: string
): string[] {
  switch (tnsType) {
    case "reshape":
      return optionalSlugs.filter((s) => s === "reshape_dim")
    case "concatenate":
      return optionalSlugs.filter(
        (s) => s === "layers_of_tensors" || s === "concatenate_dim"
      )
    case "transpose":
      return optionalSlugs.filter((s) => s === "transpose_dim")
    case "permute":
      return optionalSlugs.filter((s) => s === "permute_dim")
    default:
      return optionalSlugs.filter((s) => s === "layers_of_tensors")
  }
}

/** Pooling optional fields filtered by `pooling_type`. */
function filterPoolingOptionals(
  optionalSlugs: string[],
  poolingType: string
): string[] {
  // Per v3 source-of-truth at `nn-component-update.tsx:649-669`:
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

/* -------------------------------------------------------------------------- */
/* Discriminator-change pruning (develop's monitor, made synchronous)          */
/* -------------------------------------------------------------------------- */

/**
 * Develop's `cleanupHiddenOptionalAttributes`
 * (`nn-association-monitor.tsx` 225-282) ran on every store update and
 * **deleted** attributes invalid for the current discriminator; v4
 * applies the same prune synchronously in the `setNodes` call that
 * writes the new discriminator. The functions below return a pruned
 * copy of the attributes dict. Exported for unit tests.
 */

/** TensorOp: keep only the `*_dim` attr matching `tns_type`
 *  (`layers_of_tensors` is never auto-deleted). */
export function pruneTensorOpAttributes(
  attributes: Record<string, unknown>,
  tnsType: string
): Record<string, unknown> {
  const keepBytype: Record<string, string | undefined> = {
    reshape: "reshape_dim",
    concatenate: "concatenate_dim",
    transpose: "transpose_dim",
    permute: "permute_dim",
    // multiply / matmultiply keep none.
  }
  const keep = keepBytype[tnsType]
  const next = { ...attributes }
  for (const slug of [
    "reshape_dim",
    "concatenate_dim",
    "transpose_dim",
    "permute_dim",
  ]) {
    if (slug !== keep) delete next[slug]
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
 * Pooling dimension sync (develop `handleDimensionChange`,
 * `nn-attribute-update.tsx` 165-238 — wired ONLY for the Pooling
 * dimension; BatchNorm uses the plain write path): rewrite
 * `kernel_dim` / `stride_dim` / `output_dim` to the new dimension's
 * arity **iff the key is currently present**. Values come from
 * `getListExpectation` (`[3]`/`[1]`/`[16]` × arity).
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
 *  the bare legacy `"accuracy, mae"`) into the selected list — develop
 *  `nn-attribute-update.tsx` 267-272. Exported for unit tests. */
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

/** Parse develop's wire form `"['layerA', 'layerB']"` (brackets +
 *  single quotes) into the two selections — develop
 *  `optional-attribute-row.tsx::parseLayersOfTensors` 135-142. */
export function parseLayersOfTensors(value: string): string[] {
  return value
    .replace(/^\[|\]$/g, "")
    .split(",")
    .map((s) => s.trim().replace(/^'|'$/g, ""))
    .filter(Boolean)
}

/** Serialize the two selections back to develop's wire form. Only
 *  meaningful when both are chosen (`formatLayersOfTensors` 144-149). */
export function formatLayersOfTensors(first: string, second: string): string {
  return `['${first}', '${second}']`
}

/* -------------------------------------------------------------------------- */
/* Component                                                                   */
/* -------------------------------------------------------------------------- */

export const NNComponentEditPanel: React.FC<PopoverProps> = ({
  elementId,
}) => {
  const { nodes, edges, setNodes } = useDiagramStore(
    useShallow((state) => ({
      nodes: state.nodes,
      edges: state.edges,
      setNodes: state.setNodes,
    }))
  )

  // UI-only "armed" rows: develop's `handleCheckboxChange` early-returned
  // for `predecessor` / `layers_of_tensors` widgets — ticking the
  // checkbox shows the dropdowns WITHOUT creating the attribute (it is
  // only persisted once a selection is made). Keyed by element so a
  // panel reused across nodes doesn't leak armed state.
  const [armedRows, setArmedRows] = React.useState<Record<string, boolean>>({})

  const node = nodes.find((n) => n.id === elementId)
  if (!node) return null

  const layerKind = node.type as string
  const schema = getLayerSchema(layerKind)
  const data = node.data as NNLayerNodeProps
  const attributes = data.attributes ?? {}

  // Predecessor candidates for the `predecessor` / `layers_of_tensors`
  // widgets — graph-aware upstream walk over incoming `NNNext` edges
  // (develop `_computePredecessors`): TensorOps / NNReferences
  // included, no container filter, nearest-first order.
  const predecessorCandidates = computeNNPredecessors(
    nodes,
    edges,
    elementId
  )

  /* ─────────────────────────── State helpers ────────────────────────── */

  const updateName = (name: string) => {
    setNodes((all) =>
      all.map((n) =>
        n.id === elementId ? { ...n, data: { ...n.data, name } } : n
      )
    )
  }

  const updateAttributes = (
    next: Record<string, unknown>
  ) => {
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

  const updateAttribute = (slug: string, value: unknown) => {
    const key = COLLIDING_SLUGS.has(slug) ? qualifySlug(layerKind, slug) : slug
    let next: Record<string, unknown> = {
      ...((node.data as NNLayerNodeProps).attributes ?? {}),
      [key]: value,
    }
    // Discriminator-change pruning + pooling dimension sync — ONE
    // attributes patch per write (replaces develop's post-hoc monitor).
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
      // BatchNorm dimension deliberately takes the plain write path —
      // develop only wired the sibling sync for DimensionAttributePooling.
      next = syncPoolingDimensionAttributes(next, String(value))
    }
    updateAttributes(next)
  }

  const removeAttribute = (slug: string) => {
    const key = COLLIDING_SLUGS.has(slug) ? qualifySlug(layerKind, slug) : slug
    const next = { ...((node.data as NNLayerNodeProps).attributes ?? {}) }
    delete next[key]
    delete next[slug] // tolerate both forms
    updateAttributes(next)
  }

  const handleStyleFieldUpdate = (key: string, value: string) => {
    setNodes((all) =>
      all.map((n) =>
        n.id === elementId
          ? { ...n, data: { ...n.data, [key]: value } as NNLayerNodeProps }
          : n
      )
    )
  }

  // Read the current value for an attribute slug, tolerating both the
  // qualified and unqualified key forms.
  const readAttribute = (slug: string): unknown => {
    if (COLLIDING_SLUGS.has(slug)) {
      const q = qualifySlug(layerKind, slug)
      if (q in attributes) return attributes[q]
    }
    return attributes[slug]
  }

  /* ──────────── #30 mandatory auto-fill + legacy normalization ────── */

  // Run once per node — populate mandatory attribute keys with defaults
  // when the layer was just dropped from the palette and `data.attributes`
  // is missing them. Additionally (Wave-3 NN-9, mirroring develop's
  // popup-mount rewrites at `nn-attribute-update.tsx` 133-162 +
  // `optional-attribute-row.tsx` 81-102): any dropdown value outside the
  // current whitelist rewrites to the schema default — covers
  // `cross_entropy` → `crossentropy`, `zeros` → `valid` and numeric
  // dimensions → `2D` already stored on v4 documents.
  React.useEffect(() => {
    if (schema.length === 0) return
    const patch: Record<string, unknown> = {}
    for (const f of schema) {
      const key = COLLIDING_SLUGS.has(f.slug)
        ? qualifySlug(layerKind, f.slug)
        : f.slug
      const stored = readAttribute(f.slug)

      // One-shot dropdown whitelist normalization (booleans were
      // coerced to JS booleans by the migrator and are skipped;
      // `multiselect` metrics are never normalized — develop parity).
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
      // Provide a default. For `name`, derive from the node's `name`
      // field (mirrors v3's `createMandatoryAttributes`); for fixed-
      // option dropdowns use `defaultValue`; otherwise reach into
      // NN_ATTRIBUTE_DEFAULTS.
      if (f.slug === "name") {
        patch[key] = data.name ?? ""
        continue
      }
      if (f.defaultValue !== undefined) {
        patch[key] = f.defaultValue
        continue
      }
      // List-shaped mandatory fields whose shape varies by layer kind
      // (Conv1D/2D/3D `kernel_dim`, LayerNormalization
      // `normalized_shape`) can't live in the flat NN_ATTRIBUTE_DEFAULTS
      // table — source them from `getListExpectation`, the same
      // per-(layerKind, slug) table develop's constructors
      // (conv1d/2d/3d-attributes.ts, layernormalization-attributes.ts)
      // hard-code as `[3]` / `[3, 3]` / `[3, 3, 3]` / `[-1]`.
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

  /* ─────────────────────────── Field filtering ─────────────────────── */

  // Mandatory + optional separation. v3's `OptionalAttributeRow` only
  // surfaced optional fields when the user opted in; the v4 inspector
  // uses a per-row checkbox to mirror that UX.
  const mandatoryFields = schema.filter((f) => f.mandatory && f.slug !== "name")
  let optionalFields = schema.filter((f) => !f.mandatory && f.slug !== "name")

  // Gate optional-field visibility on a per-layer
  // discriminator. Read the discriminator before filtering so the
  // panel responds live as the user changes it.
  if (layerKind === "TensorOp") {
    const tnsType =
      (typeof readAttribute("tns_type") === "string"
        ? (readAttribute("tns_type") as string)
        : null) ?? "reshape"
    const allowed = new Set(
      filterTensorOpOptionals(
        optionalFields.map((f) => f.slug),
        tnsType
      )
    )
    optionalFields = optionalFields.filter((f) => allowed.has(f.slug))
  } else if (layerKind === "PoolingLayer") {
    const poolingType =
      (typeof readAttribute("pooling_type") === "string"
        ? (readAttribute("pooling_type") as string)
        : null) ?? "max"
    const allowed = new Set(
      filterPoolingOptionals(
        optionalFields.map((f) => f.slug),
        poolingType
      )
    )
    optionalFields = optionalFields.filter((f) => allowed.has(f.slug))
  } else if (layerKind === "TrainingDataset" || layerKind === "TestDataset") {
    const inputFormat =
      (typeof readAttribute("input_format") === "string"
        ? (readAttribute("input_format") as string)
        : null) ?? "images"
    const allowed = new Set(
      filterDatasetOptionals(
        optionalFields.map((f) => f.slug),
        inputFormat
      )
    )
    optionalFields = optionalFields.filter((f) => allowed.has(f.slug))
  }

  // Resolve the pooling dimension once for the placeholder helper.
  const poolingDimension =
    layerKind === "PoolingLayer"
      ? typeof readAttribute("dimension") === "string"
        ? (readAttribute("dimension") as string)
        : "2D"
      : undefined

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <NodeStyleEditor
        nodeData={data as never}
        handleDataFieldUpdate={handleStyleFieldUpdate}
      />
      <DividerLine width="100%" />

      {schema.some((f) => f.slug === "name") && (
        <MuiTextField
          size="small"
          variant="outlined"
          fullWidth
          label="name"
          value={data.name ?? ""}
          onChange={(e) => updateName(e.target.value)}
        />
      )}

      {mandatoryFields.map((field) => (
        <NNAttributeRow
          key={`m-${field.slug}`}
          field={field}
          value={readAttribute(field.slug)}
          predecessorCandidates={predecessorCandidates}
          layerKind={layerKind}
          poolingDimension={poolingDimension}
          onChange={(v) => updateAttribute(field.slug, v)}
          // Mandatory fields can't be toggled off.
          enabled
          onEnabledChange={undefined}
        />
      ))}

      {optionalFields.length > 0 && (
        <>
          <DividerLine width="100%" />
          <InspectorSectionHeader>optional attributes</InspectorSectionHeader>
          {optionalFields.map((field) => {
            const armedKey = `${elementId}:${field.slug}`
            const isSelectionWidget =
              field.widget === "predecessor" ||
              field.widget === "layers_of_tensors"
            const enabled =
              readAttribute(field.slug) !== undefined ||
              (isSelectionWidget && armedRows[armedKey] === true)
            return (
              <NNAttributeRow
                key={`o-${field.slug}`}
                field={field}
                value={readAttribute(field.slug)}
                predecessorCandidates={predecessorCandidates}
                layerKind={layerKind}
                poolingDimension={poolingDimension}
                onChange={(v) => {
                  // Predecessor: the empty item REMOVES the attribute
                  // (develop deleted it on `(select predecessor)`);
                  // `layers_of_tensors` commits `null` when either
                  // dropdown is cleared — same removal semantics. The
                  // row stays armed so the dropdowns remain visible
                  // (develop's checkbox stayed ticked).
                  if (isSelectionWidget && (v === "" || v === null)) {
                    removeAttribute(field.slug)
                    setArmedRows((prev) => ({ ...prev, [armedKey]: true }))
                    return
                  }
                  updateAttribute(field.slug, v)
                }}
                enabled={enabled}
                onEnabledChange={(next) => {
                  if (!next) {
                    removeAttribute(field.slug)
                    setArmedRows((prev) => ({ ...prev, [armedKey]: false }))
                    return
                  }
                  // Develop parity: enabling a predecessor /
                  // layers_of_tensors row must NOT create the attribute
                  // until a selection is made (`handleCheckboxChange`
                  // early-returns for these widgets).
                  if (isSelectionWidget) {
                    setArmedRows((prev) => ({ ...prev, [armedKey]: true }))
                    return
                  }
                  // Pooling list fields seed the dimension-aware example
                  // (develop's `getInitialValue` via `getListExpectation`)
                  // instead of an empty string / static default.
                  if (
                    layerKind === "PoolingLayer" &&
                    (field.slug === "kernel_dim" ||
                      field.slug === "stride_dim" ||
                      field.slug === "output_dim")
                  ) {
                    updateAttribute(
                      field.slug,
                      getListExpectation(
                        layerKind,
                        field.slug,
                        poolingDimension
                      ).example
                    )
                    return
                  }
                  // Enable: store the schema default (if any).
                  const def =
                    field.defaultValue ??
                    NN_ATTRIBUTE_DEFAULTS[field.slug] ??
                    ""
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
  onChange: (value: unknown) => void
  /** When `false`, the row is rendered greyed-out (optional and
   * disabled). When `true`, the field is rendered active. Mandatory
   * rows pass `enabled` always-true and don't render the checkbox. */
  enabled: boolean
  /** When provided, render an enable/disable checkbox per-row. When
   * undefined, the checkbox is omitted (mandatory rows). */
  onEnabledChange?: (next: boolean) => void
}

const NNAttributeRow: React.FC<NNAttributeRowProps> = ({
  field,
  value,
  predecessorCandidates,
  layerKind,
  poolingDimension,
  onChange,
  enabled,
  onEnabledChange,
}) => {
  // List-shape placeholder + warning.
  const expectation = getListExpectation(
    layerKind,
    field.slug,
    poolingDimension
  )
  const isListField = expectation.count !== null
  const stringValue = typeof value === "string" ? value : ""
  const malformed =
    isListField && enabled && stringValue !== ""
      ? !LIST_STRICT_REGEX.test(stringValue)
      : false

  const checkbox = onEnabledChange ? (
    <Checkbox
      size="small"
      checked={enabled}
      onChange={(e) => onEnabledChange(e.target.checked)}
    />
  ) : null

  const disabledStyle = enabled ? {} : { opacity: 0.6, pointerEvents: "none" }

  switch (field.widget) {
    case "dropdown": {
      const opts = field.options ?? []
      const current =
        typeof value === "string" && value !== ""
          ? value
          : (field.defaultValue ?? opts[0] ?? "")
      return (
        <Stack direction="row" alignItems="center" spacing={0.5}>
          {checkbox}
          <Typography variant="caption" sx={{ minWidth: 100 }}>
            {field.label ?? field.slug}
          </Typography>
          <Select
            size="small"
            value={current}
            onChange={(e) => onChange(String(e.target.value))}
            sx={{ flex: 1, ...disabledStyle }}
            disabled={!enabled}
          >
            {opts.map((o) => (
              <MenuItem key={o} value={o}>
                {o}
              </MenuItem>
            ))}
          </Select>
        </Stack>
      )
    }
    case "multiselect": {
      // Metrics-style checkbox multi-select (develop
      // `nn-attribute-update.tsx` 555-589 + `handleMetricsToggle`).
      const opts = field.options ?? []
      const selected = parseMetricsValue(
        typeof value === "string" ? value : ""
      ).filter((m) => (opts as readonly string[]).includes(m))
      return (
        <Stack direction="row" alignItems="center" spacing={0.5}>
          {checkbox}
          <Typography variant="caption" sx={{ minWidth: 100 }}>
            {field.label ?? field.slug}
          </Typography>
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
              picked.length > 0 ? `[${picked.join(", ")}]` : "Select metrics"
            }
            sx={{ flex: 1, ...disabledStyle }}
            disabled={!enabled}
          >
            {opts.map((o) => (
              <MenuItem key={o} value={o}>
                <Checkbox size="small" checked={selected.includes(o)} />
                {o}
              </MenuItem>
            ))}
          </Select>
        </Stack>
      )
    }
    case "predecessor": {
      const current = typeof value === "string" ? value : ""
      return (
        <Stack direction="row" alignItems="center" spacing={0.5}>
          {checkbox}
          <Typography variant="caption" sx={{ minWidth: 100 }}>
            {field.label ?? field.slug}
          </Typography>
          <Select
            size="small"
            value={current}
            onChange={(e) => onChange(String(e.target.value))}
            displayEmpty
            sx={{ flex: 1, ...disabledStyle }}
            disabled={!enabled}
          >
            <MenuItem value="">— none —</MenuItem>
            {predecessorCandidates.map((p) => (
              <MenuItem key={p.id} value={p.name}>
                {p.name}
              </MenuItem>
            ))}
          </Select>
        </Stack>
      )
    }
    case "layers_of_tensors": {
      return (
        <LayersOfTensorsRow
          label={field.label ?? field.slug}
          value={typeof value === "string" ? value : ""}
          predecessorCandidates={predecessorCandidates}
          enabled={enabled}
          checkbox={checkbox}
          disabledStyle={disabledStyle}
          onCommit={onChange}
        />
      )
    }
    case "text":
    default: {
      const current =
        typeof value === "string"
          ? value
          : value === undefined || value === null
            ? ""
            : String(value)
      const placeholder = isListField
        ? expectation.example
        : (getAttributeDefaultValue(field.slug) || undefined)
      return (
        <Stack direction="row" alignItems="center" spacing={0.5}>
          {checkbox}
          <MuiTextField
            size="small"
            variant="outlined"
            fullWidth
            label={field.label ?? field.slug}
            value={current}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            disabled={!enabled}
            error={malformed}
            helperText={
              malformed
                ? `Expected list shape, e.g. ${expectation.example}`
                : undefined
            }
            sx={{ flex: 1, ...disabledStyle }}
          />
        </Stack>
      )
    }
  }
}

/* -------------------------------------------------------------------------- */
/* layers_of_tensors — dual predecessor dropdowns                              */
/* -------------------------------------------------------------------------- */

interface LayersOfTensorsRowProps {
  label: string
  /** Stored wire value, e.g. `"['layerA', 'layerB']"` (or `""`). */
  value: string
  predecessorCandidates: { id: string; name: string }[]
  enabled: boolean
  checkbox: React.ReactNode
  disabledStyle: Record<string, unknown>
  /** `"['a', 'b']"` when both chosen; `null` when either is cleared
   *  (the parent removes the attribute — develop `handleTensorChange`
   *  deleted it). */
  onCommit: (value: string | null) => void
}

/**
 * Develop parity (`optional-attribute-row.tsx` 435-477): TWO labelled
 * `1st:` / `2nd:` dropdowns fed by the predecessor list. Partial
 * selections live in component state (develop kept `tensor1/tensor2`
 * in state); the attribute is only persisted once BOTH are chosen, and
 * removed when either is cleared.
 */
const LayersOfTensorsRow: React.FC<LayersOfTensorsRowProps> = ({
  label,
  value,
  predecessorCandidates,
  enabled,
  checkbox,
  disabledStyle,
  onCommit,
}) => {
  // Initialize from the stored value once (develop's constructor); the
  // local state stays authoritative for partial picks because a commit
  // of `null` clears the stored attribute.
  const [selection, setSelection] = React.useState<[string, string]>(() => {
    const parsed = parseLayersOfTensors(value)
    return [parsed[0] ?? "", parsed[1] ?? ""]
  })

  const handlePick = (which: 0 | 1, picked: string) => {
    const next: [string, string] = [...selection] as [string, string]
    next[which] = picked
    setSelection(next)
    if (next[0] !== "" && next[1] !== "") {
      onCommit(formatLayersOfTensors(next[0], next[1]))
    } else {
      onCommit(null)
    }
  }

  const renderSelect = (which: 0 | 1, slotLabel: string) => (
    <Stack
      direction="row"
      alignItems="center"
      spacing={0.5}
      sx={{ flex: 1 }}
    >
      <Typography variant="caption">{slotLabel}</Typography>
      <Select
        size="small"
        value={selection[which]}
        onChange={(e) => handlePick(which, String(e.target.value))}
        displayEmpty
        sx={{ flex: 1, ...disabledStyle }}
        disabled={!enabled}
      >
        <MenuItem value="">— none —</MenuItem>
        {predecessorCandidates.map((p) => (
          <MenuItem key={p.id} value={p.name}>
            {p.name}
          </MenuItem>
        ))}
      </Select>
    </Stack>
  )

  return (
    <Stack direction="row" alignItems="center" spacing={0.5}>
      {checkbox}
      <Typography variant="caption" sx={{ minWidth: 100 }}>
        {label}
      </Typography>
      {renderSelect(0, "1st:")}
      {renderSelect(1, "2nd:")}
    </Stack>
  )
}
