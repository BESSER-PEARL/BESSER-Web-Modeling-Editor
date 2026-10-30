import { v4 as uuidv4 } from "uuid"
import type { BesserEdge, BesserNode, UMLModel } from "@/typings"
import type { ClassOCLConstraint } from "@/types"

const BOX = { width: 180, height: 90, gapX: 60, gapY: 20 }

/**
 * Lift OCL rows collapsed onto a class (`data.oclConstraints`, written by the
 * v3 -> v4 migrator) into the canonical v4 shape: one `ClassOCLConstraint`
 * node per row, linked to its class by a `ClassOCLLink` edge. That is the
 * shape the editor renders and edits and the backend emits; the backend
 * reads both, so generation is unchanged, but the rows become visible.
 * Returns the model by reference when no class carries rows.
 */
export function liftClassOCLConstraintRows(model: UMLModel): UMLModel {
  if (!model.nodes.some((n) => hasRows(n))) return model

  const usedIds = new Set<string>([
    ...model.nodes.map((n) => n.id),
    ...model.edges.map((e) => e.id),
  ])
  const freshId = (preferred?: string) => {
    const id = preferred && !usedIds.has(preferred) ? preferred : uuidv4()
    usedIds.add(id)
    return id
  }

  const nodes: BesserNode[] = []
  const edges: BesserEdge[] = [...model.edges]
  for (const node of model.nodes) {
    if (!hasRows(node)) {
      nodes.push(node)
      continue
    }
    const { oclConstraints, ...data } = node.data as {
      oclConstraints: ClassOCLConstraint[]
    } & Record<string, unknown>
    nodes.push({ ...node, data } as BesserNode)

    const classWidth = node.width ?? node.measured?.width ?? 160
    oclConstraints.forEach((row, index) => {
      const { id: rowId, ...rowData } = row
      const boxId = freshId(rowId)
      nodes.push({
        id: boxId,
        type: "ClassOCLConstraint",
        ...(node.parentId && { parentId: node.parentId }),
        position: {
          x: node.position.x + classWidth + BOX.gapX,
          y: node.position.y + index * (BOX.height + BOX.gapY),
        },
        width: BOX.width,
        height: BOX.height,
        measured: { width: BOX.width, height: BOX.height },
        data: { ...rowData, expression: row.expression ?? "" },
      } as BesserNode)
      edges.push({
        id: freshId(),
        type: "ClassOCLLink",
        source: boxId,
        target: node.id,
        sourceHandle: "left",
        targetHandle: "right",
        data: { points: [] },
      } as BesserEdge)
    })
  }
  return { ...model, nodes, edges }
}

const hasRows = (node: BesserNode) => {
  const rows = (node.data as { oclConstraints?: unknown } | undefined)
    ?.oclConstraints
  return Array.isArray(rows) && rows.length > 0
}
