import { create } from "zustand"
import { devtools } from "zustand/middleware"

/**
 * Transient association-class linking state.
 *
 * Drives the click-to-pick authoring flow for `ClassLinkRel`: the user
 * presses "Attach association class" on an association's midpoint
 * toolbar (`startLinking(edgeId)`), then clicks the class node that
 * should become the association class — `App.tsx` completes the link
 * and calls `cancelLinking()`. Escape / pane click also cancel.
 *
 * Plain module-level zustand (same pattern as `settingsStore`) — this
 * is ephemeral UI interaction state, deliberately NOT Yjs-backed and
 * not part of `diagramStore`. The completion handler re-validates the
 * pending edge id against the active diagram's edges, so a stale id
 * can never create a dangling link.
 */
export type EdgeLinkingStore = {
  /** Association edge waiting for its class pick, or `null` when idle. */
  pendingAssociationEdgeId: string | null
  startLinking: (edgeId: string) => void
  cancelLinking: () => void
}

export const useEdgeLinkingStore = create<EdgeLinkingStore>()(
  devtools(
    (set) => ({
      pendingAssociationEdgeId: null,
      startLinking: (edgeId: string) =>
        set(
          { pendingAssociationEdgeId: edgeId },
          undefined,
          "edgeLinking/start"
        ),
      cancelLinking: () =>
        set(
          { pendingAssociationEdgeId: null },
          undefined,
          "edgeLinking/cancel"
        ),
    }),
    { name: "EdgeLinkingStore", enabled: true }
  )
)
