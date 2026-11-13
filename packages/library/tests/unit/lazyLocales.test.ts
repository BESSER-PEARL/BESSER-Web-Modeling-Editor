import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act } from "@testing-library/react"
import { Locale } from "@/typings"
import { UMLDiagramType } from "@/types"
import en from "../../../i18n/en/editor.json"
import de from "../../../i18n/de/editor.json"

// The behaviour under test is store-level; skip mounting the React Flow canvas.
vi.mock("@/App", () => ({ AppWithProvider: () => null }))

/**
 * Only English is bundled; other locales load on demand. The shared test
 * setup preloads every locale, so each test here starts from a fresh module
 * graph in which nothing but English is loaded.
 */
let i18n: typeof import("@/i18n")
let BesserEditor: typeof import("@/besser-editor").BesserEditor
let editor: InstanceType<typeof BesserEditor> | null = null

beforeEach(async () => {
  vi.resetModules()
  i18n = await import("@/i18n")
})

const mount = (locale?: Locale) => {
  const el = document.createElement("div")
  document.body.appendChild(el)
  act(() => {
    editor = new BesserEditor(el, { type: UMLDiagramType.ClassDiagram, locale })
  })
  return editor!
}

describe("lazy editor labels", () => {
  it("bundles only English, so an unloaded locale reads English", () => {
    expect(i18n.isLocaleLoaded(Locale.en)).toBe(true)
    expect(i18n.isLocaleLoaded(Locale.de)).toBe(false)
    expect(i18n.translate("views.highlight", undefined, Locale.de)).toBe(en.views.highlight)
  })

  it("loadLocale makes the locale's labels available", async () => {
    await i18n.loadLocale(Locale.de)

    expect(i18n.isLocaleLoaded(Locale.de)).toBe(true)
    expect(i18n.translate("views.highlight", undefined, Locale.de)).toBe(de.views.highlight)
  })
})

describe("an editor in a lazily loaded locale", () => {
  // The editor's module graph is large; re-importing it fresh is slow under a parallel run.
  beforeEach(async () => {
    BesserEditor = (await import("@/besser-editor")).BesserEditor
  }, 60_000)

  afterEach(() => {
    act(() => editor?.destroy())
    editor = null
  })

  it("switches to a locale once its labels are loaded", async () => {
    const e = mount()

    e.locale = Locale.de
    expect(e.locale).toBe(Locale.en)

    await vi.waitFor(() => expect(e.locale).toBe(Locale.de))
    expect(i18n.translate("views.highlight", undefined, e.locale)).toBe(de.views.highlight)
  })

  it("created in an unloaded locale opens in it once loaded", async () => {
    const e = mount(Locale.de)

    await vi.waitFor(() => expect(e.locale).toBe(Locale.de))
  })

  it("a locale that finishes loading after a newer switch does not win", async () => {
    const e = mount()

    e.locale = Locale.de
    e.locale = Locale.en
    await i18n.loadLocale(Locale.de)
    await Promise.resolve()

    expect(e.locale).toBe(Locale.en)
  })
})
