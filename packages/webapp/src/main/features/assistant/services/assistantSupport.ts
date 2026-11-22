/**
 * Which diagram types the modeling assistant works on.
 *
 * - `NNDiagram`: deliberately unsupported; the assistant has no reasoning over
 *   network architectures.
 * - `KnowledgeGraphDiagram`: not supported. Its model is `KnowledgeGraphData`,
 *   not an Apollon model, and there is no converter or modifier for it (the
 *   fallback ClassDiagram ones would corrupt it). A KG is built by import
 *   (OWL/RDF) and cleaned with the Refine KG dialog instead.
 *
 * On both the floating bubble is hidden. The drawer stays reachable, so the
 * user can still ask for another diagram (the assistant switches to it).
 */
/** Types the assistant must never write a model into: nothing it produces is
 *  one of their models. */
const NOT_WRITABLE: ReadonlySet<string> = new Set(['KnowledgeGraphDiagram']);
const HIDDEN_ON: ReadonlySet<string> = new Set(['NNDiagram', ...NOT_WRITABLE]);

/** False on a diagram type where the assistant bubble is hidden (see above). */
export const isAssistantApplicableTo = (diagramType: string | undefined | null): boolean =>
  !diagramType || !HIDDEN_ON.has(diagramType);

/** False for a diagram type the assistant must never write a model into. */
export const canAssistantWriteTo = (diagramType: string | undefined | null): boolean =>
  !diagramType || !NOT_WRITABLE.has(diagramType);
