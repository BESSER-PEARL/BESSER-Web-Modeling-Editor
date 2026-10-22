import { ModelState } from '../../components/store/model-state';
import { AssessmentState } from '../../services/assessment/assessment-types';
import { UMLElementState } from '../../services/uml-element/uml-element-types';
import { UMLRelationship } from '../../services/uml-relationship/uml-relationship';

/**
 * Merges the old state with the new state. In particular, it maintains
 * all potential prototypes, and gracefully updates owned elements list in the
 * diagram. The boundaries of the diagram are NOT updated, which is to be done, if
 * necessary, by some subsequent side-effect.
 * @param oldState
 * @param newState
 * @returns The merged state.
 */
export function merge(oldState: ModelState, newState: ModelState): ModelState {
  const relationships = Object.keys(newState.elements).filter((id) =>
    UMLRelationship.isUMLRelationship(newState.elements[id]),
  );
  const kept = oldState.diagram.ownedRelationships.filter((id) => relationships.includes(id));
  const added = relationships.filter((id) => !kept.includes(id));
  return {
    ...oldState,
    diagram: {
      ...oldState.diagram,
      ownedElements: Object.keys(newState.elements).filter(
        (id) => !newState.elements[id].owner && !relationships.includes(id),
      ),
      // A patch can introduce a relationship (a comment linked to a constraint).
      // Keep the previous order and append the new ones so the canvas draws them.
      ownedRelationships: [...kept, ...added],
    },
    elements: Object.keys(newState.elements).reduce((acc, id) => {
      return {
        ...acc,
        [id]: {
          ...oldState.elements[id],
          ...newState.elements[id],
        },
      };
    }, {} as UMLElementState),
    interactive: newState.interactive,
    assessments: Object.keys(newState.assessments).reduce((acc, id) => {
      return {
        ...acc,
        [id]: {
          ...oldState.assessments[id],
          ...newState.assessments[id],
        },
      };
    }, {} as AssessmentState),
  };
}
