import { afterEach, describe, expect, it, vi } from "vitest"
import React from "react"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
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
import { HostProviderSlot } from "@/components/hostProviders/hostProvider"
import { lineageContext, type LineageProvider } from "@/components/hostProviders/contexts"
import { CommentConfig, dropElementConfigs } from "@/constants"
import { Locale } from "@/typings"
import { UMLDiagramType } from "@/types"
import { DiagramNodeTypeRecord } from "@/nodes/types"
import { ComponentSubsystemNodeSVG } from "@/components/svgs/nodes/componentDiagram"
import { BPMNSwimlaneNodeSVG } from "@/components/svgs/nodes/bpmnDiagram/BPMNSwimlaneNodeSVG"
import { ObjectNameSVG } from "@/components/svgs/nodes/objectDiagram"
import { AgentStateSVG } from "@/components/svgs/nodes/agentDiagram"
import { ComponentEdgeEditPopover } from "@/components/popovers/edgePopovers/ComponentDiagramEdgeEditPopover"
import { DeploymentEdgeEditPopover } from "@/components/popovers/edgePopovers/DeploymentDiagramEdgeEditPopover"
import { ComponentEditPopover } from "@/components/popovers/componentDiagram"
import { DefaultNodeEditPopover } from "@/components/popovers/DefaultNodeEditPopover"
import { BPMNTaskEditPopover } from "@/components/popovers/bpmnDiagram/BPMNTaskEditPopover"
import { BPMNSwimlaneEditPopover } from "@/components/popovers/bpmnDiagram/BPMNSwimlaneEditPopover"
import { BPMNGatewayEditPopover } from "@/components/popovers/bpmnDiagram/BPMNGatewayEditPopover"
import { HeaderSwitchElement } from "@/components/ui/HeaderSwitchElement"
import { NodeStyleEditor } from "@/components/ui/StyleEditor/NodeStyleEditor"
import { resolvePaletteDefaultData } from "@/components/DraggableGhost"
import { getTypeLabel } from "@/components/propertiesPanel/typeLabel"
import { clampIntoLaneBody } from "@/utils/bpmnConstraints"
import { parseTrustScore } from "@/types/bpmnAgentic"
import { settingsService } from "@/services/settingsService"

/**
 * Inspector, node-renderer and data rules from the final fix wave, each
 * matching develop: default «component» / «subsystem» written at creation,
 * the subsystem header line, required-interface edge types, agentic values
 * restored within a session, the agentic lane gap, clamped trust / copies,
 * readable type headers, the lineage link on the default popover,
 * single-line names, translated palette labels and the icon view.
 */

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  settingsService.updateSetting("showIconView", false)
})

const mount = (
  ui: React.ReactElement,
  { nodes = [], edges = [], locale = Locale.en, agenticEnabled = false }: {
    nodes?: Node[]
    edges?: Edge[]
    locale?: Locale
    agenticEnabled?: boolean
  } = {}
) => {
  const ydoc = new Y.Doc()
  const diagram = createDiagramStore(ydoc)
  const metadata = createMetadataStore(ydoc)
  act(() => {
    diagram.getState().setNodes(nodes)
    diagram.getState().setEdges(edges)
    diagram.getState().initializeUndoManager()
    metadata.getState().setLocale(locale)
    metadata.getState().setAgenticEnabled(agenticEnabled)
  })
  const utils = render(
    <DiagramStoreContext.Provider value={diagram as StoreApi<DiagramStore>}>
      <MetadataStoreContext.Provider value={metadata}>
        <PopoverStoreContext.Provider value={createPopoverStore()}>
          <AssessmentSelectionStoreContext.Provider value={createAssessmentSelectionStore()}>
            {/* No initial RF nodes: inspectors then read the diagram store live. */}
            <ReactFlowProvider>{ui}</ReactFlowProvider>
          </AssessmentSelectionStoreContext.Provider>
        </PopoverStoreContext.Provider>
      </MetadataStoreContext.Provider>
    </DiagramStoreContext.Provider>
  )
  const data = (id: string) =>
    diagram.getState().nodes.find((n) => n.id === id)!.data as Record<string, unknown>
  return { diagram, data, ...utils }
}

const box = (id: string, type: string, data: Record<string, unknown> = {}, x = 0): Node => ({
  id,
  type,
  position: { x, y: 0 },
  width: 160,
  height: 80,
  measured: { width: 160, height: 80 },
  data: { name: id, ...data },
})

/** y of the SVG text (or tspan) whose content is exactly `text`. */
const textY = (container: HTMLElement, text: string) => {
  const el = [...container.querySelectorAll("text, tspan")].find(
    (t) => t.textContent === text && t.getAttribute("y") !== null
  )
  return Number(el?.getAttribute("y"))
}

describe("A4 default stereotype written at creation", () => {
  const paletteData = (diagramType: UMLDiagramType, type: string) =>
    dropElementConfigs[diagramType].find((c) => c.type === type)!.defaultData

  it("component, subsystem and deployment component palette entries carry develop's default", () => {
    expect(paletteData(UMLDiagramType.ComponentDiagram, "component")).toMatchObject({
      stereotype: "component",
    })
    expect(paletteData(UMLDiagramType.ComponentDiagram, "componentSubsystem")).toMatchObject({
      stereotype: "subsystem",
    })
    expect(paletteData(UMLDiagramType.DeploymentDiagram, "deploymentComponent")).toMatchObject({
      stereotype: "component",
    })
  })
})

describe("A5 subsystem header", () => {
  it("sits on develop's header line (stereotype ~17, name ~35) above the children", () => {
    const { container } = mount(
      <svg>
        <ComponentSubsystemNodeSVG
          id="s"
          width={450}
          height={280}
          data={{ name: "Project Repository", isComponentSubsystemHeaderShown: true }}
        />
      </svg>
    )
    expect(textY(container, "«subsystem»")).toBeLessThanOrEqual(18)
    expect(textY(container, "Project Repository")).toBeLessThanOrEqual(36)
  })
})

describe("A6 quarter / three-quarter required-interface edges", () => {
  it.each([
    ["ComponentRequiredQuarterInterface", ComponentEdgeEditPopover, "component", "componentInterface"],
    ["ComponentRequiredThreeQuarterInterface", ComponentEdgeEditPopover, "component", "componentInterface"],
    ["DeploymentRequiredQuarterInterface", DeploymentEdgeEditPopover, "deploymentComponent", "deploymentInterface"],
    ["DeploymentRequiredThreeQuarterInterface", DeploymentEdgeEditPopover, "deploymentComponent", "deploymentInterface"],
  ] as const)("%s shows Required Interface as its edge type", (type, Popover, src, tgt) => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const edge: Edge = { id: "e1", type, source: "a", target: "b", data: {} }
    mount(<Popover elementId="e1" />, {
      nodes: [box("a", src), box("b", tgt, {}, 400)],
      edges: [edge],
    })
    expect(screen.getByRole("combobox")).toHaveTextContent("Required Interface")
    expect(warn.mock.calls.flat().join(" ")).not.toMatch(/out-of-range value/)
  })
})

const pool: Node = { ...box("pool", "bpmnPool"), width: 600, height: 240 }
const lane = (data: Record<string, unknown> = {}): Node => ({
  ...box("lane", "bpmnSwimlane", data, 40),
  parentId: "pool",
  width: 560,
  height: 120,
})
const task = (data: Record<string, unknown> = {}): Node => ({
  ...box("task", "bpmnTask", data, 80),
  parentId: "lane",
})
const gateway = (data: Record<string, unknown> = {}): Node => ({
  ...box("gw", "bpmnGateway", { gatewayType: "parallel", ...data }, 300),
  parentId: "lane",
})
const toggleAgentic = () => fireEvent.click(screen.getByLabelText("Agentic"))

describe("A7 agentic off -> on restores the previous values within the session", () => {
  it("task: reflection, reviewer and trust come back; the plain JSON has none", () => {
    const values = { reflectionMode: "cross", reflectionReviewerLaneId: "lane2", trustScore: 70 }
    const { data } = mount(<BPMNTaskEditPopover elementId="task" />, {
      nodes: [pool, lane({ isAgentic: true }), task({ isAgentic: true, ...values })],
      agenticEnabled: true,
    })
    toggleAgentic()
    for (const key of ["isAgentic", ...Object.keys(values)]) expect(data("task")).not.toHaveProperty(key)
    toggleAgentic()
    expect(data("task")).toMatchObject({ isAgentic: true, ...values })
  })

  it("lane: role, trust and copies come back", () => {
    const values = { role: "supervision", trustScore: 55, multiplicity: 3 }
    const { data } = mount(<BPMNSwimlaneEditPopover elementId="lane" />, {
      nodes: [pool, lane({ isAgentic: true, ...values })],
      agenticEnabled: true,
    })
    toggleAgentic()
    for (const key of ["isAgentic", ...Object.keys(values)]) expect(data("lane")).not.toHaveProperty(key)
    toggleAgentic()
    expect(data("lane")).toMatchObject({ isAgentic: true, ...values })
  })

  it("gateway: role, trust and governance DSL come back", () => {
    const values = { gatewayRole: "merging", trustScore: 40, governanceDsl: "Scope s { }" }
    const { data } = mount(<BPMNGatewayEditPopover elementId="gw" />, {
      nodes: [pool, lane(), gateway({ isAgentic: true, ...values })],
      agenticEnabled: true,
    })
    toggleAgentic()
    for (const key of ["isAgentic", ...Object.keys(values)]) expect(data("gw")).not.toHaveProperty(key)
    toggleAgentic()
    expect(data("gw")).toMatchObject({ isAgentic: true, ...values })
  })

  it("undo of the switch-off still restores the stored values", () => {
    const { diagram, data } = mount(<BPMNSwimlaneEditPopover elementId="lane" />, {
      nodes: [pool, lane({ isAgentic: true, role: "solution", trustScore: 12, multiplicity: 2 })],
      agenticEnabled: true,
    })
    toggleAgentic()
    expect(diagram.getState().undoManager!.undoStack).toHaveLength(1)
    act(() => {
      diagram.getState().undo()
      diagram.getState().updateNodesFromYjs()
    })
    expect(data("lane")).toMatchObject({ isAgentic: true, trustScore: 12, multiplicity: 2 })
    act(() => {
      diagram.getState().redo()
      diagram.getState().updateNodesFromYjs()
    })
    expect(data("lane")).not.toHaveProperty("trustScore")
    toggleAgentic()
    expect(data("lane")).toMatchObject({ isAgentic: true, trustScore: 12, multiplicity: 2 })
  })

  it("a negative trust entry clamps to 0", () => {
    expect(parseTrustScore("-5")).toBe(0)
    expect(parseTrustScore("150")).toBe(100)
  })
})

describe("A8 agentic lane header gap", () => {
  it("children of an agentic lane keep clear of its 60 px header", () => {
    const agentic = { type: "bpmnSwimlane", data: { isAgentic: true } }
    expect(clampIntoLaneBody({ x: 35, y: 10 }, agentic)).toEqual({ x: 60, y: 10 })
    expect(clampIntoLaneBody({ x: 35, y: 10 }, { type: "bpmnSwimlane", data: {} })).toEqual({ x: 35, y: 10 })
    expect(clampIntoLaneBody({ x: 10, y: 10 }, "bpmnSwimlane")).toEqual({ x: 30, y: 10 })
  })
})

describe("A9 out-of-range trust score / copies from an imported JSON", () => {
  it("the lane draws them clamped", () => {
    const { container } = mount(
      <svg>
        <BPMNSwimlaneNodeSVG
          id="l"
          width={560}
          height={120}
          data={{ name: "Coder", isAgentic: true, role: "solution", trustScore: 150, multiplicity: 0 } as never}
        />
      </svg>
    )
    expect(container.textContent).toContain("100")
    expect(container.textContent).not.toContain("150")
    expect(container.textContent).not.toContain("×")
  })

  it("the inspectors show them clamped", () => {
    mount(<BPMNSwimlaneEditPopover elementId="lane" />, {
      nodes: [pool, lane({ isAgentic: true, role: "solution", trustScore: 150, multiplicity: -2 })],
      agenticEnabled: true,
    })
    expect((screen.getByLabelText("Trust score (0-100)") as HTMLInputElement).value).toBe("100")
    expect((screen.getByLabelText("Copies (≥1)") as HTMLInputElement).value).toBe("1")
    cleanup()
    mount(<BPMNTaskEditPopover elementId="task" />, {
      nodes: [pool, lane(), task({ isAgentic: true, trustScore: -5 })],
      agenticEnabled: true,
    })
    expect((screen.getByLabelText("Trust score (0-100)") as HTMLInputElement).value).toBe("0")
  })
})

describe("A10 element-type header", () => {
  it("names subsystems and data stores like the palette", () => {
    expect(getTypeLabel("componentSubsystem", "ComponentDiagram", Locale.en)).toBe("Subsystem")
    expect(getTypeLabel("bpmnDataStore", "BPMNDiagram", Locale.en)).toBe("Data Store")
    expect(getTypeLabel("bpmnDataStore", "BPMNDiagram", Locale.de)).toBe("Datenspeicher")
  })

  it("never leads with a lowercase word or a bpmn prefix for any node type", () => {
    const bad = Object.keys(DiagramNodeTypeRecord)
      .map((type) => [type, getTypeLabel(type, undefined, Locale.en)] as const)
      .filter(([, label]) => /^[a-z]/.test(label) || /^bpmn/i.test(label))
    expect(bad).toEqual([])
  })
})

describe("A13 lineage link on the default popover", () => {
  const lineage: LineageProvider = {
    resolveSource: () => ({
      sourceElementId: "lane-1",
      sourceDiagramTitle: "Process",
      sourceDiagramType: "BPMNDiagram",
      sourceElementName: "Coder",
      sourceElementType: "BPMNSwimlane",
    }),
    onShowSource: vi.fn(),
  }
  const withLineage = (ui: React.ReactElement) => {
    const slot = new HostProviderSlot<LineageProvider>(lineageContext)
    slot.set(lineage)
    return slot.wrap(ui)
  }

  it("a derived artifact shows its source", () => {
    mount(withLineage(<DefaultNodeEditPopover elementId="art" />), {
      nodes: [box("art", "deploymentArtifact")],
    })
    expect(screen.getByRole("button", { name: "← Source: Coder (BPMNSwimlane)" })).toBeInTheDocument()
  })

  it("popovers built on it show the link once", () => {
    mount(withLineage(<ComponentEditPopover elementId="c1" />), {
      nodes: [box("c1", "component", { isComponentHeaderShown: true })],
    })
    expect(screen.getAllByTestId("lineage-source-link")).toHaveLength(1)
  })
})

describe("A14 names are single-line", () => {
  it("Enter commits instead of inserting a line break; pasted breaks become spaces", () => {
    const update = vi.fn()
    render(
      <NodeStyleEditor nodeData={{ name: "Planner" }} handleDataFieldUpdate={update} isMultilineName />
    )
    const field = screen.getByLabelText("Enter node name")
    field.focus()
    const notPrevented = fireEvent.keyDown(field, { key: "Enter" })
    expect(notPrevented).toBe(false)
    expect(document.activeElement).not.toBe(field)
    fireEvent.change(field, { target: { value: "Planner\nAgent" } })
    expect(update).toHaveBeenLastCalledWith("name", "Planner Agent")
  })
})

describe("A18 translated labels and the stereotype toggle", () => {
  it("the agent palette state card is translated", () => {
    mount(<AgentStateSVG id="s" width={200} height={120} data={{ name: "AgentState" }} />, { locale: Locale.de })
    expect(screen.getByText("Zustand")).toBeInTheDocument()
  })

  it("the palette comment is named in the editor language", () => {
    expect(resolvePaletteDefaultData(CommentConfig, Locale.de)?.name).toBe("Kommentar")
    expect(resolvePaletteDefaultData(CommentConfig, Locale.en)?.name).toBe("Comment")
  })

  it("the «» header toggle is a labelled toggle button", () => {
    const onClick = vi.fn()
    mount(<HeaderSwitchElement onClick={onClick} isComponentHeaderShown />)
    const button = screen.getByRole("button", { name: "Show stereotype" })
    expect(button).toHaveAttribute("aria-pressed", "true")
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})

describe("A19 object icon view", () => {
  it("hides attribute rows even when the object has no icon (develop)", () => {
    settingsService.updateSetting("showIconView", true)
    const { container } = mount(
      <svg>
        <ObjectNameSVG
          id="o"
          width={200}
          height={100}
          data={{ name: "book1", attributes: [{ id: "a", name: "title", value: "Dune" }], methods: [] } as never}
        />
      </svg>
    )
    expect(container.textContent).toContain("book1")
    expect(container.textContent).not.toContain("title")
  })
})
