import { describe, it, expect } from "vitest"
import { act, render, screen } from "@testing-library/react"
import * as Y from "yjs"
import { MetadataStoreContext } from "@/store/context"
import { createMetadataStore } from "@/store/metadataStore"
import { createDiagramStore } from "@/store/diagramStore"
import { hasTranslation, translate, useTranslation } from "@/i18n"
import { Locale } from "@/typings"

/**
 * The editor-chrome translation module (`lib/i18n`). Bundles are the shared
 * `packages/i18n/<locale>/editor.json` files, so these tests pin a handful
 * of long-standing keys from the old editor.
 */
describe("translate()", () => {
  it("resolves a key in the requested locale", () => {
    expect(translate("packages.ClassDiagram.Class", "Class", Locale.de)).toBe(
      "Klasse"
    )
    expect(translate("popup.attributes", undefined, Locale.fr)).toBe(
      "Attributs"
    )
  })

  it("defaults to English when no locale is given", () => {
    expect(translate("packages.ClassDiagram.Class")).toBe("Class")
  })

  it("falls back locale → English → caller fallback → key", () => {
    // Unknown locale: English bundle answers.
    expect(
      translate("packages.ClassDiagram.Class", "x", "xx" as Locale)
    ).toBe("Class")
    // Key unknown everywhere: caller's fallback.
    expect(translate("does.not.exist", "Fallback", Locale.de)).toBe(
      "Fallback"
    )
    // No fallback either: the key itself.
    expect(translate("does.not.exist", undefined, Locale.de)).toBe(
      "does.not.exist"
    )
  })

  it("treats a non-leaf path as a miss", () => {
    // `packages.ClassDiagram` is an object, not a string.
    expect(translate("packages.ClassDiagram", "Group", Locale.de)).toBe(
      "Group"
    )
  })

  it("interpolates {{name}} and {name} placeholders", () => {
    expect(
      translate("missing.key", "Hello {{ name }}, {{name}}!", Locale.en, {
        name: "Ada",
      })
    ).toBe("Hello Ada, Ada!")
    // Single-brace form used by some older NN strings ("Dim {n}:").
    expect(translate("popup.nn.row.dim", undefined, Locale.en, { n: 2 })).toBe(
      "Dim 2:"
    )
  })

  it("leaves placeholders without a matching param untouched", () => {
    expect(
      translate("missing.key", "{{a}} and {user_message}", Locale.en, {
        a: 1,
      })
    ).toBe("1 and {user_message}")
    expect(translate("missing.key", "{{a}}", Locale.en)).toBe("{{a}}")
  })
})

describe("hasTranslation()", () => {
  it("is true for English leaves and false otherwise", () => {
    expect(hasTranslation("packages.ClassDiagram.Class")).toBe(true)
    expect(hasTranslation("packages.ClassDiagram")).toBe(false)
    expect(hasTranslation("does.not.exist")).toBe(false)
  })
})

const Probe = () => {
  const { t, locale } = useTranslation()
  return (
    <div>
      <span data-testid="label">
        {t("packages.ClassDiagram.ClassBidirectional", "Association")}
      </span>
      <span data-testid="locale">{locale}</span>
    </div>
  )
}

describe("useTranslation()", () => {
  it("renders English without a metadata store", () => {
    render(<Probe />)
    expect(screen.getByTestId("label")).toHaveTextContent("Association")
    expect(screen.getByTestId("locale")).toHaveTextContent("en")
  })

  it("follows the metadata store locale and re-renders on change", () => {
    const ydoc = new Y.Doc()
    const metadata = createMetadataStore(ydoc)
    render(
      <MetadataStoreContext.Provider value={metadata}>
        <Probe />
      </MetadataStoreContext.Provider>
    )
    expect(screen.getByTestId("label")).toHaveTextContent("Association")

    act(() => metadata.getState().setLocale(Locale.de))
    expect(screen.getByTestId("label")).toHaveTextContent("Assoziation")
    expect(screen.getByTestId("locale")).toHaveTextContent("de")

    act(() => metadata.getState().setLocale(Locale.es))
    expect(screen.getByTestId("label")).toHaveTextContent("Asociación")
  })

  it("switching locale touches neither the Yjs document nor the diagram store", () => {
    const ydoc = new Y.Doc()
    const metadata = createMetadataStore(ydoc)
    const diagram = createDiagramStore(ydoc)
    let ydocUpdates = 0
    ydoc.on("update", () => {
      ydocUpdates += 1
    })
    let diagramChanges = 0
    const unsubscribe = diagram.subscribe(() => {
      diagramChanges += 1
    })

    metadata.getState().setLocale(Locale.fr)

    expect(metadata.getState().locale).toBe(Locale.fr)
    expect(ydocUpdates).toBe(0)
    expect(diagramChanges).toBe(0)
    unsubscribe()
  })
})
