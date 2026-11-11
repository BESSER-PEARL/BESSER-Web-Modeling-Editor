/** The dataset `shape` attribute is a list with develop's default. */
import { describe, expect, it } from "vitest"
import { LAYER_ATTRIBUTE_SCHEMA } from "@/nodes/nnDiagram/nnAttributeWidgetConfig"

describe("dataset shape", () => {
  it.each(["TrainingDataset", "TestDataset"])("%s shape is a list defaulting to [32, 32, 3]", (kind) => {
    const shape = LAYER_ATTRIBUTE_SCHEMA[kind].find((f) => f.slug === "shape")
    expect(shape).toMatchObject({ valueType: "List", defaultValue: "[32, 32, 3]" })
  })
})
