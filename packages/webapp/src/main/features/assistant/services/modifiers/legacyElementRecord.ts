/**
 * Legacy element-record helpers for the GUI / Quantum assistant modifiers.
 *
 * Unlike the four UML diagram modifiers (class / object / state-machine /
 * agent), which are v4-native and walk `model.nodes[]` / `model.edges[]`,
 * the GUI and Quantum assistant paths still operate on the flat
 * `elements` / `relationships` record shape their assistant converters
 * emit (GrapesJS pages and Quirk circuits have no v4 UML wire shape —
 * preserved limitation, identical to develop). These helpers carry the
 * pre-v4 `ModifierHelpers` element-record implementations verbatim so
 * the two modifiers type-check against the current API without changing
 * their runtime semantics.
 */

import { BESSERModel } from '../UMLModelingService';

export interface LegacyElementRecordModel {
  elements: Record<string, any>;
  relationships?: Record<string, any>;
}

/**
 * View a BESSERModel as the legacy element-record shape. Pure cast —
 * callers are GUI / Quantum modifiers whose converters guarantee the
 * shape at runtime.
 */
export function asElementRecordModel(model: BESSERModel): LegacyElementRecordModel {
  return model as unknown as LegacyElementRecordModel;
}

/**
 * Find element by name and type (exact match first, then
 * case-insensitive). Returns the element id or null.
 */
export function findElementByName(model: BESSERModel, name: string, type: string): string | null {
  const { elements } = asElementRecordModel(model);
  const normalizedName = (name || '').trim().toLowerCase();
  // First pass: exact match
  for (const [id, element] of Object.entries(elements)) {
    if (element.type === type && element.name === name) {
      return id;
    }
  }
  // Second pass: case-insensitive match
  for (const [id, element] of Object.entries(elements)) {
    if (element.type === type && (element.name || '').trim().toLowerCase() === normalizedName) {
      return id;
    }
  }
  return null;
}

/**
 * Remove an element, its child rows (attributes / methods / bodies /
 * fallbackBodies), and any relationships referencing it.
 */
export function removeElementWithChildren(model: BESSERModel, elementId: string): BESSERModel {
  const m = asElementRecordModel(model);
  const element = m.elements[elementId];
  if (!element) return model;

  // Remove child elements (attributes, methods, bodies, etc.)
  ['attributes', 'methods', 'bodies', 'fallbackBodies'].forEach((childProp) => {
    const children = element[childProp];
    if (Array.isArray(children)) {
      children.forEach((childId: string) => {
        delete m.elements[childId];
      });
    }
  });

  // Remove the element itself
  delete m.elements[elementId];

  // Remove related relationships
  if (m.relationships) {
    Object.keys(m.relationships).forEach((relId) => {
      const rel = m.relationships![relId];
      if (rel.source?.element === elementId || rel.target?.element === elementId) {
        delete m.relationships![relId];
      }
    });
  }

  return model;
}
