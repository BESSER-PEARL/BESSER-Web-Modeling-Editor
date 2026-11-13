import { describe, it, expect } from "vitest"
import { act, render, screen } from "@testing-library/react"
import * as Y from "yjs"
import { ReactFlowProvider, type Edge, type Node } from "@xyflow/react"
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
import { Sidebar } from "@/components/Sidebar"
import { resolvePaletteDefaultData } from "@/components/DraggableGhost"
import { UseCaseEdgeEditPopover } from "@/components/popovers/edgePopovers/UseCaseDiagramEdgeEditPopover"
import { dropElementConfigs } from "@/constants"
import { UMLDiagramType } from "@/types"
import { Locale } from "@/typings"

/**
 * Representative library components render their chrome in the editor's
 * locale (metadata store) and follow a live locale switch.
 */

const nodes: Node[] = [
  { id: "actor", type: "useCaseActor", position: { x: 0, y: 0 }, data: { name: "Kunde" } },
  { id: "uc", type: "useCase", position: { x: 200, y: 0 }, data: { name: "Bestellen" } },
]
const edges: Edge[] = [
  {
    id: "e1",
    type: "UseCaseAssociation",
    source: "actor",
    target: "uc",
    data: { label: "" },
  },
]

const renderWithLocale = (ui: React.ReactElement, locale: Locale) => {
  const ydoc = new Y.Doc()
  const metadata = createMetadataStore(ydoc)
  const diagram = createDiagramStore(ydoc)
  const popover = createPopoverStore()
  metadata.getState().setLocale(locale)
  const utils = render(
    <DiagramStoreContext.Provider value={diagram as StoreApi<DiagramStore>}>
      <MetadataStoreContext.Provider value={metadata}>
        <PopoverStoreContext.Provider value={popover}>
          <AssessmentSelectionStoreContext.Provider
            value={createAssessmentSelectionStore()}
          >
            <ReactFlowProvider initialNodes={nodes} initialEdges={edges}>
              {ui}
            </ReactFlowProvider>
          </AssessmentSelectionStoreContext.Provider>
        </PopoverStoreContext.Provider>
      </MetadataStoreContext.Provider>
    </DiagramStoreContext.Provider>
  )
  return { metadata, diagram, ...utils }
}

describe("edge inspector labels", () => {
  it("renders the use-case edge popover in German and switches live", () => {
    const { metadata, diagram } = renderWithLocale(
      <UseCaseEdgeEditPopover elementId="e1" />,
      Locale.de
    )
    expect(screen.getAllByText("Verbindungstyp").length).toBeGreaterThan(0)
    expect(screen.getByLabelText("Verbindungsbeschriftung")).toBeInTheDocument()
    expect(screen.queryByText("Edge Type")).toBeNull()

    const edgesBefore = diagram.getState().edges
    act(() => metadata.getState().setLocale(Locale.fr))
    expect(screen.getAllByText("Type de connexion").length).toBeGreaterThan(0)
    // Locale is chrome only: the diagram store is untouched.
    expect(diagram.getState().edges).toBe(edgesBefore)
  })

  it("stays English by default", () => {
    renderWithLocale(<UseCaseEdgeEditPopover elementId="e1" />, Locale.en)
    expect(screen.getAllByText("Edge Type").length).toBeGreaterThan(0)
  })
})

describe("palette", () => {
  const bpmnTask = dropElementConfigs[UMLDiagramType.BPMN].find(
    (c) => c.type === "bpmnTask"
  )!

  it("translates BPMN default names at creation (old-editor parity)", () => {
    expect(resolvePaletteDefaultData(bpmnTask, Locale.de)?.name).toBe(
      "Aufgabe"
    )
    expect(resolvePaletteDefaultData(bpmnTask, Locale.en)?.name).toBe("Task")
  })

  it("keeps English default names for diagrams the old editor did not translate", () => {
    const classEntry = dropElementConfigs[UMLDiagramType.ClassDiagram][0]
    expect(resolvePaletteDefaultData(classEntry, Locale.de)).toBe(
      classEntry.defaultData
    )
  })

  it("shows the translated BPMN task name in the German sidebar preview", () => {
    const { metadata } = renderWithLocale(<Sidebar />, Locale.de)
    act(() =>
      metadata.getState().updateDiagramType(UMLDiagramType.BPMN)
    )
    expect(screen.getAllByText("Aufgabe").length).toBeGreaterThan(0)
    act(() => metadata.getState().setLocale(Locale.en))
    expect(screen.getAllByText("Task").length).toBeGreaterThan(0)
  })
})
