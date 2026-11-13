/**
 * "Add and connect to new Object" — port of the v3 object-diagram hover
 * action (`components/uml-element/updatable/updatable.tsx` `onAdd` +
 * `components/association-popup/association-popup.tsx`).
 *
 * v3 flow: the user clicks the (+) floating button on an object that is
 * bound to a class (`classId`); the popup lists
 * `diagramBridge.getRelatedClasses(classId)`; picking one clones the
 * matching palette instance card (`palette.find(o => o.classId === id)`),
 * drops it 100px below the source object and connects the two with a new
 * object link (source port Down → target port Up). Available in both the
 * ObjectDiagram and the UserDiagram (v3 `isObjectDiagram` covered both).
 *
 * Pure helpers — the toolbar component (`AddAssociatedObjectButton`) wires
 * them to the stores.
 */
import type { Edge, Node } from "@xyflow/react"
import type { DropElementConfig } from "@/constants"
import { diagramBridge, IClassInfo } from "@/services/diagramBridge"
import { generateUUID } from "@/utils"
import { getDefaultEdgeType, getInitialEdgeData } from "@/utils/edgeUtils"
import { UMLDiagramType } from "@/types"

/** Diagram types that expose the action (v3 `isObjectDiagram`). */
export const ASSOCIATED_OBJECT_DIAGRAM_TYPES: ReadonlySet<string> = new Set([
  UMLDiagramType.ObjectDiagram,
  UMLDiagramType.UserDiagram,
])

/** Node types the action is offered on (the class-bound instance nodes). */
export const ASSOCIATED_OBJECT_NODE_TYPES: ReadonlySet<string> = new Set([
  "objectName",
  "UserModelName",
])

/** v3 gap between the source object and the new one. */
export const ASSOCIATED_OBJECT_VERTICAL_GAP = 100

export interface AssociatedObjectTarget {
  id: string
  name: string
}

const classIdOf = (node: Node | undefined): string | undefined => {
  const classId = (node?.data as { classId?: unknown } | undefined)?.classId
  return typeof classId === "string" && classId ? classId : undefined
}

/**
 * Classes the source object can be connected to (v3
 * `getAvailableTargets`): the related classes of the object's class.
 * Empty when the object is not bound to a class.
 */
export const getAssociatedObjectTargets = (
  sourceNode: Node | undefined
): AssociatedObjectTarget[] => {
  const classId = classIdOf(sourceNode)
  if (!classId) return []
  return diagramBridge
    .getRelatedClasses(classId)
    .map((cls) => ({ id: cls.id, name: cls.name }))
}

const lowerFirstInstanceName = (className: string) =>
  className
    ? `${className.charAt(0).toLowerCase()}${className.slice(1)}_1`
    : "object_1"

/**
 * Fallback instance data when the palette carries no card for the class
 * (e.g. "Show Instanced Objects" is off, so the ObjectDiagram palette has
 * no instance cards). Mirrors the palette instance-card shapes.
 */
const buildInstanceData = (
  nodeType: string,
  classInfo: IClassInfo
): Record<string, unknown> => {
  if (nodeType === "UserModelName") {
    return {
      name: lowerFirstInstanceName(classInfo.name),
      classId: classInfo.id,
      className: classInfo.name,
      attributes: classInfo.attributes.map((attr) => ({
        id: generateUUID(),
        name: attr.name,
        attributeType: attr.type,
        attributeOperator: "==",
      })),
      view: "icon",
    }
  }
  return {
    name: lowerFirstInstanceName(classInfo.name),
    classId: classInfo.id,
    className: classInfo.name,
    ...(classInfo.icon ? { icon: classInfo.icon } : {}),
    attributes: classInfo.attributes.map((attr) => {
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
    }),
    methods: [],
  }
}

const freshRowIds = (data: Record<string, unknown>) => {
  const clone = structuredClone(data)
  for (const key of ["attributes", "methods"]) {
    const rows = clone[key]
    if (Array.isArray(rows)) {
      clone[key] = rows.map((row: object) => ({ ...row, id: generateUUID() }))
    }
  }
  return clone
}

/**
 * Build the new instance node + the connecting link for `targetClassId`.
 * Returns `null` when the source node or the target class cannot be
 * resolved.
 */
export const buildAssociatedObject = ({
  sourceNode,
  targetClassId,
  diagramType,
  paletteEntries,
}: {
  sourceNode: Node
  targetClassId: string
  diagramType: UMLDiagramType
  paletteEntries: ReadonlyArray<DropElementConfig>
}): { node: Node; edge: Edge } | null => {
  const nodeType = sourceNode.type ?? "objectName"
  // v3: clone the palette instance card whose classId matches.
  const paletteEntry = paletteEntries.find(
    (entry) =>
      (entry.type as string) === nodeType &&
      entry.defaultData?.classId === targetClassId
  )

  let data: Record<string, unknown>
  let width: number | undefined
  let height: number | undefined
  if (paletteEntry?.defaultData) {
    data = freshRowIds(paletteEntry.defaultData)
    width = paletteEntry.dropWidth ?? paletteEntry.width
    height = paletteEntry.dropHeight ?? paletteEntry.height
  } else {
    const classInfo = diagramBridge
      .getAvailableClasses()
      .find((cls) => cls.id === targetClassId)
    if (!classInfo) return null
    data = buildInstanceData(nodeType, classInfo)
    width = sourceNode.width ?? sourceNode.measured?.width
    height = sourceNode.height ?? sourceNode.measured?.height
  }

  const sourceHeight =
    sourceNode.height ?? sourceNode.measured?.height ?? height ?? 0
  const id = generateUUID()
  const node: Node = {
    id,
    type: nodeType,
    position: {
      x: sourceNode.position.x,
      y: sourceNode.position.y + sourceHeight + ASSOCIATED_OBJECT_VERTICAL_GAP,
    },
    ...(sourceNode.parentId ? { parentId: sourceNode.parentId } : {}),
    ...(width !== undefined && { width }),
    ...(height !== undefined && { height }),
    ...(width !== undefined &&
      height !== undefined && { measured: { width, height } }),
    data,
    selected: false,
  }

  const edgeType = getDefaultEdgeType(diagramType)
  const initialData = getInitialEdgeData(edgeType)
  const edge: Edge = {
    id: generateUUID(),
    source: sourceNode.id,
    target: id,
    // v3: source port Direction.Down → target port Direction.Up.
    sourceHandle: "bottom",
    targetHandle: "top",
    type: edgeType,
    selected: false,
    ...(initialData ? { data: initialData } : {}),
  }

  return { node, edge }
}
