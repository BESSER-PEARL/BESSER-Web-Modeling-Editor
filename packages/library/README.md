# @besser/wme

[![npm version](https://img.shields.io/npm/v/@besser/wme)](https://www.npmjs.com/package/@besser/wme)

The BESSER Web Modeling Editor (WME) — an embeddable UML modeling editor for React. Mount it into any DOM node. 13 diagram types, SVG/PNG/PDF/JSON export, optional real-time collaboration via Yjs.

## Install

```sh
npm install @besser/wme
```

## Usage

```ts
import { BesserEditor, BesserMode, Locale, UMLDiagramType } from "@besser/wme"

const container = document.getElementById("besser")
if (!container) throw new Error("#besser container missing")

const editor = new BesserEditor(container, {
  type: UMLDiagramType.ClassDiagram,
  mode: BesserMode.Modelling,
  locale: Locale.en,
})

console.log(editor.model)
const svg = await editor.exportAsSVG({ svgMode: "web" })
editor.destroy()
```

The editor mounts into the DOM and is client-only — instantiate inside `useEffect` or behind a dynamic import in SSR frameworks. Type definitions ship with the package (`dist/index.d.ts`).

## License

MIT — see [LICENSE](./LICENSE).
