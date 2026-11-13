import { describe, it, expect, expectTypeOf } from "vitest"
import type {
  BPMNEndEventType,
  BPMNEventProps,
  BPMNIntermediateEventType,
  BPMNStartEventType,
} from "@/types"

/**
 * Upstream Apollon: `BPMNEventProps` is shared by the start, intermediate
 * and end event nodes, so `eventType` is the union of all three event-type
 * unions (type-checked via `tsc -p packages/library/tsconfig.test.json`).
 */
describe("BPMNEventProps.eventType", () => {
  it("accepts intermediate and end event types without casts", () => {
    const end: BPMNEventProps = { name: "Done", eventType: "terminate" }
    const intermediate: BPMNEventProps = { name: "Wait", eventType: "timer" }
    expect([end.eventType, intermediate.eventType]).toEqual(["terminate", "timer"])
    expectTypeOf<BPMNEventProps["eventType"]>().toEqualTypeOf<
      BPMNStartEventType | BPMNIntermediateEventType | BPMNEndEventType
    >()
  })
})
