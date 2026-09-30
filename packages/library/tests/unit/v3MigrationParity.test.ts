import { describe, it, expect } from "vitest"
import { convertV3ToV4 } from "@/utils/versionConverter"

/**
 * Back-compat parity for v3 (old editor / smart-generator) payloads:
 * fields and member links the old backend honoured must survive the
 * v3 → v4 migration.
 */

const bounds = { x: 0, y: 0, width: 100, height: 40 }

function wrap(type: string, elements: Record<string, unknown>) {
  return {
    id: "d1",
    title: "T",
    model: {
      version: "3.0.0",
      type,
      size: { width: 800, height: 600 },
      interactive: { elements: {}, relationships: {} },
      elements,
      relationships: {},
      assessments: {},
    },
  }
}

describe("legacy body-only ClassOCLConstraint", () => {
  it("keeps constraintName / targetMethodId on free-standing nodes", () => {
    const v4 = convertV3ToV4(
      wrap("ClassDiagram", {
        c1: {
          id: "c1",
          name: "Account",
          type: "Class",
          owner: null,
          bounds,
          attributes: [],
          methods: ["m-deposit"],
        },
        "m-deposit": {
          id: "m-deposit",
          name: "+ deposit(amount: int)",
          type: "ClassMethod",
          owner: "c1",
          bounds,
        },
        "ocl-pre": {
          id: "ocl-pre",
          name: "",
          type: "ClassOCLConstraint",
          owner: null,
          bounds,
          constraint: "amount > 0",
          kind: "precondition",
          targetMethodId: "m-deposit",
          constraintName: "amt_pos",
        },
      }) as never
    )
    const node = v4.nodes.find((n) => n.id === "ocl-pre")!
    expect(node.type).toBe("ClassOCLConstraint")
    expect(node.data).toMatchObject({
      expression: "amount > 0",
      kind: "precondition",
      constraintName: "amt_pos",
      targetMethodId: "m-deposit",
    })
    // The targeted method row keeps its v3 id so the backend can resolve it.
    const cls = v4.nodes.find((n) => n.id === "c1")!
    expect(
      (cls.data as { methods: { id: string }[] }).methods.map((m) => m.id)
    ).toEqual(["m-deposit"])
  })

  it("keeps the body and metadata on owner-collapsed rows", () => {
    const v4 = convertV3ToV4(
      wrap("ClassDiagram", {
        c1: {
          id: "c1",
          name: "Account",
          type: "Class",
          owner: null,
          bounds,
          attributes: [],
          methods: [],
        },
        o1: {
          id: "o1",
          name: "",
          type: "ClassOCLConstraint",
          owner: "c1",
          bounds,
          constraint: "self.balance >= 0",
          kind: "invariant",
          constraintName: "positive",
        },
      }) as never
    )
    const cls = v4.nodes.find((n) => n.id === "c1")!
    expect(
      (cls.data as { oclConstraints?: unknown[] }).oclConstraints
    ).toEqual([
      {
        id: "o1",
        name: "",
        expression: "self.balance >= 0",
        kind: "invariant",
        constraintName: "positive",
      },
    ])
  })
})

describe("class members linked only through the parent's id lists", () => {
  it("keeps attributes / methods listed on the parent but lacking owner", () => {
    const v4 = convertV3ToV4(
      wrap("ClassDiagram", {
        c1: {
          id: "c1",
          name: "Book",
          type: "Class",
          owner: null,
          bounds,
          attributes: ["a2", "a1"],
          methods: ["m1"],
        },
        a1: {
          id: "a1",
          name: "title",
          type: "ClassAttribute",
          owner: "c1",
          bounds,
          attributeType: "str",
        },
        a2: {
          id: "a2",
          name: "pages",
          type: "ClassAttribute",
          owner: null,
          bounds,
          attributeType: "int",
        },
        m1: {
          id: "m1",
          name: "+ read()",
          type: "ClassMethod",
          bounds,
        },
      }) as never
    )
    expect(v4.nodes.map((n) => n.id)).toEqual(["c1"])
    const data = v4.nodes[0].data as {
      attributes: { id: string }[]
      methods: { id: string }[]
    }
    // Listed order first (v3 display order), then owner-only extras.
    expect(data.attributes.map((a) => a.id)).toEqual(["a2", "a1"])
    expect(data.methods.map((m) => m.id)).toEqual(["m1"])
  })

  it("does not steal a listed member owned by another class", () => {
    const v4 = convertV3ToV4(
      wrap("ClassDiagram", {
        c1: {
          id: "c1",
          name: "A",
          type: "Class",
          owner: null,
          bounds,
          attributes: ["a1"],
          methods: [],
        },
        c2: {
          id: "c2",
          name: "B",
          type: "Class",
          owner: null,
          bounds,
          attributes: ["a1"],
          methods: [],
        },
        a1: {
          id: "a1",
          name: "x",
          type: "ClassAttribute",
          owner: "c2",
          bounds,
        },
      }) as never
    )
    const byId = Object.fromEntries(v4.nodes.map((n) => [n.id, n]))
    expect((byId.c1.data as { attributes: unknown[] }).attributes).toEqual([])
    expect(
      (byId.c2.data as { attributes: { id: string }[] }).attributes.map(
        (a) => a.id
      )
    ).toEqual(["a1"])
  })
})

describe("NN attribute rows matched by attributeName", () => {
  it("falls back to attributeName when the element type is unknown", () => {
    const v4 = convertV3ToV4(
      wrap("NNDiagram", {
        l1: {
          id: "l1",
          name: "Conv2DLayer",
          type: "Conv2DLayer",
          owner: null,
          bounds,
          attributes: ["x1", "x2", "x3"],
          methods: [],
        },
        x1: {
          id: "x1",
          name: "name = f1",
          type: "NameAttributeConv2D",
          owner: "l1",
          bounds,
          attributeName: "name",
          value: "f1",
        },
        // Legacy / hand-written type string the slug table doesn't know.
        x2: {
          id: "x2",
          name: "kernel_dim = [3, 3]",
          type: "KernelDimAttribute",
          owner: "l1",
          bounds,
          attributeName: "kernel_dim",
          value: "[3, 3]",
        },
        // attributeName that isn't a Conv2D field is ignored.
        x3: {
          id: "x3",
          name: "bogus = 1",
          type: "WhateverAttribute",
          owner: "l1",
          bounds,
          attributeName: "not_a_field",
          value: "1",
        },
      }) as never
    )
    const layer = v4.nodes.find((n) => n.id === "l1")!
    const attrs = (layer.data as { attributes: Record<string, unknown> })
      .attributes
    expect(attrs.name).toBe("f1")
    expect(attrs.kernel_dim).toBe("[3, 3]")
    expect(attrs.not_a_field).toBeUndefined()
    // The folded attribute rows are not emitted as stray nodes.
    expect(v4.nodes.map((n) => n.id)).not.toContain("x2")
    expect(v4.nodes.map((n) => n.id)).not.toContain("x3")
  })
})
