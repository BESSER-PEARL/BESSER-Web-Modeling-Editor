import { afterEach, describe, expect, it } from "vitest"
import { act, cleanup, render } from "@testing-library/react"
import * as Y from "yjs"
import { ReactFlowProvider, type Connection, type Node } from "@xyflow/react"
import type { StoreApi } from "zustand"
import {
  AssessmentSelectionStoreContext,
  DiagramStoreContext,
  MetadataStoreContext,
  PopoverStoreContext,
} from "@/store/context"
import { createAssessmentSelectionStore } from "@/store/assessmentSelectionStore"
import { createDiagramStore, DiagramStore } from "@/store/diagramStore"
import { createMetadataStore } from "@/store/metadataStore"
import { createPopoverStore } from "@/store/popoverStore"
import { useConnect } from "@/hooks/useConnect"
import { UMLDiagramType } from "@/types"

/**
 * Live: Component -> Interface (and Deployment Component -> Interface)
 * defaulted to a Dependency / Association, which the backend rejects, so
 * quality check, B-UML export and generation failed. Develop picks the type
 * both ends support: the provided interface.
 */

afterEach(cleanup)

const node = (id: string, type: string, x: number): Node => ({
  id,
  type,
  position: { x, y: 0 },
  width: 120,
  height: 80,
  measured: { width: 120, height: 80 },
  data: { name: id },
})

const connectIn = (diagramType: UMLDiagramType, nodes: Node[], source: string, target: string) => {
  const ydoc = new Y.Doc()
  const metadata = createMetadataStore(ydoc)
  const diagram = createDiagramStore(ydoc)
  metadata.getState().updateDiagramType(diagramType)
  act(() => diagram.getState().setNodes(nodes))
  let onConnect: ((c: Connection) => void) | undefined
  const Host = () => {
    onConnect = useConnect().onConnect
    return null
  }
  render(
    <DiagramStoreContext.Provider value={diagram as StoreApi<DiagramStore>}>
      <MetadataStoreContext.Provider value={metadata}>
        <PopoverStoreContext.Provider value={createPopoverStore()}>
          <AssessmentSelectionStoreContext.Provider value={createAssessmentSelectionStore()}>
            <ReactFlowProvider>
              <Host />
            </ReactFlowProvider>
          </AssessmentSelectionStoreContext.Provider>
        </PopoverStoreContext.Provider>
      </MetadataStoreContext.Provider>
    </DiagramStoreContext.Provider>
  )
  act(() => onConnect!({ source, target, sourceHandle: "right", targetHandle: "left" }))
  return diagram.getState().edges.map((e) => e.type)
}

describe("default edge type of a new connection", () => {
  const component = [node("c", "component", 0), node("i", "componentInterface", 300), node("d", "component", 600)]
  const deployment = [
    node("c", "deploymentComponent", 0),
    node("i", "deploymentInterface", 300),
    node("n", "deploymentNode", 600),
    node("a", "deploymentArtifact", 900),
  ]

  it.each([
    ["component -> interface", UMLDiagramType.ComponentDiagram, component, "c", "i", "ComponentProvidedInterface"],
    ["interface -> component", UMLDiagramType.ComponentDiagram, component, "i", "c", "ComponentProvidedInterface"],
    ["component -> component", UMLDiagramType.ComponentDiagram, component, "c", "d", "ComponentDependency"],
    ["deployment component -> interface", UMLDiagramType.DeploymentDiagram, deployment, "c", "i", "DeploymentProvidedInterface"],
    ["deployment node -> interface", UMLDiagramType.DeploymentDiagram, deployment, "n", "i", "DeploymentProvidedInterface"],
    ["artifact -> interface", UMLDiagramType.DeploymentDiagram, deployment, "a", "i", "DeploymentProvidedInterface"],
    ["deployment component -> node", UMLDiagramType.DeploymentDiagram, deployment, "c", "n", "DeploymentAssociation"],
  ] as const)("%s", (_label, diagramType, nodes, source, target, expected) => {
    expect(connectIn(diagramType, [...nodes], source, target)).toEqual([expected])
  })
})
