/**
 * Description and URI, editable on develop through `DefaultPopup`,
 * `UMLComponentUpdate` and the NN container popup, survive the v3 -> v4
 * conversion and are editable again.
 */
import { afterEach, describe, expect, it } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import * as Y from "yjs"
import type { Node } from "@xyflow/react"
import type { StoreApi } from "zustand"
import { DiagramStoreContext } from "@/store/context"
import { createDiagramStore, DiagramStore } from "@/store/diagramStore"
import { DefaultNodeEditPopover } from "@/components/popovers/DefaultNodeEditPopover"
import { NNContainerEditPanel } from "@/components/inspectors/nnDiagram/NNContainerEditPanel"
import { hasDescriptionAndUri } from "@/utils/nodeUtils"
import { convertV3ToV4 } from "@/utils/versionConverter"
import type { V3UMLModel } from "@/utils/v3Typings"

afterEach(cleanup)

const v3Model = (type: string, elementType: string) =>
  ({
    version: "3.0.0",
    type,
    size: { width: 800, height: 600 },
    elements: {
      e1: {
        id: "e1",
        name: "Billing",
        type: elementType,
        owner: null,
        bounds: { x: 0, y: 0, width: 200, height: 100 },
        description: "Handles invoices",
        uri: "https://example.com/billing",
      },
    },
    relationships: {},
    interactive: { elements: {}, relationships: {} },
    assessments: {},
  }) as unknown as V3UMLModel

const open = (ui: React.ReactElement, type: string, data: Record<string, unknown> = {}) => {
  const store = createDiagramStore(new Y.Doc()) as StoreApi<DiagramStore>
  const node: Node = {
    id: "n",
    type,
    position: { x: 0, y: 0 },
    width: 200,
    height: 100,
    data: { name: "Billing", ...data },
  }
  store.getState().setNodes([node])
  render(<DiagramStoreContext.Provider value={store}>{ui}</DiagramStoreContext.Provider>)
  return () => store.getState().nodes[0].data as Record<string, unknown>
}

describe("v3 -> v4 conversion", () => {
  it.each([
    ["ComponentDiagram", "Component"],
    ["ComponentDiagram", "ComponentInterface"],
    ["DeploymentDiagram", "DeploymentComponent"],
    ["DeploymentDiagram", "DeploymentArtifact"],
    ["BPMN", "BPMNDataStore"],
    ["BPMN", "BPMNAnnotation"],
    ["NNDiagram", "NNContainer"],
  ])("%s %s keeps its description and URI", (diagramType, elementType) => {
    const v4 = convertV3ToV4(v3Model(diagramType, elementType))
    expect(v4.nodes[0].data).toMatchObject({
      name: "Billing",
      description: "Handles invoices",
      uri: "https://example.com/billing",
    })
  })
})

describe("editing", () => {
  it.each(["component", "deploymentArtifact", "bpmnDataObject", "bpmnGroup"])(
    "%s shows and stores description and URI",
    (type) => {
      const data = open(<DefaultNodeEditPopover elementId="n" />, type, {
        description: "Handles invoices",
      })
      const description = screen.getByLabelText("Description") as HTMLTextAreaElement
      expect(description.value).toBe("Handles invoices")
      fireEvent.change(description, { target: { value: "Sends invoices" } })
      fireEvent.change(screen.getByLabelText("URI"), {
        target: { value: "https://example.com/b" },
      })
      expect(data()).toMatchObject({
        description: "Sends invoices",
        uri: "https://example.com/b",
      })
    }
  )

  it("types without them on develop get no such fields", () => {
    for (const type of ["componentSubsystem", "deploymentNode", "flowchartProcess"]) {
      expect(hasDescriptionAndUri(type)).toBe(false)
    }
    open(<DefaultNodeEditPopover elementId="n" />, "deploymentNode")
    expect(screen.queryByLabelText("URI")).toBeNull()
  })

  it("the NN container panel edits both", () => {
    const data = open(<NNContainerEditPanel elementId="n" />, "NNContainer", {
      uri: "https://example.com/net",
    })
    expect((screen.getByLabelText("URI") as HTMLInputElement).value).toBe(
      "https://example.com/net"
    )
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Encoder" },
    })
    expect(data()).toMatchObject({ description: "Encoder" })
  })
})
