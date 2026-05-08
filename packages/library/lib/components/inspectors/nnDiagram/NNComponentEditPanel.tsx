import {
  Box,
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
import {
  AttributeWidgetConfig,
  COLLIDING_SLUGS,
  getLayerSchema,
  qualifySlug,
} from "@/nodes/nnDiagram/nnAttributeWidgetConfig"

/**
 * SA-5 generic NN inspector. Drives 17 layer-kind panels (Conv1D…
 * Configuration, TrainingDataset, TestDataset) from a single body that
 * reads its field schema from `nnAttributeWidgetConfig`.
 *
 * Per the SA-5 brief, this is ONE adaptable panel — registry slots for
 * each layer kind point at this same component. The component infers
 * the layer kind from the React-Flow `node.type` and renders:
 *
 *  - the node `name` field (when the layer schema includes a `name`
 *    slug — Configuration is the one exception),
 *  - one row per attribute slug in the schema, dispatched per
 *    `widget` discriminator (text / dropdown / predecessor /
 *    layers_of_tensors).
 *
 * Open question #2 (DimensionAttribute slug collision) — the panel
 * stores the value under the qualified slug
 * (`pooling.dimension` / `batch_normalization.dimension`) when the
 * slug appears in `COLLIDING_SLUGS`. Reads tolerate both the
 * qualified and unqualified key for backward-compat with v3 fixtures
 * the migrator hasn't yet promoted.
 */
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

  const updateName = (name: string) => {
    setNodes((all) =>
      all.map((n) =>
        n.id === elementId ? { ...n, data: { ...n.data, name } } : n
      )
    )
  }

  const updateAttribute = (slug: string, value: unknown) => {
    const key = COLLIDING_SLUGS.has(slug) ? qualifySlug(layerKind, slug) : slug
    setNodes((all) =>
      all.map((n) =>
        n.id === elementId
          ? {
              ...n,
              data: {
                ...n.data,
                attributes: {
                  ...((n.data as NNLayerNodeProps).attributes ?? {}),
                  [key]: value,
                },
              },
            }
          : n
      )
    )
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

      {schema
        .filter((f) => f.slug !== "name")
        .map((field) => (
          <NNAttributeRow
            key={field.slug}
            field={field}
            value={readAttribute(field.slug)}
            predecessorCandidates={predecessorCandidates}
            onChange={(v) => updateAttribute(field.slug, v)}
          />
        ))}
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
  onChange: (value: unknown) => void
}

const NNAttributeRow: React.FC<NNAttributeRowProps> = ({
  field,
  value,
  predecessorCandidates,
  onChange,
}) => {
  switch (field.widget) {
    case "dropdown": {
      const opts = field.options ?? []
      const current =
        typeof value === "string" && value !== ""
          ? value
          : (field.defaultValue ?? opts[0] ?? "")
      return (
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <Typography variant="caption" sx={{ minWidth: 100 }}>
            {field.label ?? field.slug}
          </Typography>
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
        </Stack>
      )
    }
    case "predecessor": {
      const current = typeof value === "string" ? value : ""
      return (
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <Typography variant="caption" sx={{ minWidth: 100 }}>
            {field.label ?? field.slug}
          </Typography>
          <Select
            size="small"
            value={current}
            onChange={(e) => onChange(String(e.target.value))}
            displayEmpty
            sx={{ flex: 1 }}
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
      // v3 stored a comma-joined list of two predecessor names; the
      // editor keeps the same flat string representation so the
      // migrator passes it through unchanged.
      const current = typeof value === "string" ? value : ""
      return (
        <MuiTextField
          size="small"
          variant="outlined"
          fullWidth
          label={field.label ?? field.slug}
          value={current}
          onChange={(e) => onChange(e.target.value)}
          placeholder="layerA, layerB"
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
      return (
        <MuiTextField
          size="small"
          variant="outlined"
          fullWidth
          label={field.label ?? field.slug}
          value={current}
          onChange={(e) => onChange(e.target.value)}
        />
      )
    }
  }
}
