import { createHostProviderContext } from '../host-provider/host-provider';

/**
 * Cross-diagram element picker, supplied by the host at
 * editor-init time. Same shape as the lineage provider: the
 * editor stays storage-agnostic; the host owns project data and answers
 * "what elements of these types exist in other diagrams?".
 *
 * Used by element-grained cross-refs (`realizes` → Class; `manifests` →
 * Component). The returned `id` is the target element's stable
 * model id (the key in its diagram's `model.elements`) — exactly the
 * cross-diagram id BESSER resolves at generation time.
 */
export interface PickableElement {
  /** Stable model id of the target element (its `.id`). Stored on the ref. */
  id: string;
  /** Display name (may be empty). */
  name: string;
  /** Title of the diagram the element lives in, for disambiguation. */
  diagramTitle: string;
}

export interface ElementPickerProvider {
  /**
   * All elements whose `type` is one of `typeTokens`, drawn from every
   * diagram in the project except the one currently being edited.
   */
  listElements: (typeTokens: string[]) => PickableElement[];
}

export const elementPickerContext = createHostProviderContext<ElementPickerProvider>();

export const useElementPicker = elementPickerContext.useValue;
