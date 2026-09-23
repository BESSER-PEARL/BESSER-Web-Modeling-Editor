import React, { createContext, useContext, useEffect, useState } from 'react';

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

const ElementPickerContext = createContext<ElementPickerProvider | null>(null);

export const ElementPickerContextProvider: React.FC<{
  value: ElementPickerProvider | null;
  children: React.ReactNode;
}> = ({ value, children }) => <ElementPickerContext.Provider value={value}>{children}</ElementPickerContext.Provider>;

export const useElementPicker = (): ElementPickerProvider | null => useContext(ElementPickerContext);

/**
 * Wraps `ElementPickerContextProvider` so ApollonEditor can swap the
 * provider imperatively (via `setElementPickerProvider`) without tearing
 * down its React tree — identical to `LineageProviderRoot`.
 */
export const ElementPickerProviderRoot: React.FC<{
  initialValue: ElementPickerProvider | null;
  register: (listener: (v: ElementPickerProvider | null) => void) => void;
  children: React.ReactNode;
}> = ({ initialValue, register, children }) => {
  const [value, setValue] = useState<ElementPickerProvider | null>(initialValue);
  useEffect(() => {
    register(setValue);
  }, [register]);
  return <ElementPickerContextProvider value={value}>{children}</ElementPickerContextProvider>;
};
