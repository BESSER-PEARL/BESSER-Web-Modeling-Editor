import { describe, it, expect, vi } from "vitest"
import React from "react"
import { act, fireEvent, render, screen, within } from "@testing-library/react"
import {
  agentDiagramLinkerContext,
  elementPickerContext,
  lineageContext,
  type AgentDiagramLinker,
  type ElementPickerProvider,
  type LineageProvider,
} from "@/components/hostProviders/contexts"
import { HostProviderSlot, type HostProviderContext } from "@/components/hostProviders/hostProvider"
import { log } from "@/logger"
import {
  AgentDiagramLinkSection,
  ElementPickerField,
  LineageSourceLink,
  PresetField,
} from "@/components/inspectors/shared"

/** Mounts `ui` under a host-provider slot, as BesserEditor does. */
function withSlot<T>(context: HostProviderContext<T>, value: T, ui: React.ReactElement) {
  const slot = new HostProviderSlot<T>(context)
  slot.set(value)
  return { slot, ...render(slot.wrap(ui)) }
}

describe("LineageSourceLink", () => {
  const provider = (resolved: ReturnType<LineageProvider["resolveSource"]>): LineageProvider => ({
    resolveSource: vi.fn(() => resolved),
    onShowSource: vi.fn(),
  })

  it("renders nothing without a provider", () => {
    const { container } = render(<LineageSourceLink elementId="e1" />)
    expect(container).toBeEmptyDOMElement()
  })

  it("renders nothing when the element has no source", () => {
    const { container } = withSlot(lineageContext, provider(null), <LineageSourceLink elementId="e1" />)
    expect(container).toBeEmptyDOMElement()
  })

  it("links to the source element and reports clicks to the host", () => {
    const resolved = {
      sourceElementId: "lane-1",
      sourceDiagramTitle: "Process",
      sourceDiagramType: "BPMNDiagram",
      sourceElementName: "  Reviewer ",
      sourceElementType: "BPMNSwimlane",
    }
    const lineage = provider(resolved)
    withSlot(lineageContext, lineage, <LineageSourceLink elementId="c1" />)
    expect(lineage.resolveSource).toHaveBeenCalledWith("c1")
    expect(screen.getByText("Lineage")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "← Source: Reviewer (BPMNSwimlane)" }))
    expect(lineage.onShowSource).toHaveBeenCalledWith(resolved)
  })

  it("falls back to diagram-level wording and (unnamed)", () => {
    withSlot(
      lineageContext,
      provider({ sourceElementId: "x", sourceDiagramTitle: "Process", sourceDiagramType: "BPMNDiagram" }),
      <LineageSourceLink elementId="c1" />
    )
    expect(screen.getByRole("button", { name: "← Derived from Process (BPMNDiagram)" })).toBeInTheDocument()
  })

  it("follows a provider set after mount", () => {
    const slot = new HostProviderSlot<LineageProvider>(lineageContext)
    const { container } = render(slot.wrap(<LineageSourceLink elementId="c1" />))
    expect(container).toBeEmptyDOMElement()
    act(() =>
      slot.set(
        provider({
          sourceElementId: "x",
          sourceDiagramTitle: "P",
          sourceDiagramType: "BPMNDiagram",
          sourceElementName: "",
          sourceElementType: "BPMNTask",
        })
      )
    )
    expect(screen.getByRole("button", { name: "← Source: (unnamed) (BPMNTask)" })).toBeInTheDocument()
  })
})

describe("AgentDiagramLinkSection", () => {
  const linker = (alive: boolean, create: AgentDiagramLinker["createForLane"] = vi.fn(async () => "d1")) => ({
    isRefAlive: vi.fn(() => alive),
    createForLane: vi.fn(create),
    openByRef: vi.fn(),
  })

  it("renders nothing without a linker", () => {
    const { container } = render(<AgentDiagramLinkSection laneId="l1" laneName="Lane" />)
    expect(container).toBeEmptyDOMElement()
  })

  it("opens a live ref", () => {
    const l = linker(true)
    withSlot(agentDiagramLinkerContext, l, <AgentDiagramLinkSection laneId="l1" laneName="Lane" agentDiagramRef="r1" />)
    expect(l.isRefAlive).toHaveBeenCalledWith("r1")
    fireEvent.click(screen.getByRole("button", { name: "Open agent behavior" }))
    expect(l.openByRef).toHaveBeenCalledWith("r1")
    expect(screen.queryByRole("button", { name: "Define agent behavior" })).toBeNull()
  })

  it("defines a diagram for a dangling ref, once while pending", async () => {
    let resolve!: (id: string | null) => void
    const l = linker(false, () => new Promise((r) => (resolve = r)))
    withSlot(agentDiagramLinkerContext, l, <AgentDiagramLinkSection laneId="l1" laneName="Reviewer" agentDiagramRef="gone" />)
    const button = screen.getByRole("button", { name: "Define agent behavior" })
    fireEvent.click(button)
    fireEvent.click(button)
    expect(l.createForLane).toHaveBeenCalledTimes(1)
    expect(l.createForLane).toHaveBeenCalledWith("Reviewer", "l1")
    expect(button).toBeDisabled()
    await act(async () => resolve("d1"))
    expect(button).not.toBeDisabled()
  })

  it("suggests the default title for an unnamed lane and survives a host failure", async () => {
    const error = vi.spyOn(log, "error").mockImplementation(() => {})
    const l = linker(false, async () => {
      throw new Error("boom")
    })
    withSlot(agentDiagramLinkerContext, l, <AgentDiagramLinkSection laneId="l1" laneName="" />)
    const button = screen.getByRole("button", { name: "Define agent behavior" })
    await act(async () => fireEvent.click(button))
    expect(l.createForLane).toHaveBeenCalledWith("Agent", "l1")
    expect(error).toHaveBeenCalled()
    expect(button).not.toBeDisabled()
    error.mockRestore()
  })
})

describe("ElementPickerField", () => {
  const picker: ElementPickerProvider = {
    listElements: vi.fn(() => [
      { id: "c1", name: "Order", diagramTitle: "Shop" },
      { id: "c2", name: " ", diagramTitle: "Shop" },
    ]),
  }

  it("renders nothing without a provider", () => {
    const { container } = render(
      <ElementPickerField label="Realizes" selected={[]} typeTokens={["Class"]} onChange={vi.fn()} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it("adds an unselected candidate", () => {
    const onChange = vi.fn()
    withSlot(
      elementPickerContext,
      picker,
      <ElementPickerField label="Realizes" selected={["c1"]} typeTokens={["Class"]} onChange={onChange} />
    )
    expect(picker.listElements).toHaveBeenCalledWith(["Class"])
    fireEvent.mouseDown(screen.getByRole("combobox"))
    const listbox = screen.getByRole("listbox")
    // Selected ids are not offered again; blank names read (unnamed).
    expect(within(listbox).queryByText("Order — Shop")).toBeNull()
    fireEvent.click(within(listbox).getByText("(unnamed) — Shop"))
    expect(onChange).toHaveBeenCalledWith(["c1", "c2"])
  })

  it("shows a chip per selected id and removes it", () => {
    const onChange = vi.fn()
    withSlot(
      elementPickerContext,
      picker,
      <ElementPickerField label="Realizes" selected={["c1", "gone"]} typeTokens={["Class"]} onChange={onChange} />
    )
    expect(screen.getByText("Order — Shop")).toBeInTheDocument()
    expect(screen.getByText("gone (missing)")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Remove Order — Shop" }))
    expect(onChange).toHaveBeenCalledWith(["gone"])
  })

  it("disables the menu once every candidate is selected", () => {
    withSlot(
      elementPickerContext,
      picker,
      <ElementPickerField label="Realizes" selected={["c1", "c2"]} typeTokens={["Class"]} onChange={vi.fn()} />
    )
    expect(screen.getByRole("combobox")).toHaveAttribute("aria-disabled", "true")
  })
})

describe("PresetField", () => {
  it("writes typed text", () => {
    const onChange = vi.fn()
    render(<PresetField label="Stereotype" value="" onChange={onChange} presets={["solution"]} />)
    fireEvent.change(screen.getByLabelText("Stereotype"), { target: { value: "skill, tool" } })
    expect(onChange).toHaveBeenCalledWith("skill, tool")
  })

  it("writes a picked preset value, marking the current one", () => {
    const onChange = vi.fn()
    render(
      <PresetField
        label="Agent role"
        value="supervision"
        onChange={onChange}
        presets={[
          { value: "solution", label: "Solution" },
          { value: "supervision", label: "Supervision" },
        ]}
      />
    )
    const trigger = screen.getByRole("button", { name: "Preset" })
    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute("aria-expanded", "true")
    const menu = screen.getByRole("menu")
    expect(within(menu).getByRole("menuitem", { name: "Supervision" })).toHaveClass("Mui-selected")
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Solution" }))
    expect(onChange).toHaveBeenCalledWith("solution")
  })
})
