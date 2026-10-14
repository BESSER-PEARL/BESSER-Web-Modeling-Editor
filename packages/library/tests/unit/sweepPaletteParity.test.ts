/**
 * Wave-3 sweep parity tests (unassigned-gaps brief):
 *
 *  - A5  zoom range — develop allowed zooming to 500%; the migration had
 *    capped MAX_SCALE_TO_ZOOM_IN at 2.5×.
 *  - A2c pre-populated State palette variants — develop
 *    (`state-preview.ts`) shipped `stateWithBody` and
 *    `stateWithBothBodies` drag sources alongside the empty State.
 *  - A3  UserDiagram palette `classId` binding — develop's per-metaclass
 *    palette instances carried the metamodel class binding so
 *    `diagramBridge.getAvailableAssociations(classId)` resolved.
 *  - Palette-drop row re-iding — template body/fallback rows must
 *    materialize with fresh unique ids per drop.
 */
import { describe, it, expect } from "vitest"
import { CANVAS, dropElementConfigs } from "@/constants"
import { UMLDiagramType } from "@/types"
import { cloneDefaultDataWithFreshRowIds } from "@/components/DraggableGhost"
import { getUserModelNamePaletteEntries } from "@/components/svgs/nodes/userDiagram/UserDiagramSVGs"
import { getUserMetaModelClasses } from "@/services/userMetaModel"

describe("A5 — canvas zoom range parity", () => {
  it("allows zooming in to 500% (develop parity) and out to 40%", () => {
    expect(CANVAS.MAX_SCALE_TO_ZOOM_IN).toBe(5.0)
    // 0.4 is a strict superset of develop's 0.5 lower bound.
    expect(CANVAS.MIN_SCALE_TO_ZOOM_OUT).toBeLessThanOrEqual(0.5)
  })
})

describe("A2c — pre-populated State palette variants", () => {
  const smPalette = dropElementConfigs[UMLDiagramType.StateMachineDiagram]
  const stateEntries = smPalette.filter((e) => (e.type as string) === "State")

  it("ships three State drag sources: empty, with body, with both bodies", () => {
    expect(stateEntries).toHaveLength(3)

    const [empty, withBody, withBoth] = stateEntries
    expect(empty.defaultData?.bodies).toBeUndefined()
    expect(empty.defaultData?.fallbackBodies).toBeUndefined()

    const withBodyRows = withBody.defaultData?.bodies as Array<{
      id: string
      name?: string
    }>
    expect(withBodyRows).toHaveLength(1)
    expect(withBodyRows[0].name).toBe("body")
    expect(withBody.defaultData?.fallbackBodies).toBeUndefined()

    const bothBodies = withBoth.defaultData?.bodies as Array<{
      id: string
      name?: string
    }>
    const bothFallbacks = withBoth.defaultData?.fallbackBodies as Array<{
      id: string
      name?: string
    }>
    expect(bothBodies).toHaveLength(1)
    expect(bothBodies[0].name).toBe("body")
    expect(bothFallbacks).toHaveLength(1)
    expect(bothFallbacks[0].name).toBe("fallback body")
  })

  it("materializes body/fallback rows with fresh unique ids per drop", () => {
    const template = stateEntries[2].defaultData as Record<string, unknown>

    const dropA = cloneDefaultDataWithFreshRowIds(template)
    const dropB = cloneDefaultDataWithFreshRowIds(template)

    const idsOf = (data: Record<string, unknown>) =>
      ([
        ...(data.bodies as Array<{ id: string }>),
        ...(data.fallbackBodies as Array<{ id: string }>),
      ]).map((row) => row.id)

    const idsA = idsOf(dropA)
    const idsB = idsOf(dropB)

    // Fresh ids — never the template placeholders.
    const templateIds = idsOf(template)
    for (const id of [...idsA, ...idsB]) {
      expect(templateIds).not.toContain(id)
    }
    // Two drops never collide (row ids become element ids on export).
    expect(new Set([...idsA, ...idsB]).size).toBe(idsA.length + idsB.length)
    // Names survive the re-id.
    expect((dropA.bodies as Array<{ name?: string }>)[0].name).toBe("body")
    expect(
      (dropA.fallbackBodies as Array<{ name?: string }>)[0].name
    ).toBe("fallback body")
  })

  it("leaves non-array attribute dicts untouched (NN palette shape)", () => {
    const nnLike = { attributes: { "pooling.dimension": "2D" } }
    const clone = cloneDefaultDataWithFreshRowIds(nnLike)
    expect(clone.attributes).toEqual({ "pooling.dimension": "2D" })
  })
})

describe("A3 — UserDiagram palette classId binding", () => {
  it("every per-metaclass palette entry exposes the metamodel class id", () => {
    const metaClasses = getUserMetaModelClasses()
    const metaById = new Map(metaClasses.map((c) => [c.id, c.name]))
    const entries = getUserModelNamePaletteEntries()

    expect(entries.length).toBeGreaterThan(0)
    for (const entry of entries) {
      expect(entry.classId).toBeTruthy()
      expect(metaById.get(entry.classId)).toBe(entry.className)
    }
  })

  it("dropped UserModelName defaultData carries data.classId", () => {
    const userPalette = dropElementConfigs[UMLDiagramType.UserDiagram]
    const metaClassEntries = userPalette.filter(
      (e) =>
        (e.type as string) === "UserModelName" &&
        e.defaultData?.className !== "User" // static fallback card
    )
    expect(metaClassEntries.length).toBeGreaterThan(0)

    const metaIds = new Set(getUserMetaModelClasses().map((c) => c.id))
    for (const entry of metaClassEntries) {
      const classId = entry.defaultData?.classId as string
      expect(classId).toBeTruthy()
      expect(metaIds.has(classId)).toBe(true)
    }
  })
})
