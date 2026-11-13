import { describe, it, expect, vi } from "vitest"

// SA-FINAL-3 Tier 5 #20: focused parent-child rule tests.
// Verify `isParentNodeType` agrees with `canDropIntoParent` so the hover
// halo doesn't advertise a drop target the predicate then rejects.

// Mock @/nodes to avoid the deep import chain (same pattern as
// nodeUtils.test.ts).
vi.mock("@/nodes", () => ({
  DiagramNodeTypeRecord: {
    package: "package",
    activity: "activity",
    useCaseSystem: "useCaseSystem",
    componentSubsystem: "componentSubsystem",
    deploymentNode: "deploymentNode",
    deploymentComponent: "deploymentComponent",
    bpmnPool: "bpmnPool",
    bpmnGroup: "bpmnGroup",
    bpmnSubprocess: "bpmnSubprocess",
    bpmnTransaction: "bpmnTransaction",
    bpmnCallActivity: "bpmnCallActivity",
  },
}))

import { isParentNodeType } from "@/utils/nodeUtils"
import { canDropIntoParent } from "@/utils/bpmnConstraints"

describe("isParentNodeType (runtime-registered parents)", () => {
  it("returns true for NNContainer", () => {
    expect(isParentNodeType("NNContainer")).toBe(true)
  })

  it("returns true for State", () => {
    expect(isParentNodeType("State")).toBe(true)
  })

  it("returns true for AgentIntent", () => {
    expect(isParentNodeType("AgentIntent")).toBe(true)
  })

  it("returns false for AgentState (bodies inlined, not nested)", () => {
    // SA-FINAL-3 Tier 5 #19: AgentState advertised itself as a parent but
    // canDropIntoParent rejected every child — drop UX promised "accepted"
    // and then nothing landed. Now AgentState is treated as a leaf.
    expect(isParentNodeType("AgentState")).toBe(false)
  })

  it("returns false for leaf agent types", () => {
    expect(isParentNodeType("AgentIntentBody")).toBe(false)
    expect(isParentNodeType("AgentIntentDescription")).toBe(false)
    expect(isParentNodeType("AgentIntentObjectComponent")).toBe(false)
  })

  it("returns false for leaf NN types", () => {
    expect(isParentNodeType("Conv1DLayer")).toBe(false)
    expect(isParentNodeType("LinearLayer")).toBe(false)
    expect(isParentNodeType("TrainingDataset")).toBe(false)
    expect(isParentNodeType("Configuration")).toBe(false)
    expect(isParentNodeType("NNReference")).toBe(false)
  })

  it("returns false for leaf state-machine types", () => {
    expect(isParentNodeType("StateBody")).toBe(false)
    expect(isParentNodeType("StateFallbackBody")).toBe(false)
    expect(isParentNodeType("StateCodeBlock")).toBe(false)
    expect(isParentNodeType("StateInitialNode")).toBe(false)
    expect(isParentNodeType("StateFinalNode")).toBe(false)
  })
})

describe("canDropIntoParent – NNContainer", () => {
  const validLayers = [
    "Conv1DLayer",
    "Conv2DLayer",
    "Conv3DLayer",
    "PoolingLayer",
    "RNNLayer",
    "LSTMLayer",
    "GRULayer",
    "LinearLayer",
    "FlattenLayer",
    "EmbeddingLayer",
    "DropoutLayer",
    "LayerNormalizationLayer",
    "BatchNormalizationLayer",
    "TensorOp",
    "NNReference",
  ]

  it.each(validLayers)("accepts %s inside NNContainer", (child) => {
    expect(canDropIntoParent(child, "NNContainer")).toBe(true)
  })

  it("rejects datasets and configuration (they bind via edges, not nesting)", () => {
    expect(canDropIntoParent("TrainingDataset", "NNContainer")).toBe(false)
    expect(canDropIntoParent("TestDataset", "NNContainer")).toBe(false)
    expect(canDropIntoParent("Configuration", "NNContainer")).toBe(false)
  })

  it("rejects unrelated types", () => {
    expect(canDropIntoParent("class", "NNContainer")).toBe(false)
    expect(canDropIntoParent("bpmnTask", "NNContainer")).toBe(false)
  })
})

describe("canDropIntoParent – State", () => {
  it("accepts the three v3 body shapes", () => {
    expect(canDropIntoParent("StateBody", "State")).toBe(true)
    expect(canDropIntoParent("StateFallbackBody", "State")).toBe(true)
    expect(canDropIntoParent("StateCodeBlock", "State")).toBe(true)
  })

  it("rejects non-body children", () => {
    expect(canDropIntoParent("State", "State")).toBe(false)
    expect(canDropIntoParent("StateInitialNode", "State")).toBe(false)
    expect(canDropIntoParent("class", "State")).toBe(false)
  })
})

describe("canDropIntoParent – AgentIntent", () => {
  it("accepts the three intent children", () => {
    expect(canDropIntoParent("AgentIntentBody", "AgentIntent")).toBe(true)
    expect(canDropIntoParent("AgentIntentDescription", "AgentIntent")).toBe(
      true
    )
    expect(
      canDropIntoParent("AgentIntentObjectComponent", "AgentIntent")
    ).toBe(true)
  })

  it("rejects unrelated agent types", () => {
    expect(canDropIntoParent("AgentState", "AgentIntent")).toBe(false)
    expect(canDropIntoParent("AgentRagElement", "AgentIntent")).toBe(false)
    expect(canDropIntoParent("class", "AgentIntent")).toBe(false)
  })
})

describe("canDropIntoParent – AgentState (defensive guard)", () => {
  // SA-FINAL-3 Tier 5 #19: AgentState is no longer advertised by
  // isParentNodeType, so the drop handler shouldn't reach this branch.
  // But the predicate must still return false defensively for any other
  // caller that passes "AgentState" as parentType.
  it("rejects every candidate child type", () => {
    expect(canDropIntoParent("AgentIntentBody", "AgentState")).toBe(false)
    expect(canDropIntoParent("AgentState", "AgentState")).toBe(false)
    expect(canDropIntoParent("class", "AgentState")).toBe(false)
  })
})
