import {
  COLLIDING_SLUGS,
  getLayerSchema,
  qualifySlug,
} from "@/nodes/nnDiagram/nnAttributeWidgetConfig"
import {
  getListExpectation,
  NN_ATTRIBUTE_DEFAULTS,
} from "@/nodes/nnDiagram/nnValidationDefaults"

/**
 * Fills an NN layer's missing mandatory attributes with their defaults, as
 * the inspector's first-render auto-fill does (`NNComponentEditPanel`), so a
 * layer is valid as soon as it is created, not only once its panel opened.
 * Returns `data` unchanged for non-layer types or when nothing is missing.
 */
export const withMandatoryNNDefaults = (
  layerKind: string,
  data: Record<string, unknown>
): Record<string, unknown> => {
  const schema = getLayerSchema(layerKind)
  if (schema.length === 0) return data
  const attributes = (data.attributes ?? {}) as Record<string, unknown>
  const patch: Record<string, unknown> = {}
  for (const f of schema) {
    if (!f.mandatory) continue
    const key = COLLIDING_SLUGS.has(f.slug) ? qualifySlug(layerKind, f.slug) : f.slug
    const stored = key in attributes ? attributes[key] : attributes[f.slug]
    if (stored !== undefined && stored !== null && stored !== "") continue
    if (f.slug === "name") {
      patch[key] = typeof data.name === "string" ? data.name : ""
    } else if (f.defaultValue !== undefined) {
      patch[key] = f.defaultValue
    } else {
      const list = getListExpectation(layerKind, f.slug)
      if (list.count !== null) patch[key] = list.example
      else if (NN_ATTRIBUTE_DEFAULTS[f.slug] !== undefined)
        patch[key] = NN_ATTRIBUTE_DEFAULTS[f.slug]
    }
  }
  if (Object.keys(patch).length === 0) return data
  return { ...data, attributes: { ...attributes, ...patch } }
}
