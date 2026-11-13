import { afterEach, describe, expect, it } from "vitest"
import { act } from "@testing-library/react"
import { readdirSync, readFileSync, statSync } from "fs"
import { join, relative, resolve } from "path"
import { BesserEditor } from "@/besser-editor"
import { UMLDiagramType } from "@/types"
import type { UMLModel } from "@/typings"

/**
 * React Flow drops an edge whose `sourceHandle` / `targetHandle` id is not
 * rendered on its node (error #008). Live: a stored `left-bottom` gateway
 * edge (agentic_starter, bug_fixing) and corner-handle interface edges after
 * a component-diagram migration were missing from the canvas and exports.
 */

const TEMPLATES = resolve(__dirname, "../../../webapp/src/main/templates/pattern")

const jsonFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return jsonFiles(path)
    return name.endsWith(".json") ? [path] : []
  })

const templateModels = (): Array<[string, UMLModel]> => {
  const out: Array<[string, UMLModel]> = []
  for (const file of jsonFiles(TEMPLATES)) {
    const label = relative(TEMPLATES, file).replace(/\\/g, "/")
    if (label.startsWith("gui/")) continue // GrapesJS, not a UML model
    const json = JSON.parse(readFileSync(file, "utf8"))
    if (json?.project) {
      for (const [bucket, list] of Object.entries(json.project.diagrams ?? {})) {
        ;(list as Array<{ model?: UMLModel }>).forEach((d, i) => {
          if (Array.isArray(d.model?.edges) && d.model.edges.length) {
            out.push([`${label} ${bucket}[${i}]`, d.model])
          }
        })
      }
    } else if (Array.isArray(json?.edges)) {
      out.push([label, json])
    }
  }
  return out
}

let editor: BesserEditor | null = null
afterEach(() => {
  act(() => editor?.destroy())
  editor = null
  document.body.innerHTML = ""
})

const mount = async (model: UMLModel) => {
  const el = document.createElement("div")
  document.body.appendChild(el)
  act(() => {
    editor = new BesserEditor(el, { type: model.type as UMLDiagramType, model })
  })
  await act(async () => {
    await new Promise((r) => setTimeout(r, 50))
  })
  return el
}

/** Edge ends whose node renders no handle React Flow can resolve them to. */
const unresolvedEnds = (el: HTMLElement, model: UMLModel): string[] => {
  const missing: string[] = []
  const handles = (nodeId: string, kind: "source" | "target") => {
    const node = el.querySelector(`.react-flow__node[data-id="${nodeId}"]`)
    // Loose connection mode: a target end resolves against both handle types.
    const selector = kind === "source" ? ".react-flow__handle.source" : ".react-flow__handle"
    return node ? [...node.querySelectorAll(selector)] : []
  }
  for (const edge of model.edges) {
    for (const [kind, nodeId, handleId] of [
      ["source", edge.source, edge.sourceHandle],
      ["target", edge.target, edge.targetHandle],
    ] as const) {
      const found = handles(nodeId, kind)
      const ok = handleId
        ? found.some((h) => h.getAttribute("data-handleid") === handleId)
        : found.length > 0
      if (!ok) missing.push(`${edge.id} ${kind} ${nodeId}:${handleId ?? "(none)"}`)
    }
  }
  return missing
}

describe("every edge of every bundled template resolves its handles", () => {
  const models = templateModels()

  it("finds the templates", () => {
    expect(models.length).toBeGreaterThan(15)
  })

  it.each(models)("%s", async (_label, model) => {
    const el = await mount(model)
    expect(unresolvedEnds(el, model)).toEqual([])
  })
})

describe("corner handle ids on nodes that render only four sides", () => {
  const corners = ["top-left", "right-bottom", "bottom-left", "left-bottom", "left-top"]

  const cases: Array<[string, UMLDiagramType, UMLModel["nodes"][number]]> = [
    [
      "componentInterface",
      UMLDiagramType.ComponentDiagram,
      { id: "n", type: "componentInterface", position: { x: 0, y: 0 }, width: 20, height: 20, data: { name: "I" } },
    ],
    [
      "deploymentInterface",
      UMLDiagramType.DeploymentDiagram,
      { id: "n", type: "deploymentInterface", position: { x: 0, y: 0 }, width: 20, height: 20, data: { name: "I" } },
    ],
    [
      "bpmnGateway",
      UMLDiagramType.BPMN,
      { id: "n", type: "bpmnGateway", position: { x: 0, y: 0 }, width: 40, height: 40, data: { name: "G", gatewayType: "exclusive" } },
    ],
  ] as never

  it.each(cases)("%s", async (_label, type, node) => {
    const other = { id: "o", type: node.type, position: { x: 300, y: 0 }, width: node.width, height: node.height, data: node.data }
    const model = {
      version: "4.0.0",
      id: "m",
      title: "M",
      type,
      nodes: [node, other],
      edges: corners.map((h, i) => ({ id: `e${i}`, source: "n", target: "o", sourceHandle: h, targetHandle: h, type: "default", data: { points: [] } })),
      assessments: {},
    } as unknown as UMLModel
    const el = await mount(model)
    expect(unresolvedEnds(el, model)).toEqual([])
  })
})
