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
/* Component                                                                   */
/* -------------------------------------------------------------------------- */

export const NNComponentEditPanel: React.FC<PopoverProps> = ({
  elementId,
}) => {
  const { nodes, setNodes } = useDiagramStore(
    useShallow((state) => ({
      nodes: state.nodes,
      setNodes: state.setNodes,
    }))
  )

  const node = nodes.find((n) => n.id === elementId)
  if (!node) return null

  const layerKind = node.type as string
  const schema = getLayerSchema(layerKind)
  const data = node.data as NNLayerNodeProps
  const attributes = data.attributes ?? {}

  // Build the predecessor candidate list once — for `predecessor` /
  // `layers_of_tensors` widgets. Candidates are sibling layer nodes
  // sharing the same `parentId` (i.e. inside the same NNContainer).
  const predecessorCandidates = nodes
    .filter(
      (n) =>
        n.id !== elementId &&
        n.parentId &&
        n.parentId === node.parentId &&
        typeof n.type === "string" &&
        n.type.endsWith("Layer")
    )
    .map((n) => ({
      id: n.id,
      name: (n.data as { name?: string }).name ?? n.id,
    }))

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
    updateAttributes({
      ...((node.data as NNLayerNodeProps).attributes ?? {}),
      [key]: value,
    })
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

  /* ─────────────────────────── #30 mandatory auto-fill ─────────────── */

  // Run once per node — populate mandatory attribute keys with defaults
  // when the layer was just dropped from the palette and `data.attributes`
  // is missing them.
  React.useEffect(() => {
    if (schema.length === 0) return
    const missing: Record<string, unknown> = {}
    for (const f of schema) {
      if (!f.mandatory) continue
      const key = COLLIDING_SLUGS.has(f.slug)
        ? qualifySlug(layerKind, f.slug)
        : f.slug
      const stored = readAttribute(f.slug)
      if (stored !== undefined && stored !== null && stored !== "") continue
      // Provide a default. For `name`, derive from the node's `name`
      // field (mirrors v3's `createMandatoryAttributes`); for fixed-
      // option dropdowns use `defaultValue`; otherwise reach into
      // NN_ATTRIBUTE_DEFAULTS.
      if (f.slug === "name") {
        missing[key] = data.name ?? ""
        continue
      }
      if (f.defaultValue !== undefined) {
        missing[key] = f.defaultValue
        continue
      }
      const fallback = NN_ATTRIBUTE_DEFAULTS[f.slug]
      if (fallback !== undefined) {
        missing[key] = fallback
      }
    }
    if (Object.keys(missing).length > 0) {
      updateAttributes({ ...attributes, ...missing })
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
            const enabled = readAttribute(field.slug) !== undefined
            return (
              <NNAttributeRow
                key={`o-${field.slug}`}
                field={field}
                value={readAttribute(field.slug)}
                predecessorCandidates={predecessorCandidates}
                layerKind={layerKind}
                poolingDimension={poolingDimension}
                onChange={(v) => updateAttribute(field.slug, v)}
                enabled={enabled}
                onEnabledChange={(next) => {
                  if (!next) {
                    removeAttribute(field.slug)
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
      // v3 stored a comma-joined list of two predecessor names.
      const current = typeof value === "string" ? value : ""
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
            placeholder="layerA, layerB"
            disabled={!enabled}
            sx={{ flex: 1, ...disabledStyle }}
          />
        </Stack>
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
