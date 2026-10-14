/**
 * Canvas display parity with develop (old Apollon editor):
 *  - object string attribute values are quoted (`name = "v"`), like
 *    develop's `uml-classifier-member-component.tsx` `isStringAttribute`;
 *  - legacy fused method names render like develop's
 *    `UMLClassifierMethod.displayName` (templates such as
 *    Library_Complete.json carry `name: "+ decrease_stock(qty: int)"` with
 *    junk `attributeType: "int): any"`);
 *  - class stereotypes read «abstract» / «enumeration» (develop stored them
 *    lowercase);
 *  - a BPMN subprocess with no `isExpanded` is collapsed everywhere
 *    (develop's `isExpanded: boolean = false`).
 */
import { describe, it, expect, vi } from "vitest"

vi.mock("@/nodes", () => ({
  DiagramNodeTypeRecord: {
    bpmnPool: "bpmnPool",
    bpmnSwimlane: "bpmnSwimlane",
    bpmnGroup: "bpmnGroup",
    bpmnSubprocess: "bpmnSubprocess",
    bpmnTransaction: "bpmnTransaction",
    bpmnCallActivity: "bpmnCallActivity",
  },
}))

import {
  formatDisplayName,
  formatObjectMember,
} from "@/utils/classifierMemberDisplay"
import { formatStereotypeLabel } from "@/components/svgs/nodes/HeaderSection"
import { adoptBpmnContainment } from "@/utils/bpmnContainment"
import { applyBpmnCollapseVisibility } from "@/utils/bpmnConstraints"
import { ClassType } from "@/types"
import type { BesserNode, UMLModel } from "@/typings"

describe("formatObjectMember — string values are quoted like develop", () => {
  it("quotes a str value", () => {
    expect(
      formatObjectMember({ name: "title", attributeType: "str", value: "Dune" })
    ).toBe('title = "Dune"')
  })

  it("treats a missing type as str (v3 UMLObjectAttribute default)", () => {
    expect(formatObjectMember({ name: "title", value: "Dune" })).toBe(
      'title = "Dune"'
    )
  })

  it("shows empty quotes for a string attribute without a value", () => {
    expect(formatObjectMember({ name: "title", attributeType: "string" })).toBe(
      'title = ""'
    )
  })

  it("quotes the value part of a legacy fused 'name = value' row", () => {
    expect(formatObjectMember({ name: "title = Dune", attributeType: "str" })).toBe(
      'title = "Dune"'
    )
  })

  it("leaves non-string values unquoted", () => {
    expect(
      formatObjectMember({ name: "pages", attributeType: "int", value: 412 })
    ).toBe("pages = 412")
    expect(formatObjectMember({ name: "pages", attributeType: "int" })).toBe(
      "pages"
    )
  })
})

describe("formatDisplayName — legacy method signatures match develop", () => {
  const method = (row: Parameters<typeof formatDisplayName>[0]) =>
    formatDisplayName(row, "UML", null, true)

  it("renders a visibility-prefixed fused name verbatim (Library_Complete.json)", () => {
    expect(
      method({
        name: "+ decrease_stock(qty: int)",
        visibility: "public",
        attributeType: "int): any",
      })
    ).toBe("+ decrease_stock(qty: int)")
  })

  it("does not append the stored type when the name already declares one", () => {
    expect(
      method({ name: "notify(sms: str): any", attributeType: "str", visibility: "public" })
    ).toBe("+ notify(sms: str): any")
  })

  it("appends the return type to a fused signature without one", () => {
    expect(
      method({ name: "notify(sms: str)", attributeType: "bool", visibility: "private" })
    ).toBe("- notify(sms: str): bool")
  })
})

describe("class stereotype labels", () => {
  it("lowercases the ClassType values like develop", () => {
    expect(formatStereotypeLabel(ClassType.Abstract)).toBe("abstract")
    expect(formatStereotypeLabel(ClassType.Enumeration)).toBe("enumeration")
    expect(formatStereotypeLabel(ClassType.Interface)).toBe("interface")
  })

  it("keeps free-form stereotypes as typed", () => {
    expect(formatStereotypeLabel("Entity")).toBe("Entity")
  })
})

describe("BPMN subprocess default is collapsed (develop isExpanded = false)", () => {
  const node = (
    id: string,
    type: string,
    x: number,
    y: number,
    width: number,
    height: number,
    extra: Partial<BesserNode> = {}
  ): BesserNode =>
    ({
      id,
      type,
      position: { x, y },
      width,
      height,
      measured: { width, height },
      data: { name: id },
      ...extra,
    }) as BesserNode

  const bpmn = (nodes: BesserNode[]): UMLModel =>
    ({
      version: "4.0.0",
      id: "d",
      title: "t",
      type: "BPMNDiagram",
      nodes,
      edges: [],
      assessments: {},
    }) as UMLModel

  it("does not adopt children into a subprocess with unset isExpanded", () => {
    const out = adoptBpmnContainment(
      bpmn([
        node("sp", "bpmnSubprocess", 0, 0, 400, 200),
        node("t", "bpmnTask", 50, 50, 110, 60),
      ])
    )
    expect(out.nodes.find((n) => n.id === "t")!.parentId).toBeUndefined()
  })

  it("hides the children of a subprocess with unset isExpanded", () => {
    const out = applyBpmnCollapseVisibility([
      { id: "sp", type: "bpmnSubprocess", data: {} },
      { id: "t", type: "bpmnTask", parentId: "sp", data: {} },
    ])
    expect(out.find((n) => n.id === "t")!.hidden).toBe(true)
  })

  it("still shows the children of an explicitly expanded subprocess", () => {
    const out = applyBpmnCollapseVisibility([
      { id: "sp", type: "bpmnSubprocess", data: { isExpanded: true } },
      { id: "t", type: "bpmnTask", parentId: "sp", data: {} },
    ])
    expect(out.find((n) => n.id === "t")!.hidden).toBeFalsy()
  })
})
