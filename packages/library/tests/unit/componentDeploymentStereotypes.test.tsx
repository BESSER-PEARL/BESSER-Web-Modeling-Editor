import { afterEach, describe, expect, it, vi } from "vitest"
import React from "react"
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import * as Y from "yjs"
import { Position, ReactFlowProvider, type Edge, type Node } from "@xyflow/react"
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
import {
  elementPickerContext,
  lineageContext,
  type ElementPickerProvider,
  type LineageProvider,
} from "@/components/hostProviders/contexts"
import { ComponentNodeSVG, ComponentSubsystemNodeSVG } from "@/components/svgs/nodes/componentDiagram"
import { DeploymentComponentSVG } from "@/components/svgs/nodes/deploymentDiagram"
import { ComponentEditPopover, ComponentSubsystemEditPopover } from "@/components/popovers/componentDiagram"
import { DeploymentComponentEditPopover, DeploymentNodeEditPopover } from "@/components/popovers/deploymentDiagram"
import { ComponentEdgeEditPopover } from "@/components/popovers/edgePopovers/ComponentDiagramEdgeEditPopover"
import { DeploymentEdgeEditPopover } from "@/components/popovers/edgePopovers/DeploymentDiagramEdgeEditPopover"
import { ComponentDiagramEdge } from "@/edges/edgeTypes/ComponentDiagramEdge"
import { DeploymentDiagramEdge } from "@/edges/edgeTypes/DeploymentDiagramEdge"

/**
 * Develop's Component / Deployment stereotype features on the React Flow
 * engine: «stereotype» from data (develop defaults `component` / `subsystem`
 * when the key is absent, never written), the bot icon for agent categories,
 * the stereotype / realizes / lineage inspector fields, and the «stereotype»
 * labels of ComponentDependency and DeploymentAssociation edges.
 */

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const mount = (ui: React.ReactElement, nodes: Node[] = [], edges: Edge[] = []) => {
  const ydoc = new Y.Doc()
  const diagram = createDiagramStore(ydoc)
  act(() => {
    diagram.getState().setNodes(nodes)
    diagram.getState().setEdges(edges)
  })
  const utils = render(
    <DiagramStoreContext.Provider value={diagram as StoreApi<DiagramStore>}>
      <MetadataStoreContext.Provider value={createMetadataStore(ydoc)}>
        <PopoverStoreContext.Provider value={createPopoverStore()}>
          <AssessmentSelectionStoreContext.Provider value={createAssessmentSelectionStore()}>
            <ReactFlowProvider initialNodes={nodes} initialEdges={edges}>
              {ui}
            </ReactFlowProvider>
          </AssessmentSelectionStoreContext.Provider>
        </PopoverStoreContext.Provider>
      </MetadataStoreContext.Provider>
    </DiagramStoreContext.Provider>
  )
  return { diagram, ...utils }
}

const svgTexts = (container: HTMLElement) =>
  [...container.querySelectorAll("text, tspan")].map((t) => t.textContent)

const botIcon = (container: HTMLElement) => container.querySelector('[data-testid="agentic-bot-icon"]')

describe("component / deployment node rendering", () => {
  const renderSvg = (ui: React.ReactElement) => mount(<svg>{ui}</svg>).container

  it("shows develop's default «component» when the stereotype key is absent", () => {
    const c = renderSvg(
      <ComponentNodeSVG id="c" width={180} height={120} data={{ name: "Coder", isComponentHeaderShown: true }} />
    )
    expect(svgTexts(c)).toContain("«component»")
    expect(botIcon(c)).toBeNull()
  })

  it("renders the stored stereotype and the bot icon for an agent category", () => {
    const c = renderSvg(
      <ComponentNodeSVG
        id="c"
        width={180}
        height={120}
        data={{ name: "Coder", isComponentHeaderShown: true, stereotype: "solution, local" }}
      />
    )
    expect(svgTexts(c)).toContain("«solution, local»")
    expect(svgTexts(c)).not.toContain("«component»")
    expect(botIcon(c)).not.toBeNull()
  })

  it("a capability stereotype gets no bot icon; an empty one hides the header", () => {
    const skill = renderSvg(
      <ComponentNodeSVG id="c" width={180} height={120} data={{ name: "S", isComponentHeaderShown: true, stereotype: "skill" }} />
    )
    expect(svgTexts(skill)).toContain("«skill»")
    expect(botIcon(skill)).toBeNull()
    cleanup()
    const empty = renderSvg(
      <ComponentNodeSVG id="c" width={180} height={120} data={{ name: "S", isComponentHeaderShown: true, stereotype: "" }} />
    )
    expect(svgTexts(empty).some((t) => t?.startsWith("«"))).toBe(false)
  })

  it("subsystems default to «subsystem» and render a custom stereotype", () => {
    const def = renderSvg(
      <ComponentSubsystemNodeSVG id="s" width={180} height={120} data={{ name: "Core", isComponentSubsystemHeaderShown: true }} />
    )
    expect(svgTexts(def)).toContain("«subsystem»")
    cleanup()
    const custom = renderSvg(
      <ComponentSubsystemNodeSVG
        id="s"
        width={180}
        height={120}
        data={{ name: "Core", isComponentSubsystemHeaderShown: true, stereotype: "supervision" }}
      />
    )
    expect(svgTexts(custom)).toContain("«supervision»")
  })

  it("deployment components share the component rendering (default, bot icon)", () => {
    const def = renderSvg(
      <DeploymentComponentSVG id="d" width={160} height={100} data={{ name: "API", isComponentHeaderShown: true }} />
    )
    expect(svgTexts(def)).toContain("«component»")
    cleanup()
    const agent = renderSvg(
      <DeploymentComponentSVG
        id="d"
        width={160}
        height={100}
        data={{ name: "Planner", isComponentHeaderShown: true, stereotype: "supervision" }}
      />
    )
    expect(svgTexts(agent)).toContain("«supervision»")
    expect(botIcon(agent)).not.toBeNull()
  })
})

const componentNode = (data: Record<string, unknown> = {}): Node => ({
  id: "c1",
  type: "component",
  position: { x: 0, y: 0 },
  width: 180,
  height: 120,
  data: { name: "Coder", isComponentHeaderShown: true, ...data },
})

const nodeData = (store: StoreApi<DiagramStore>, id = "c1") =>
  store.getState().nodes.find((n) => n.id === id)!.data as Record<string, unknown>

const withProviders = (
  ui: React.ReactElement,
  picker?: ElementPickerProvider,
  lineage?: LineageProvider
) => {
  let wrapped = ui
  if (picker) {
    const slot = new HostProviderSlot<ElementPickerProvider>(elementPickerContext)
    slot.set(picker)
    wrapped = slot.wrap(wrapped)
  }
  if (lineage) {
    const slot = new HostProviderSlot<LineageProvider>(lineageContext)
    slot.set(lineage)
    wrapped = slot.wrap(wrapped)
  }
  return wrapped
}

describe("component inspector", () => {
  it("shows the default stereotype without writing it, and writes what the user types", () => {
    const { diagram } = mount(<ComponentEditPopover elementId="c1" />, [componentNode()])
    const field = screen.getByLabelText("Stereotype") as HTMLInputElement
    expect(field.value).toBe("component")
    expect("stereotype" in nodeData(diagram)).toBe(false)

    fireEvent.change(field, { target: { value: "solution" } })
    expect(nodeData(diagram).stereotype).toBe("solution")
    expect(field.placeholder).toBe("e.g. solution, skill, external")
  })

  it("offers develop's stereotype presets", () => {
    const { diagram } = mount(<ComponentEditPopover elementId="c1" />, [componentNode()])
    fireEvent.click(screen.getByRole("button", { name: "Preset" }))
    const menu = screen.getByRole("menu")
    expect(within(menu).getAllByRole("menuitem").map((i) => i.textContent)).toEqual([
      "solution",
      "supervision",
      "skill",
      "tool",
      "llm",
      "db",
      "rag",
      "local",
      "external",
      "hybrid",
    ])
    fireEvent.click(within(menu).getByText("supervision"))
    expect(nodeData(diagram).stereotype).toBe("supervision")
  })

  it("edits realizes through the host element picker and shows the lineage link", () => {
    const picker: ElementPickerProvider = {
      listElements: vi.fn(() => [
        { id: "cls-1", name: "Issue", diagramTitle: "Domain" },
        { id: "cls-2", name: "Patch", diagramTitle: "Domain" },
      ]),
    }
    const lineage: LineageProvider = {
      resolveSource: vi.fn(() => ({
        sourceElementId: "lane-1",
        sourceDiagramTitle: "Process",
        sourceDiagramType: "BPMNDiagram",
        sourceElementName: "Coder",
        sourceElementType: "BPMNSwimlane",
      })),
      onShowSource: vi.fn(),
    }
    const { diagram } = mount(
      withProviders(<ComponentEditPopover elementId="c1" />, picker, lineage),
      [componentNode({ realizes: ["cls-1"] })]
    )
    expect(picker.listElements).toHaveBeenCalledWith(["Class", "AbstractClass", "Interface", "Enumeration"])
    expect(screen.getByText("Issue — Domain")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Remove Issue — Domain" }))
    expect(nodeData(diagram).realizes).toEqual([])
    expect(screen.getByRole("button", { name: "← Source: Coder (BPMNSwimlane)" })).toBeInTheDocument()
  })

  it("subsystem: stereotype field with develop's default and placeholder", () => {
    const subsystem: Node = {
      id: "s1",
      type: "componentSubsystem",
      position: { x: 0, y: 0 },
      width: 180,
      height: 120,
      data: { name: "Core", isComponentSubsystemHeaderShown: true },
    }
    const { diagram } = mount(<ComponentSubsystemEditPopover elementId="s1" />, [subsystem])
    const field = screen.getByLabelText("Stereotype") as HTMLInputElement
    expect(field.value).toBe("subsystem")
    fireEvent.change(field, { target: { value: "" } })
    expect(nodeData(diagram, "s1").stereotype).toBe("")
    expect(field.placeholder).toBe("e.g. subsystem, solution")
  })
})

describe("deployment inspectors", () => {
  it("deployment component: stereotype presets, no realizes picker", () => {
    const picker: ElementPickerProvider = { listElements: vi.fn(() => []) }
    const node: Node = { ...componentNode(), id: "d1", type: "deploymentComponent" }
    const { diagram } = mount(withProviders(<DeploymentComponentEditPopover elementId="d1" />, picker), [node])
    expect((screen.getByLabelText("Stereotype") as HTMLInputElement).value).toBe("component")
    expect(screen.queryByTestId("element-picker-field")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Preset" }))
    fireEvent.click(within(screen.getByRole("menu")).getByText("external"))
    expect(nodeData(diagram, "d1").stereotype).toBe("external")
  })

  it("deployment node: labelled stereotype field with develop's placeholder", () => {
    const node: Node = {
      id: "n1",
      type: "deploymentNode",
      position: { x: 0, y: 0 },
      width: 160,
      height: 100,
      data: { name: "Host", isComponentHeaderShown: true, stereotype: "node" },
    }
    const { diagram } = mount(<DeploymentNodeEditPopover elementId="n1" />, [node])
    const field = screen.getByLabelText("Stereotype") as HTMLInputElement
    expect(field.value).toBe("node")
    expect(field.placeholder).toBe("e.g. node, device, executionEnvironment")
    fireEvent.change(field, { target: { value: "docker host" } })
    expect(nodeData(diagram, "n1").stereotype).toBe("docker host")
  })
})

const box = (id: string, x: number, type: string): Node => ({
  id,
  type,
  position: { x, y: 0 },
  width: 160,
  height: 80,
  measured: { width: 160, height: 80 },
  data: { name: id },
})

const edgeData = (store: StoreApi<DiagramStore>) =>
  store.getState().edges[0].data as Record<string, unknown>

describe("edge inspectors", () => {
  it("ComponentDependency: stereotype field with the agentic edge presets", () => {
    const edge: Edge = { id: "e1", type: "ComponentDependency", source: "a", target: "b", data: {} }
    const { diagram } = mount(
      <ComponentEdgeEditPopover elementId="e1" />,
      [box("a", 0, "component"), box("b", 400, "component")],
      [edge]
    )
    const field = screen.getByLabelText("Stereotype") as HTMLInputElement
    expect(field.placeholder).toBe("e.g. delegates, has, uses")
    fireEvent.click(screen.getByRole("button", { name: "Preset" }))
    expect(within(screen.getByRole("menu")).getAllByRole("menuitem")).toHaveLength(8)
    fireEvent.click(within(screen.getByRole("menu")).getByText("delegates"))
    expect(edgeData(diagram).stereotype).toBe("delegates")
  })

  it("interface edges have no stereotype field", () => {
    const edge: Edge = { id: "e1", type: "ComponentProvidedInterface", source: "a", target: "b", data: {} }
    mount(<ComponentEdgeEditPopover elementId="e1" />, [box("a", 0, "component"), box("b", 400, "componentInterface")], [
      edge,
    ])
    expect(screen.queryByLabelText("Stereotype")).toBeNull()
  })

  it("DeploymentAssociation: label and stereotype fields with develop's captions", () => {
    const edge: Edge = { id: "e1", type: "DeploymentAssociation", source: "a", target: "b", data: { label: "" } }
    const { diagram } = mount(
      <DeploymentEdgeEditPopover elementId="e1" />,
      [box("a", 0, "deploymentArtifact"), box("b", 400, "deploymentNode")],
      [edge]
    )
    expect((screen.getByLabelText("Label") as HTMLInputElement).placeholder).toBe("e.g. kv-store-conn")
    const field = screen.getByLabelText("Stereotype") as HTMLInputElement
    expect(field.placeholder).toBe("e.g. HTTPS, gRPC, device")
    fireEvent.change(field, { target: { value: "HTTPS" } })
    expect(edgeData(diagram).stereotype).toBe("HTTPS")
  })

  it("DeploymentDependency: no label or stereotype field", () => {
    const edge: Edge = { id: "e1", type: "DeploymentDependency", source: "a", target: "b", data: {} }
    mount(<DeploymentEdgeEditPopover elementId="e1" />, [box("a", 0, "deploymentNode"), box("b", 400, "deploymentNode")], [
      edge,
    ])
    expect(screen.queryByLabelText("Stereotype")).toBeNull()
    expect(screen.queryByLabelText("Label")).toBeNull()
  })
})

const edgeProps = (id: string, type: string, data: Record<string, unknown>) =>
  ({
    id,
    type,
    source: "a",
    target: "b",
    sourceX: 160,
    sourceY: 40,
    targetX: 400,
    targetY: 40,
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    sourceHandleId: "right",
    targetHandleId: "left",
    data,
  }) as React.ComponentProps<typeof ComponentDiagramEdge>

const stereotypeLabel = (container: HTMLElement) =>
  container.querySelector<SVGTextElement>('[data-testid="edge-stereotype-label"]')

describe("edge «stereotype» labels", () => {
  const nodes = [box("a", 0, "component"), box("b", 400, "component")]
  const points = [
    { x: 160, y: 40 },
    { x: 400, y: 40 },
  ]

  it("ComponentDependency draws «stereotype» above its horizontal midpoint", () => {
    const data = { stereotype: "delegates", points }
    const { container } = mount(
      <svg>
        <ComponentDiagramEdge {...edgeProps("e1", "ComponentDependency", data)} />
      </svg>,
      nodes,
      [{ id: "e1", type: "ComponentDependency", source: "a", target: "b", sourceHandle: "right", targetHandle: "left", data }]
    )
    const label = stereotypeLabel(container)!
    expect(label.textContent).toBe("«delegates»")
    expect(label.getAttribute("text-anchor")).toBe("middle")
    expect(label.getAttribute("pointer-events")).toBe("none")
  })

  it("a stereotype left on a non-dependency component edge is not drawn", () => {
    const data = { stereotype: "delegates", points }
    const { container } = mount(
      <svg>
        <ComponentDiagramEdge {...edgeProps("e1", "ComponentProvidedInterface", data)} />
      </svg>,
      nodes,
      [{ id: "e1", type: "ComponentProvidedInterface", source: "a", target: "b", data }]
    )
    expect(stereotypeLabel(container)).toBeNull()
  })

  it("DeploymentAssociation draws «stereotype» one line above its name", () => {
    const data = { stereotype: "HTTPS", label: "kv-store-conn", points }
    const dNodes = [box("a", 0, "deploymentNode"), box("b", 400, "deploymentNode")]
    const { container } = mount(
      <svg>
        <DeploymentDiagramEdge {...edgeProps("e1", "DeploymentAssociation", data)} />
      </svg>,
      dNodes,
      [{ id: "e1", type: "DeploymentAssociation", source: "a", target: "b", sourceHandle: "right", targetHandle: "left", data }]
    )
    const label = stereotypeLabel(container)!
    const name = container.querySelector<SVGTextElement>('[data-testid="edge-middle-label"]')!
    expect(label.textContent).toBe("«HTTPS»")
    expect(name.textContent).toBe("kv-store-conn")
    expect(label.getAttribute("x")).toBe(name.getAttribute("x"))
    expect(Number(name.getAttribute("y")) - Number(label.getAttribute("y"))).toBe(14)
  })

  it("a stereotype left on a DeploymentDependency is not drawn", () => {
    const data = { stereotype: "HTTPS", points }
    const { container } = mount(
      <svg>
        <DeploymentDiagramEdge {...edgeProps("e1", "DeploymentDependency", data)} />
      </svg>,
      [box("a", 0, "deploymentNode"), box("b", 400, "deploymentNode")],
      [{ id: "e1", type: "DeploymentDependency", source: "a", target: "b", data }]
    )
    expect(stereotypeLabel(container)).toBeNull()
  })
})
