import { AsyncAction } from '../../utils/actions/actions';
import { clone, filterRoots, getChildren } from '../../utils/geometry/tree';
import { IPoint } from '../../utils/geometry/point';
import { notEmpty } from '../../utils/not-empty';
import { IUMLElement, UMLElement } from '../uml-element/uml-element';
import { UMLElementRepository } from '../uml-element/uml-element-repository';
import { CopyAction, CopyActionTypes, PasteAction } from './copy-types';
import { UMLElementsForDiagram } from '../../packages/uml-element-type';
import { IUMLRelationship, UMLRelationship } from '../uml-relationship/uml-relationship';
import { UMLRelationshipRepository } from '../uml-relationship/uml-relationship-repository';

export class CopyRepository {
  /**
   * Counts how often paste commands are executed to set offset
   */
  static pasteCounter = 0;

  static copy =
    (id?: string | string[]): AsyncAction =>
    (dispatch, getState): CopyAction | undefined => {
      CopyRepository.pasteCounter = 0;
      const { elements, selected } = getState();
      const ids = id ? (Array.isArray(id) ? id : [id]) : selected;

      // copy elements with all their child elements, because containers do not know their full children representation
      const idsToClone = getChildren(ids, getState().elements);

      // Always store in Redux state — this is the reliable path
      return dispatch<CopyAction>({
        type: CopyActionTypes.COPY,
        payload: idsToClone,
        undoable: false,
      });
    };

  static paste = (): AsyncAction => (dispatch, getState) => {
    CopyRepository.pasteCounter++;

    const { copy } = getState();
    if (!copy || copy.length === 0) {
      return;
    }

    dispatch<PasteAction>({ type: CopyActionTypes.PASTE, payload: {}, undoable: false });
    const { elements } = getState();

    const elementsToCopy: UMLElement[] = copy
      .map((IdOfCopyElement) => UMLElementRepository.get(elements[IdOfCopyElement]))
      .filter(notEmpty);

    // Find ALL relationships in the store whose source AND target are both in the copied set.
    // Relationships are not in the `copy` array (which only has elements), so we scan the full
    // elements state to find them.
    const relationshipsToCopy: UMLRelationship[] = Object.values(elements)
      .map((el) => UMLRelationshipRepository.get(el))
      .filter(notEmpty)
      .filter(
        (relationship) =>
          relationship.source &&
          relationship.target &&
          copy.includes(relationship.source.element) &&
          copy.includes(relationship.target.element),
      );

    const { copiedElements, cloneMap } = CopyRepository.transformElementsForCopy(elementsToCopy);

    dispatch(UMLElementRepository.create(copiedElements));
    dispatch(UMLElementRepository.deselect());

    const copiedRelationships = CopyRepository.transformRelationshipsForCopy(relationshipsToCopy, cloneMap);
    dispatch(UMLElementRepository.create(copiedRelationships));
    dispatch(
      UMLElementRepository.select(
        filterRoots(
          [...copiedElements, ...copiedRelationships].map((element) => element.id),
          getState().elements,
        ),
      ),
    );
  };

  private static transformElementsForCopy(umlElements: UMLElement[]): {
    copiedElements: IUMLElement[];
    cloneMap: { [key: string]: string };
  } {
    // roots in diagram Elements
    const roots = umlElements.filter(
      (element) => !element.owner || umlElements.every((innerElement) => innerElement.id !== element.owner),
    );
    const cloneMap: { [key: string]: string } = {};
    // flat map elements to copies
    const copies: UMLElement[] = roots.reduce((clonedElements: UMLElement[], element: UMLElement) => {
      // Re-hydrate as a proper class instance so .clone() is available
      const updatedElement = UMLElementRepository.get({
        ...element,
        owner: null,
        bounds: {
          ...element.bounds,
          x: element.bounds.x + 10 * CopyRepository.pasteCounter,
          y: element.bounds.y + 10 * CopyRepository.pasteCounter,
        },
      })!;

      // Also re-hydrate the source elements so clone() can traverse children
      const hydratedElements = umlElements
        .map((el) => UMLElementRepository.get(el))
        .filter(notEmpty);

      const clones = clone(updatedElement, hydratedElements);
      cloneMap[element.id] = clones[0].id;
      return clonedElements.concat(...clones);
    }, []);

    // map elements to serializable elements
    return { copiedElements: copies.map((element) => ({ ...element })), cloneMap };
  }

  private static transformRelationshipsForCopy(
    umlRelationships: UMLRelationship[],
    cloneMap: { [key: string]: string },
  ): IUMLRelationship[] {
    const roots = umlRelationships.filter(
      (element) => !element.owner || umlRelationships.every((innerElement) => innerElement.id !== element.owner),
    );
    const copies: UMLRelationship[] = roots.reduce((clonedElements: UMLRelationship[], element: UMLRelationship) => {
      const newPath = element.path.map((pathPoint) => ({ x: pathPoint.x + 10, y: pathPoint.y + 10 }) as IPoint);
      // Re-hydrate as a proper class instance so .cloneRelationship() is available
      // (spread syntax strips class methods — same fix as transformElementsForCopy)
      const updatedElement = UMLRelationshipRepository.get({
        ...element,
        owner: null,
        bounds: {
          ...element.bounds,
          x: element.bounds.x + 10 * CopyRepository.pasteCounter,
          y: element.bounds.y + 10 * CopyRepository.pasteCounter,
        },
        source: { ...element.source, element: cloneMap[element.source.element] },
        target: { ...element.target, element: cloneMap[element.target.element] },
        path: [newPath[0], newPath[1], ...newPath.slice(2)],
      });
      if (!updatedElement) return clonedElements;
      const clones = [updatedElement.cloneRelationship()];
      return clonedElements.concat(...clones);
    }, []);

    return copies.map((relationship) => ({ ...relationship }));
  }
}
