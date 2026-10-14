import { afterEach, describe, it, expect } from "vitest"
import { act, render, renderHook, waitFor } from "@testing-library/react"
import * as Y from "yjs"
import { ReactFlowProvider, type Node } from "@xyflow/react"
import type { StoreApi } from "zustand"
import { EditorState } from "@codemirror/state"
import { ensureSyntaxTree } from "@codemirror/language"
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
import { StateFinalNode } from "@/nodes/stateMachineDiagram/StateFinalNode"
import { StateCodeBlock } from "@/nodes/stateMachineDiagram/StateCodeBlock"
import { StateFinalNodeSVG } from "@/components/svgs/nodes/stateMachineDiagram/StateMachineSVGs"
import {
  balLanguage,
  useCodeMirrorTheme,
} from "@/components/inspectors/_shared/codeEditor"

/**
 * State machine review fixes (2026-10-06): the Final node is a ring (not a
 * white disc identical to Initial in dark mode), BAL code blocks are
 * labelled and highlighted as BAL, the code-block header is a tinted band
 * in the app font, and CodeMirror follows the app theme.
 */

const renderNode = (ui: React.ReactElement, node: Node) => {
  const ydoc = new Y.Doc()
  const diagram = createDiagramStore(ydoc)
  diagram.getState().setNodes([node])
  return render(
    <DiagramStoreContext.Provider value={diagram as StoreApi<DiagramStore>}>
      <MetadataStoreContext.Provider value={createMetadataStore(ydoc)}>
        <PopoverStoreContext.Provider value={createPopoverStore()}>
          <AssessmentSelectionStoreContext.Provider
            value={createAssessmentSelectionStore()}
          >
            <ReactFlowProvider>{ui}</ReactFlowProvider>
          </AssessmentSelectionStoreContext.Provider>
        </PopoverStoreContext.Provider>
      </MetadataStoreContext.Provider>
    </DiagramStoreContext.Provider>
  )
}

afterEach(() => document.documentElement.removeAttribute("data-theme"))

describe("Final state marker", () => {
  // The canvas node already took its fill from the theme; this guards it.
  it("the ring gap uses the canvas background, not white", () => {
    const { container } = renderNode(
      <StateFinalNode
        {...({ id: "f", width: 30, height: 30, data: {} } as never)}
      />,
      { id: "f", type: "StateFinalNode", position: { x: 0, y: 0 }, data: {} }
    )
    const [outer] = Array.from(container.querySelectorAll("circle"))
    expect(outer.getAttribute("fill")).toContain("--besser-background")
  })

  it("the palette preview's ring is theme-aware too", () => {
    const { container } = render(<StateFinalNodeSVG width={30} height={30} />)
    const [outer] = Array.from(container.querySelectorAll("circle"))
    expect(outer.getAttribute("fill")).toContain("--besser-background")
  })
})

describe("Code block header", () => {
  const block = (language: string) => {
    const data = { name: "code", code: "x", language }
    return renderNode(
      <StateCodeBlock
        {...({ id: "c", width: 200, height: 120, data } as never)}
      />,
      { id: "c", type: "StateCodeBlock", position: { x: 0, y: 0 }, data }
    )
  }

  it("labels a BAL block 'BAL'", () => {
    const { container } = block("bal")
    expect(container.querySelector("svg text")!.textContent).toBe("BAL")
  })

  it("is a tinted band in the inherited font, with themed text", () => {
    const { container } = block("python")
    const header = container.querySelectorAll("svg rect")[1]
    expect(header.getAttribute("fill-opacity")).toBe("0.12")
    const label = container.querySelector("svg text")!
    expect(label.textContent).toBe("Python")
    expect(label.getAttribute("font-family")).toBeNull()
    expect(label.getAttribute("fill")).not.toContain("--besser-background")
  })
})

describe("CodeMirror theme + BAL language", () => {
  it("follows <html data-theme>", async () => {
    const { result } = renderHook(() => useCodeMirrorTheme())
    expect(result.current).toBe("light")
    act(() => document.documentElement.setAttribute("data-theme", "dark"))
    await waitFor(() => expect(result.current).toBe("dark"))
  })

  it("tokenizes BAL keywords, types and // comments", () => {
    const doc = "def inc() -> int {\n  // bump\n  return this.count + 1;\n}"
    const state = EditorState.create({ doc, extensions: [balLanguage] })
    const tree = ensureSyntaxTree(state, doc.length, 5000)!
    const tokens: string[] = []
    tree.iterate({
      enter: (n) => {
        if (n.from < n.to && n.name !== "Document") {
          tokens.push(`${n.name}:${doc.slice(n.from, n.to)}`)
        }
      },
    })
    expect(tokens).toContain("keyword:def")
    expect(tokens).toContain("typeName:int")
    expect(tokens).toContain("comment:// bump")
    expect(tokens).toContain("keyword:return")
    expect(tokens).toContain("number:1")
  })
})
