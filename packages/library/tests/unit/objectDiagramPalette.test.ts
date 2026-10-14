/**
 * Wave-3 ObjectDiagram palette parity tests.
 *
 * v3 source of truth: `uml-object-diagram/object-preview.ts`
 * (`composeObjectPreview`): the sidebar composes the object palette
 * dynamically —
 *   - normal view: generic "Object" card + one instance card per class
 *     when `shouldShowInstancedObjects() && hasClassDiagramData()`,
 *   - icon view: instance cards only.
 * Instance cards seed `classId` / `className` / `icon` and one
 * pre-filled attribute row per class attribute (inherited included).
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest"
import {
  getObjectDiagramPaletteEntries,
  defaultInstanceName,
} from "@/components/svgs/nodes/objectDiagram"
import { dropElementConfigs, LAYOUT } from "@/constants"
import { UMLDiagramType, type ObjectNodeProps } from "@/types"
import { diagramBridge } from "@/services/diagramBridge"
import { settingsService } from "@/services/settingsService"

/** Minimal v4 class-diagram payload: Animal ← Dog (inheritance). */
const classDiagramData = {
  nodes: [
    {
      id: "node-Animal",
      type: "class",
      data: {
        name: "Animal",
        attributes: [
          {
            id: "attr-legs",
            name: "legs",
            attributeType: "int",
            visibility: "public",
            defaultValue: 4,
          },
        ],
      },
    },
    {
      id: "node-Dog",
      type: "class",
      data: {
        name: "Dog",
        icon: "<svg><circle r='4'/></svg>",
        attributes: [
          {
            id: "attr-name",
            name: "name",
            attributeType: "str",
            visibility: "public",
          },
        ],
      },
    },
  ],
  edges: [
    {
      id: "edge-inherit",
      type: "ClassInheritance",
      source: "node-Dog",
      target: "node-Animal",
    },
  ],
}

// NOTE: no direct `localStorage` access here — the vitest jsdom
// environment on Node 26 exposes none, and both services already guard
// their own persistence. Resetting the singletons is sufficient.
beforeEach(() => {
  settingsService.resetToDefaults()
  diagramBridge.clearDiagramData()
})

afterEach(() => {
  settingsService.resetToDefaults()
  diagramBridge.clearDiagramData()
})

describe("defaultInstanceName", () => {
  it("lower-cases the first character and appends _1 (v3 seed format)", () => {
    expect(defaultInstanceName("Dog")).toBe("dog_1")
    expect(defaultInstanceName("PersonRecord")).toBe("personRecord_1")
    expect(defaultInstanceName("")).toBe("object_1")
  })
})

describe("getObjectDiagramPaletteEntries — normal view", () => {
  it("returns only the generic Object card when no class data is available", () => {
    const entries = getObjectDiagramPaletteEntries()
    expect(entries).toHaveLength(1)
    expect(entries[0].type).toBe("objectName")
    expect(entries[0].defaultData?.name).toBe("Object")
  })

  it("appends one pre-wired instance card per class when data is present", () => {
    diagramBridge.setClassDiagramData(classDiagramData)

    const entries = getObjectDiagramPaletteEntries()
    // generic + Animal + Dog
    expect(entries).toHaveLength(3)
    expect(entries[0].defaultData?.name).toBe("Object")

    const animal = entries.find(
      (e) => (e.defaultData as ObjectNodeProps).className === "Animal"
    )!
    expect(animal).toBeDefined()
    const animalData = animal.defaultData as ObjectNodeProps
    expect(animalData.name).toBe("animal_1")
    expect(animalData.classId).toBe("node-Animal")
    expect(animalData.attributes).toHaveLength(1)
    expect(animalData.attributes[0]).toMatchObject({
      name: "legs",
      attributeType: "int",
      attributeId: "attr-legs",
      // class default pre-fills the instance value (v3 seeded
      // `name = ${defaultVal}`)
      value: "4",
    })
    // height: header + 1 attribute row
    expect(animal.height).toBe(
      LAYOUT.DEFAULT_HEADER_HEIGHT + LAYOUT.DEFAULT_ATTRIBUTE_HEIGHT
    )
  })

  it("folds inherited attributes into subclass instance cards", () => {
    diagramBridge.setClassDiagramData(classDiagramData)

    const entries = getObjectDiagramPaletteEntries()
    const dog = entries.find(
      (e) => (e.defaultData as ObjectNodeProps).className === "Dog"
    )!
    const dogData = dog.defaultData as ObjectNodeProps
    expect(dogData.name).toBe("dog_1")
    expect(dogData.icon).toBe("<svg><circle r='4'/></svg>")
    const attrNames = dogData.attributes.map((a) => a.name)
    // own attribute + inherited `legs` from Animal
    expect(attrNames).toContain("name")
    expect(attrNames).toContain("legs")
    expect(dog.height).toBe(
      LAYOUT.DEFAULT_HEADER_HEIGHT + 2 * LAYOUT.DEFAULT_ATTRIBUTE_HEIGHT
    )
  })

  it("suppresses instance cards when Show Instanced Objects is off", () => {
    diagramBridge.setClassDiagramData(classDiagramData)
    settingsService.updateSetting("showInstancedObjects", false)

    const entries = getObjectDiagramPaletteEntries()
    expect(entries).toHaveLength(1)
    expect(entries[0].defaultData?.name).toBe("Object")
  })
})

describe("getObjectDiagramPaletteEntries — icon view", () => {
  it("drops the generic Object card and keeps instance cards (v3 composeIconObjectPreview)", () => {
    diagramBridge.setClassDiagramData(classDiagramData)
    settingsService.updateSetting("showIconView", true)

    const entries = getObjectDiagramPaletteEntries()
    expect(
      entries.some((e) => e.defaultData?.name === "Object")
    ).toBe(false)
    expect(entries).toHaveLength(2)

    // Icon-bearing class collapses to the glyph-slot height.
    const dog = entries.find(
      (e) => (e.defaultData as ObjectNodeProps).className === "Dog"
    )!
    expect(dog.height).toBe(LAYOUT.DEFAULT_HEADER_HEIGHT + 60)
    // Icon-less class keeps the attribute-table height.
    const animal = entries.find(
      (e) => (e.defaultData as ObjectNodeProps).className === "Animal"
    )!
    expect(animal.height).toBe(
      LAYOUT.DEFAULT_HEADER_HEIGHT + LAYOUT.DEFAULT_ATTRIBUTE_HEIGHT
    )
  })

  it("is empty in icon view when instances are unavailable (v3 parity)", () => {
    settingsService.updateSetting("showIconView", true)
    expect(getObjectDiagramPaletteEntries()).toHaveLength(0)
  })
})

describe("dropElementConfigs dynamic provider wiring", () => {
  it("recomputes ObjectDiagram palette entries on every access", () => {
    const before = dropElementConfigs[UMLDiagramType.ObjectDiagram]
    expect(before).toHaveLength(1)

    diagramBridge.setClassDiagramData(classDiagramData)
    const after = dropElementConfigs[UMLDiagramType.ObjectDiagram]
    expect(after).toHaveLength(3)

    diagramBridge.clearDiagramData()
    expect(dropElementConfigs[UMLDiagramType.ObjectDiagram]).toHaveLength(1)
  })
})
