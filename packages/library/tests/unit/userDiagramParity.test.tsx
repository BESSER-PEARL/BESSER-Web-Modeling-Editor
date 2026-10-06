/**
 * UserDiagram parity with develop:
 *  - v3 `UMLUserModelName.serialize` stores the icon CHILD's id in `icon`;
 *    the migrator must lift the child's SVG body, not the id (the bundled
 *    Personalized Gym Agent template shipped 10 uuid "icons").
 *  - Icon vs attribute table follows the global "Show Icon View" setting
 *    (default off -> table with constraints such as `age >= 65`).
 */
import { describe, it, expect, afterEach } from "vitest"
import { render } from "@testing-library/react"
import { readFileSync } from "fs"
import { resolve } from "path"
import * as Y from "yjs"
import type { StoreApi } from "zustand"
import { convertV3ToV4 } from "@/utils/versionConverter"
import { UserModelNameSVG } from "@/components/svgs/nodes/userDiagram"
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

  it("does not stamp a per-node view (the global setting decides)", () => {
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

describe("UserModelNameSVG follows the global Show Icon View setting", () => {
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

  it("shows the attribute table by default (develop default: icon view off)", () => {
    const { container } = renderSvg()
    expect(container.textContent).toContain("age >= 65")
    expect(container.getElementsByTagName("foreignObject")[0] ?? null).toBeNull()
  })

  it("ignores a legacy per-node view: 'icon' when the setting is off", () => {
    const { container } = renderSvg({ view: "icon" })
    expect(container.textContent).toContain("age >= 65")
    expect(container.getElementsByTagName("foreignObject")[0] ?? null).toBeNull()
  })

  it("shows the icon when the setting is on and an icon exists", () => {
    settingsService.updateSetting("showIconView", true)
    const { container } = renderSvg()
    expect(container.getElementsByTagName("foreignObject")[0] ?? null).not.toBeNull()
    expect(container.textContent).not.toContain("age >= 65")
  })

  it("falls back to the table when the setting is on but no icon exists", () => {
    settingsService.updateSetting("showIconView", true)
    const { container } = renderSvg({ icon: undefined, className: "NoSuchClass" })
    expect(container.textContent).toContain("age >= 65")
    expect(container.getElementsByTagName("foreignObject")[0] ?? null).toBeNull()
  })
})
