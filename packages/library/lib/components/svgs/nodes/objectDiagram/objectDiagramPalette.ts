/**
 * Dynamic ObjectDiagram palette — v3 `composeObjectPreview` parity.
 *
 * v3 source: `uml-object-diagram/object-preview.ts`. The v3 sidebar
 * recomposed the object palette on every render:
 *
 *  - **normal view** (`showIconView` off): one generic "Object" card,
 *    plus — when `settingsService.shouldShowInstancedObjects()` AND
 *    `diagramBridge.hasClassDiagramData()` — one pre-wired instance
 *    card per class from the sibling ClassDiagram
 *    (`composeNormalObjectPreview`).
 *  - **icon view** (`showIconView` on): instance cards only — the
 *    generic "Object" card is suppressed (`composeIconObjectPreview`).
 *
 * Each instance card mirrors the v3 seed exactly: instance name
 * `${className[0].toLowerCase()}${className.slice(1)}_1`, `classId` /
 * `className` / `icon` lifted from the class, and one attribute row per
 * class attribute (including inherited ones — `getAvailableClasses()`
 * folds the inheritance chain) pre-filled with the attribute's default
 * value.
 *
 * This module is consumed lazily by the palette registry in
 * `constants.ts` (`registerDynamicPaletteProvider`) so the entry list
 * recomputes from live `diagramBridge` / `settingsService` state on
 * every sidebar render — restoring the *original* meaning of the
 * "Show Instanced Objects" setting (a palette toggle, not a canvas
 * toggle). All `@/constants` access happens inside the function bodies
 * to stay clear of the constants ↔ components init cycle.
 */
import type { DropElementConfig } from "@/constants"
import { DROPS, LAYOUT } from "@/constants"
import { generateUUID } from "@/utils"
import { diagramBridge, IClassInfo } from "@/services/diagramBridge"
import { settingsService } from "@/services/settingsService"
import { ObjectNameSVG } from "./ObjectNameSVG"

/** v3 instance-name seed: `Dog` → `dog_1`, `PersonRecord` → `personRecord_1`. */
export function defaultInstanceName(className: string): string {
  if (!className) return "object_1"
  return `${className.charAt(0).toLowerCase()}${className.slice(1)}_1`
}

/**
 * Build the per-class instance palette entry. Attribute rows reuse the
 * structured v4 shape (`name` + `value`), so the canvas formatter
 * renders the v3 wire form `name = value` without baking the `=` into
 * the stored name. Row ids are regenerated on drop by
 * `DraggableGhost`, so the ids generated here only seed the preview.
 */
function buildInstanceEntry(classInfo: IClassInfo): DropElementConfig {
  const attributes = classInfo.attributes.map((attr) => {
    const def =
      attr.defaultValue !== undefined && attr.defaultValue !== null
        ? String(attr.defaultValue)
        : ""
    return {
      id: generateUUID(),
      name: attr.name,
      attributeType: attr.type || "str",
      attributeId: attr.id,
      ...(def !== "" && { value: def }),
    }
  })

  const iconViewActive =
    settingsService.shouldShowIconView() &&
    typeof classInfo.icon === "string" &&
    classInfo.icon.trim() !== ""

  // Icon view collapses the rows into a glyph slot (header + ~60px);
  // normal view stacks header + one row per attribute.
  const height = iconViewActive
    ? LAYOUT.DEFAULT_HEADER_HEIGHT + 60
    : LAYOUT.DEFAULT_HEADER_HEIGHT +
      attributes.length * LAYOUT.DEFAULT_ATTRIBUTE_HEIGHT

  return {
    type: "objectName",
    width: DROPS.DEFAULT_ELEMENT_WIDTH,
    height,
    defaultData: {
      name: defaultInstanceName(classInfo.name),
      classId: classInfo.id,
      className: classInfo.name,
      ...(classInfo.icon ? { icon: classInfo.icon } : {}),
      attributes,
      methods: [],
    },
    svg: ObjectNameSVG,
  }
}

/** The generic, unlinked "Object" card (v3 first preview element). */
function buildGenericObjectEntry(): DropElementConfig {
  return {
    type: "objectName",
    width: DROPS.DEFAULT_ELEMENT_WIDTH,
    height:
      LAYOUT.DEFAULT_HEADER_HEIGHT + LAYOUT.DEFAULT_ATTRIBUTE_HEIGHT,
    defaultData: {
      name: "Object",
      attributes: [
        { id: generateUUID(), name: "attribute", value: "value" },
      ],
      methods: [],
    },
    svg: ObjectNameSVG,
  }
}

/**
 * Compose the full ObjectDiagram palette from live settings + bridge
 * state. Called on every access of
 * `dropElementConfigs[UMLDiagramType.ObjectDiagram]`.
 */
export function getObjectDiagramPaletteEntries(): DropElementConfig[] {
  const entries: DropElementConfig[] = []

  // v3 `composeIconObjectPreview` renders instances only; the generic
  // card exists in normal view only.
  if (!settingsService.shouldShowIconView()) {
    entries.push(buildGenericObjectEntry())
  }

  const shouldShowInstances =
    settingsService.shouldShowInstancedObjects() &&
    diagramBridge.hasClassDiagramData()

  if (shouldShowInstances) {
    for (const classInfo of diagramBridge.getAvailableClasses()) {
      entries.push(buildInstanceEntry(classInfo))
    }
  }

  return entries
}
