import { Assessment } from "@/typings"
import { deepEqual } from "@/utils/storeUtils"
import { Node, Edge } from "@xyflow/react"
import * as Y from "yjs"

// Utility functions that accept a Y.Doc instance
export const getNodesMap = (ydoc: Y.Doc) => ydoc.getMap<Node>("nodes")
export const getEdgesMap = (ydoc: Y.Doc) => ydoc.getMap<Edge>("edges")
export const getAssessments = (ydoc: Y.Doc) =>
  ydoc.getMap<Assessment>("assessments")
export const getDiagramMetadata = (ydoc: Y.Doc) =>
  ydoc.getMap<string>("diagramMetadata")

// Reconcile a Y.Map against the desired entries via a targeted diff: delete
// keys no longer present, and set only keys whose value actually changed.
// This replaces `clear()` + set-all, which produces ~2N ops and N tombstones
// per call and pins intermediate structs in the UndoManager (unbounded doc
// growth over long sessions -> editor freeze).
export const reconcileYMap = <T>(
  map: Y.Map<T>,
  nextEntries: Iterable<readonly [string, T]>
): void => {
  const next = new Map<string, T>(
    Array.from(nextEntries, ([id, value]) => [id, value])
  )

  for (const key of Array.from(map.keys())) {
    if (!next.has(key)) {
      map.delete(key)
    }
  }

  for (const [key, value] of next) {
    if (!map.has(key) || !deepEqual(map.get(key), value)) {
      map.set(key, value)
    }
  }
}
