/**
 * SA-4 round-trip test for the BESSER UserDiagram migration.
 *
 * Asserts (per the SA-4 brief and `uml-v4-shape.md`):
 *
 *  1. v3 fixture → `migrateUserDiagramV3ToV4` produces a v4 model with
 *     `UserModelName` parents and their `UserModelAttribute` children
 *     collapsed onto `data.attributes` (mirrors SA-2's ObjectName /
 *     ObjectAttribute collapse).
 *  2. Spec open question #1 resolution: `classId` and cached
 *     `className` survive the migration.
 *  3. `attributeOperator` (`< / <= / == / >= / >`) on each row round-trips.
 *  4. `convertV4ToV3User(v4)` is structurally invertible.
 */
import { describe, it, expect } from "vitest"
import {
  migrateUserDiagramV3ToV4,
  convertV4ToV3User,
} from "@/utils/versionConverter"
import type { UserModelNameNodeProps } from "@/types"
import userV3 from "../fixtures/v3/userDiagram.json"

describe("UserDiagram v3 → v4 round-trip", () => {
  it("migrates the v3 fixture to v4 with structural fidelity", () => {
    const v4 = migrateUserDiagramV3ToV4(userV3 as never)

    expect(v4.version).toMatch(/^4\./)
    expect(v4.type).toBe("UserDiagram")

    // 2 UserModelName parents — UserModelAttribute children are
    // collapsed onto `data.attributes`.
    expect(v4.nodes.length).toBe(2)

    const alice = v4.nodes.find((n) => n.id === "u-Alice")!
    expect(alice.type).toBe("UserModelName")
    const aliceData = alice.data as UserModelNameNodeProps
    expect(aliceData.classId).toBe("node-Customer")
    expect(aliceData.className).toBe("Customer")
    expect(aliceData.description).toBe("A customer named Alice")
    expect(aliceData.attributes).toHaveLength(3)
    expect(aliceData.attributes[0].name).toBe("age")
    expect(aliceData.attributes[0].attributeType).toBe("int")
    expect(aliceData.attributes[0].attributeOperator).toBe(">=")
    expect(aliceData.attributes[0].defaultValue).toBe(18)

    const bob = v4.nodes.find((n) => n.id === "u-Bob")!
    expect(bob.type).toBe("UserModelName")
    const bobData = bob.data as UserModelNameNodeProps
    expect(bobData.classId).toBe("node-Admin")
    expect(bobData.attributes).toHaveLength(3)
    expect(bobData.attributes[2].name).toBe("createdOn")
    expect(bobData.attributes[2].attributeType).toBe("date")
    expect(bobData.attributes[2].attributeOperator).toBe("<=")

    // 1 link.
    expect(v4.edges).toHaveLength(1)
    expect(v4.edges[0].type).toBe("UserModelLink")
    expect(v4.edges[0].source).toBe("u-Bob")
    expect(v4.edges[0].target).toBe("u-Alice")
  })

  it("round-trips v4 → v3 → v4 with structural equality", () => {
    const v4 = migrateUserDiagramV3ToV4(userV3 as never)
    const v3Round = convertV4ToV3User(v4)
    const v4Again = migrateUserDiagramV3ToV4(v3Round)

    const canonical = (m: typeof v4) => ({
      type: m.type,
      nodes: m.nodes
        .map((n) => {
          const d = n.data as UserModelNameNodeProps
          return {
            id: n.id,
            type: n.type,
            name: d.name,
            classId: d.classId ?? null,
            className: d.className ?? null,
            description: d.description ?? null,
            attributes:
              d.attributes
                ?.map((a) => ({
                  id: a.id,
                  name: a.name,
                  attributeType: a.attributeType ?? null,
                  attributeOperator: a.attributeOperator ?? null,
                  defaultValue: a.defaultValue ?? null,
                }))
                .sort((x, y) => x.id.localeCompare(y.id)) ?? [],
          }
        })
        .sort((a, b) => a.id.localeCompare(b.id)),
      edges: m.edges
        .map((e) => ({
          id: e.id,
          type: e.type,
          source: e.source,
          target: e.target,
          name: (e.data as { name?: string }).name ?? "",
        }))
        .sort((a, b) => a.id.localeCompare(b.id)),
    })

    expect(JSON.stringify(canonical(v4Again))).toBe(
      JSON.stringify(canonical(v4))
    )
  })

  it("preserves an attribute rename through a v4 → v3 → v4 cycle", () => {
    const v4 = migrateUserDiagramV3ToV4(userV3 as never)
    const alice = v4.nodes.find((n) => n.id === "u-Alice")!
    const data = alice.data as UserModelNameNodeProps
    data.attributes = data.attributes.map((a) =>
      a.id === "ua-Alice-1" ? { ...a, name: "ageRenamed" } : a
    )

    const v3Round = convertV4ToV3User(v4)
    const v4Again = migrateUserDiagramV3ToV4(v3Round)

    const aliceAgain = v4Again.nodes.find((n) => n.id === "u-Alice")!
    const aliceData = aliceAgain.data as UserModelNameNodeProps
    expect(aliceData.attributes.find((a) => a.id === "ua-Alice-1")?.name).toBe(
      "ageRenamed"
    )
  })
})

/**
 * SA-2.2 #38 regression: when a v3 fixture embeds the comparator into
 * the row's `name` (`"age >= 18"`) instead of providing the explicit
 * `attributeOperator` field, the migrator must synthesize it. Mirrors
 * v3's `extractComparatorFromName` at
 * `packages/editor/.../uml-user-model-attribute.ts:27-33`.
 */
describe("UserModelAttribute attributeOperator synthesis from name", () => {
  it("synthesizes attributeOperator from embedded comparator in name", () => {
    const v3 = {
      version: "3.0.0" as const,
      type: "UserDiagram" as const,
      size: { width: 800, height: 600 },
      interactive: { elements: {}, relationships: {} },
      elements: {
        "u-Alice": {
          id: "u-Alice",
          name: "Alice: Customer",
          type: "UserModelName",
          owner: null,
          bounds: { x: 0, y: 0, width: 200, height: 120 },
          classId: "node-Customer",
        },
        "ua-Alice-1": {
          id: "ua-Alice-1",
          name: "age >= 18", // embedded comparator
          type: "UserModelAttribute",
          owner: "u-Alice",
          bounds: { x: 0, y: 30, width: 200, height: 30 },
          attributeType: "int",
          // no attributeOperator field — must be synthesized
        },
        "ua-Alice-2": {
          id: "ua-Alice-2",
          name: "score < 0.9",
          type: "UserModelAttribute",
          owner: "u-Alice",
          bounds: { x: 0, y: 60, width: 200, height: 30 },
          attributeType: "float",
        },
        "ua-Alice-3": {
          id: "ua-Alice-3",
          name: "country = ES", // legacy single-`=`
          type: "UserModelAttribute",
          owner: "u-Alice",
          bounds: { x: 0, y: 90, width: 200, height: 30 },
          attributeType: "str",
        },
        "ua-Alice-4": {
          id: "ua-Alice-4",
          name: "explicit_field", // no embedded comparator
          type: "UserModelAttribute",
          owner: "u-Alice",
          bounds: { x: 0, y: 120, width: 200, height: 30 },
          attributeType: "str",
          attributeOperator: ">", // explicit field wins
        },
        "ua-Alice-5": {
          id: "ua-Alice-5",
          name: "name_only_field",
          type: "UserModelAttribute",
          owner: "u-Alice",
          bounds: { x: 0, y: 150, width: 200, height: 30 },
          attributeType: "str",
          // no comparator anywhere — operator should be undefined
        },
      },
      relationships: {},
    }

    const v4 = migrateUserDiagramV3ToV4(v3 as never)
    const alice = v4.nodes.find((n) => n.id === "u-Alice")!
    const aliceData = alice.data as UserModelNameNodeProps

    const byId = (id: string) =>
      aliceData.attributes.find((a) => a.id === id)!

    // Embedded `>=` is extracted.
    expect(byId("ua-Alice-1").attributeOperator).toBe(">=")
    // Embedded `<` is extracted.
    expect(byId("ua-Alice-2").attributeOperator).toBe("<")
    // Single `=` normalises to `==` (per v3 `normalizeUserModelAttributeComparator`).
    expect(byId("ua-Alice-3").attributeOperator).toBe("==")
    // Explicit `attributeOperator` field wins over name extraction.
    expect(byId("ua-Alice-4").attributeOperator).toBe(">")
    // No comparator → no synthesized field (caller decides default).
    expect(byId("ua-Alice-5").attributeOperator).toBeUndefined()
  })
})
