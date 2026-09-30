import { useCallback, useContext } from "react"
import { useDiagramStore } from "@/store"
import { DiagramStoreContext } from "@/store/context"
import { Edge, Connection } from "@xyflow/react"
import { defaultFlagAfterSourceChange } from "@/utils/bpmnDefaultFlow"

export const useReconnect = () => {
  const setEdges = useDiagramStore((state) => state.setEdges)
  // Read nodes at reconnect time (no subscription: every edge mounts this hook).
  const diagramStore = useContext(DiagramStoreContext)
  const onReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      const data: Record<string, unknown> = {
        ...oldEdge.data,
        points: [],
      }
      // BPMN: a default sequence flow dragged onto a source that cannot carry
      // a default (a parallel gateway, an event, ...) loses the flag — port of
      // the old editor's RECONNECT saga (bpmn-flow-default-saga.ts).
      if (data.isDefault) {
        const newSource = diagramStore
          ?.getState()
          .nodes.find((n) => n.id === newConnection.source)
        if (!defaultFlagAfterSourceChange(oldEdge, newSource)) {
          data.isDefault = false
        }
      }
      const updatedEdge = {
        ...oldEdge,
        source: newConnection.source,
        target: newConnection.target,
        sourceHandle: newConnection.sourceHandle || oldEdge.sourceHandle,
        targetHandle: newConnection.targetHandle || oldEdge.targetHandle,
        data,
      }

      setEdges((edges) =>
        edges.map((edge) => (edge.id === oldEdge.id ? updatedEdge : edge))
      )
    },
    [diagramStore, setEdges]
  )
  return onReconnect
}
