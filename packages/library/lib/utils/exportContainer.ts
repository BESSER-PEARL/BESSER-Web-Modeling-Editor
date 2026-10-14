/**
 * The off-screen mount `BesserEditor.exportModelAsSvg` renders a model into
 * for measuring (upstream Apollon #841).
 *
 * It must stay out of the host document's scroll geometry: an absolutely
 * positioned 4000x4000 mount expands the body's scrollWidth / scrollHeight
 * for as long as an async export runs (the host page grows scrollbars and
 * jumps). Fixed positioning is viewport-relative and never extends the
 * document's scrollable overflow. It is also inert to the pointer and hidden
 * from assistive technology while it exists.
 *
 * `visibility: hidden` is deliberately NOT used: the SVG serializer inlines
 * computed styles, and an inherited `hidden` would blank the export.
 */
export function createOffscreenExportContainer(
  doc: Document = document
): HTMLDivElement {
  const container = doc.createElement("div")
  container.style.display = "flex"
  container.style.width = "4000px"
  container.style.height = "4000px"
  container.style.zIndex = "-1000"
  container.style.top = "0"
  container.style.left = "-99px"
  container.style.position = "fixed"
  container.style.pointerEvents = "none"
  container.setAttribute("aria-hidden", "true")
  return container
}
