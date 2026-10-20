/**
 * UserDiagram parity with develop:
 *  - v3 `UMLUserModelName.serialize` stores the icon CHILD's id in `icon`;
 *    the migrator must lift the child's SVG body, not the id (the bundled
 *    Personalized Gym Agent template shipped 10 uuid "icons").
 *  - Icon vs attribute table follows the per-node `data.view`: icon by
 *    default, the table (constraints such as `age >= 65`) on request.
 */
import { describe, it, expect, afterEach } from "vitest"
import { render } from "@testing-library/react"
import { readFileSync } from "fs"
import { resolve } from "path"
import * as Y from "yjs"
import type { StoreApi } from "zustand"
import { convertV3ToV4 } from "@/utils/versionConverter"
import {
  FALLBACK_PERSON_ICON_SVG,
  UserModelNameSVG,
  resolveUserModelIconBody,
} from "@/components/svgs/nodes/userDiagram"
import {
  AssessmentSelectionStoreContext,
  DiagramStoreContext,
  MetadataStoreContext,
} from "@/store/context"
import { createAssessmentSelectionStore } from "@/store/assessmentSelectionStore"
import { createDiagramStore, DiagramStore } from "@/store/diagramStore"
import { createMetadataStore } from "@/store/metadataStore"
import { settingsService } from "@/services/settingsService"

const ICON_SVG = "<svg xmlns='http://www.w3.org/2000/svg'><circle r='4'/></svg>"

const v3UserModel = () => ({
  version: "3.0.0",
  type: "UserDiagram",
  size: { width: 800, height: 600 },
  interactive: { elements: {}, relationships: {} },
  elements: {
    "user-1": {
      id: "user-1",
      name: "user_1",
      type: "UserModelName",
      owner: null,
      bounds: { x: 0, y: 0, width: 160, height: 100 },
      attributes: ["attr-1"],
      methods: [],
      icon: "icon-1",
      className: "User",
    },
    "attr-1": {
      id: "attr-1",
      name: "age >= 65",
      type: "UserModelAttribute",
      owner: "user-1",
      bounds: { x: 0, y: 0, width: 0, height: 0 },
    },
    "icon-1": {
      id: "icon-1",
      name: "icon",
      type: "UserModelIcon",
      owner: "user-1",
      bounds: { x: 0, y: 0, width: 0, height: 0 },
      icon: ICON_SVG,
    },
  },
  relationships: {},
  assessments: {},
})

describe("UserModelName v3 -> v4 icon migration", () => {
  it("takes the SVG body from the UserModelIcon child, not the stored child id", () => {
    const v4 = convertV3ToV4(v3UserModel() as never)
    const node = v4.nodes.find((n) => n.id === "user-1")!
    expect((node.data as { icon?: string }).icon).toBe(ICON_SVG)
  })

  it("does not stamp a per-node view (unset renders as icon)", () => {
    const v4 = convertV3ToV4(v3UserModel() as never)
    const node = v4.nodes.find((n) => n.id === "user-1")!
    expect((node.data as { view?: string }).view).toBeUndefined()
  })
})

describe("personalized_gym_agent.json template", () => {
  const raw = readFileSync(
    resolve(
      __dirname,
      "../../../webapp/src/main/templates/pattern/project/personalized_gym_agent.json"
    ),
    "utf-8"
  )
  const template = JSON.parse(raw)
  const collect = (
    o: unknown,
    pick: (x: Record<string, unknown>) => boolean,
    out: Record<string, unknown>[] = []
  ) => {
    if (Array.isArray(o)) o.forEach((v) => collect(v, pick, out))
    else if (o && typeof o === "object") {
      const rec = o as Record<string, unknown>
      if (pick(rec)) out.push(rec)
      Object.values(rec).forEach((v) => collect(v, pick, out))
    }
    return out
  }

  it("carries SVG icon bodies on every UserModelName (no leftover child ids)", () => {
    const users = collect(template, (x) => x.type === "UserModelName" && !!x.data)
    expect(users.length).toBe(10)
    for (const u of users) {
      const icon = (u.data as { icon?: string }).icon ?? ""
      expect(icon.trim().startsWith("<svg")).toBe(true)
    }
  })

  it("references the gpt-4o-mini LLM from every LLM reply body (develop 128e5331)", () => {
    const bodies = collect(
      template,
      (x) => x.replyType === "llm" && typeof x.id === "string" && "name" in x
    )
    expect(bodies.length).toBe(10)
    for (const b of bodies) expect(b.llm_name).toBe("gpt-4o-mini")
  })
})

describe("UserModelNameSVG view (per-node data.view, icon by default)", () => {
  afterEach(() => settingsService.updateSetting("showIconView", false))

  const renderSvg = (data: Record<string, unknown> = {}) => {
    const ydoc = new Y.Doc()
    return render(
      <DiagramStoreContext.Provider
        value={createDiagramStore(ydoc) as StoreApi<DiagramStore>}
      >
        <MetadataStoreContext.Provider value={createMetadataStore(ydoc)}>
          <AssessmentSelectionStoreContext.Provider
            value={createAssessmentSelectionStore()}
          >
            <UserModelNameSVG
              id="user-1"
              width={160}
              height={100}
              data={{
                name: "user_1",
                className: "User",
                icon: ICON_SVG,
                attributes: [{ id: "attr-1", name: "age >= 65" }],
                ...data,
              }}
            />
          </AssessmentSelectionStoreContext.Provider>
        </MetadataStoreContext.Provider>
      </DiagramStoreContext.Provider>
    )
  }
  const iconBox = (c: HTMLElement) => c.getElementsByTagName("image")[0] ?? null
  const iconMarkup = (c: HTMLElement) =>
    decodeURIComponent(iconBox(c)!.getAttribute("href")!.split(",")[1])

  it("shows the icon by default (no view stored), header still named", () => {
    const { container } = renderSvg()
    expect(iconBox(container)).not.toBeNull()
    expect(iconMarkup(container)).toContain("circle")
    expect(container.textContent).toContain("User")
    expect(container.textContent).not.toContain("age >= 65")
  })

  it("shows the attribute table when view is 'attributes'", () => {
    const { container } = renderSvg({ view: "attributes" })
    expect(container.textContent).toContain("age >= 65")
    expect(iconBox(container)).toBeNull()
  })

  it("is not tied to the object-diagram Show Icon View setting", () => {
    settingsService.updateSetting("showIconView", false)
    expect(iconBox(renderSvg().container)).not.toBeNull()
    settingsService.updateSetting("showIconView", true)
    const { container } = renderSvg({ view: "attributes" })
    expect(container.textContent).toContain("age >= 65")
    expect(iconBox(container)).toBeNull()
  })

  it("falls back to the person glyph when no icon resolves (never the table)", () => {
    const { container } = renderSvg({ icon: undefined, className: "NoSuchClass" })
    expect(iconMarkup(container)).toContain("fluentColorPerson")
    expect(container.textContent).not.toContain("age >= 65")
  })

  it("never inserts an imported icon as live markup (stored XSS)", () => {
    const payload =
      "<svg xmlns='http://www.w3.org/2000/svg'><image href='x' onerror='window.__xss=1'/>" +
      "<foreignObject><img src='x' onerror='window.__xss=1'></foreignObject></svg>"
    const { container } = renderSvg({ icon: payload })
    expect(container.querySelector("img, foreignObject, [onerror]")).toBeNull()
    expect(iconBox(container)!.getAttribute("href")).toMatch(/^data:image\/svg\+xml/)
  })

  it("uses the linked meta-class icon when the node has none", () => {
    const metaIcon = resolveUserModelIconBody({ className: "Personal_Information" })
    expect(metaIcon).not.toBe(FALLBACK_PERSON_ICON_SVG)
    expect(metaIcon.trim().startsWith("<svg")).toBe(true)
  })
})
