import { afterEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, render } from "@testing-library/react"
import * as Y from "yjs"
import { ReactFlowProvider, type Node } from "@xyflow/react"
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
import { useSelectionForCopyPaste } from "@/hooks/useSelectionForCopyPaste"
import { UMLDiagramType } from "@/types"

type CopyPaste = ReturnType<typeof useSelectionForCopyPaste>

const node = (id: string, type: string, data: Record<string, unknown> = {}): Node => ({
  id,
  type,
  position: { x: 0, y: 0 },
  width: 160,
  height: 100,
  data: { name: id, ...data },
})

/** Mounts one editor (own stores) of `diagramType` and returns its hook. */
const mountEditor = (diagramType: UMLDiagramType, nodes: Node[]) => {
  const ydoc = new Y.Doc()
  const metadata = createMetadataStore(ydoc)
  const diagram = createDiagramStore(ydoc)
  act(() => {
    metadata.getState().updateDiagramType(diagramType)
    diagram.getState().setNodes(nodes)
  })
  const api: { current?: CopyPaste } = {}
  const Host = () => {
    api.current = useSelectionForCopyPaste()
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
  return { diagram, api: api as { current: CopyPaste } }
}

const select = (diagram: StoreApi<DiagramStore>, ids: string[]) =>
  act(() => diagram.getState().setSelectedElementsId(ids))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("cross-diagram paste", () => {
  // Review finding: a class copied in a class diagram pasted into a state
  // machine as a foreign `class` node.
  it("refuses to paste a class-diagram copy into a state machine", async () => {
    const source = mountEditor(UMLDiagramType.ClassDiagram, [node("Book", "class")])
    select(source.diagram, ["Book"])
    await act(async () => {
      await source.api.current.copySelectedElements()
    })
    const target = mountEditor(UMLDiagramType.StateMachineDiagram, [node("S", "State")])
    let pasted: boolean | undefined
    await act(async () => {
      pasted = await target.api.current.pasteElements(1)
    })
    expect(pasted).toBe(false)
    expect(target.diagram.getState().nodes.map((n) => n.type)).toEqual(["State"])
  })

  it("refuses a foreign payload read from the system clipboard (another tab)", async () => {
    const clip = {
      diagramType: UMLDiagramType.ClassDiagram,
      nodes: [node("Book", "class")],
      edges: [],
    }
    vi.stubGlobal("isSecureContext", true)
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { readText: async () => JSON.stringify(clip), writeText: async () => {} },
    })
    const target = mountEditor(UMLDiagramType.AgentDiagram, [])
    await act(async () => {
      await target.api.current.pasteElements(1)
    })
    expect(target.diagram.getState().nodes).toEqual([])
    Reflect.deleteProperty(navigator, "clipboard")
  })

  it("keeps same-type paste working across editors", async () => {
    const source = mountEditor(UMLDiagramType.ClassDiagram, [node("Book", "class")])
    select(source.diagram, ["Book"])
    await act(async () => {
      await source.api.current.copySelectedElements()
    })
    const target = mountEditor(UMLDiagramType.ClassDiagram, [])
    await act(async () => {
      await target.api.current.pasteElements(1)
    })
    expect(target.diagram.getState().nodes.map((n) => n.type)).toEqual(["class"])
  })
})

describe("initial agent state on paste", () => {
  // Review finding: duplicating the initial AgentState left two states with
  // `data.initial: true`, while the inspector treats the flag as single-select.
  it("clears `initial` on the copy when the diagram already has one", async () => {
    const { diagram, api } = mountEditor(UMLDiagramType.AgentDiagram, [
      node("Start", "AgentState", { initial: true }),
    ])
    select(diagram, ["Start"])
    await act(async () => {
      await api.current.duplicateSelectedElements(1)
    })
    const initials = diagram
      .getState()
      .nodes.filter((n) => (n.data as { initial?: boolean }).initial === true)
    expect(initials.map((n) => n.id)).toEqual(["Start"])
    expect(diagram.getState().nodes).toHaveLength(2)
  })

  it("keeps `initial` when pasting into a diagram without an initial state", async () => {
    const source = mountEditor(UMLDiagramType.AgentDiagram, [
      node("Start", "AgentState", { initial: true }),
    ])
    select(source.diagram, ["Start"])
    await act(async () => {
      await source.api.current.copySelectedElements()
    })
    const target = mountEditor(UMLDiagramType.AgentDiagram, [])
    await act(async () => {
      await target.api.current.pasteElements(1)
    })
    expect((target.diagram.getState().nodes[0].data as { initial?: boolean }).initial).toBe(true)
  })
})
