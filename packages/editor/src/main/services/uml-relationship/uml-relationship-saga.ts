import { SagaIterator } from 'redux-saga';
import { all, call, getContext, put, select, take } from 'redux-saga/effects';
import { ModelState } from '../../components/store/model-state';
import { run } from '../../utils/actions/sagas';
import { diff } from '../../utils/fx/diff';
import { ILayer } from '../layouter/layer';
import { RemoveAction, UMLContainerActionTypes } from '../uml-container/uml-container-types';
import { MoveAction, MovingActionTypes } from '../uml-element/movable/moving-types';
import { ResizeAction, ResizingActionTypes } from '../uml-element/resizable/resizing-types';
import { UMLElementRepository } from '../uml-element/uml-element-repository';
import { CreateAction, DeleteAction, UMLElementActionTypes, UpdateAction } from '../uml-element/uml-element-types';
import { ReconnectableActionTypes, ReconnectAction } from './reconnectable/reconnectable-types';
import { IUMLRelationship, UMLRelationship } from './uml-relationship';
import { UMLRelationshipRepository } from './uml-relationship-repository';
import {
  EndWaypointsAction,
  LayoutAction,
  UMLRelationshipActionTypes,
  WaypointLayoutAction,
} from './uml-relationship-types';
import { UMLRelationshipType } from '../../packages/uml-relationship-type';
import { IUMLCommunicationLink } from '../../packages/uml-communication-diagram/uml-communication-link/uml-communication-link';
import { UMLDiagramRepository } from '../uml-diagram/uml-diagram-repository';
import { notEmpty } from '../../utils/not-empty';

export function* UMLRelationshipSaga() {
  yield run([create, reconnect, update, layoutElement, layoutRelationship, deleteElement]);
}

function* create(): SagaIterator {
  const action: CreateAction = yield take(UMLElementActionTypes.CREATE);
  for (const value of action.payload.values) {
    yield call(recalc, value.id);
  }
}

function* reconnect(): SagaIterator {
  const action: ReconnectAction = yield take(ReconnectableActionTypes.RECONNECT);
  for (const connection of action.payload.connections) {
    yield call(recalc, connection.id);
  }
}

function* layoutRelationship(): SagaIterator {
  const action: EndWaypointsAction = yield take(UMLRelationshipActionTypes.ENDWAYPOINTSLAYOUT);
  const layer: ILayer = yield getContext('layer');
  const { elements, diagram }: ModelState = yield select();
  const children = [
    ...diagram.ownedElements.map((id) => UMLElementRepository.get(elements[id])),
    ...diagram.ownedRelationships.map((id) => UMLRelationshipRepository.get(elements[id])),
  ].filter(notEmpty);
  const container = UMLDiagramRepository.get(diagram);

  if (!container) {
    return;
  }

  const [updates] = container.render(layer, children);
  const delta = {
    width: updates.bounds.width - diagram.bounds.width,
    height: updates.bounds.height - diagram.bounds.height,
  };

  yield put({
    type: ResizingActionTypes.RESIZE,
    payload: { ids: [diagram.id], delta },
    undoable: false,
  });
  
  // Now find and update any relationships that connect to the moved relationship
  const movedRelationshipId = action.payload.id;
  const relationships = Object.values(elements).filter((x): x is IUMLRelationship =>
    UMLRelationship.isUMLRelationship(x),
  );
  
  // Find relationships that connect to our moved relationship
  const connectedRelationships = relationships.filter(relationship => 
    relationship.source.element === movedRelationshipId || 
    relationship.target.element === movedRelationshipId
  ).map(relationship => relationship.id);
  
  // Update each connected relationship
  for (const id of connectedRelationships) {
    yield call(recalc, id);
  }
}

function* update(): SagaIterator {
  const action: UpdateAction = yield take(UMLElementActionTypes.UPDATE);
  const { elements }: ModelState = yield select();

  // Check if this is an update from a property panel
  // Property panel updates typically have a small number of properties and only for a single element
  const isLikelyPanelUpdate = action.payload.values.length === 1 && 
                             (Object.keys(action.payload.values[0]).length <= 3 || 
                              'name' in action.payload.values[0] || 
                              'source' in action.payload.values[0] || 
                              'target' in action.payload.values[0]);

  for (const value of action.payload.values) {
    if (!UMLRelationship.isUMLRelationship(elements[value.id])) {
      continue;
    }
    
    // For property panel updates on manually laid out relationships,
    // only skip recalculation if the connected elements haven't changed position.
    // This ensures that endpoint positions stay correct when source/target elements move.
    if (isLikelyPanelUpdate && elements[value.id].isManuallyLayouted) {
      const rel = elements[value.id] as IUMLRelationship;
      const sourceEl = elements[rel.source.element];
      const targetEl = elements[rel.target.element];

      if (sourceEl && targetEl) {
        // Compute current absolute positions of source and target
        const sourceAbsPos: { x: number; y: number } = yield select((state: ModelState) => {
          let el = state.elements[rel.source.element];
          let x = el.bounds.x;
          let y = el.bounds.y;
          while (el.owner) {
            el = state.elements[el.owner];
            x += el.bounds.x;
            y += el.bounds.y;
          }
          return { x, y };
        });
        const targetAbsPos: { x: number; y: number } = yield select((state: ModelState) => {
          let el = state.elements[rel.target.element];
          let x = el.bounds.x;
          let y = el.bounds.y;
          while (el.owner) {
            el = state.elements[el.owner];
            x += el.bounds.x;
            y += el.bounds.y;
          }
          return { x, y };
        });

        // Compare with the relationship's current bounds to detect if elements moved.
        // The relationship path is relative to its own bounds origin. If source/target
        // absolute positions haven't changed relative to what we last computed, skip.
        const relBounds = rel.bounds;
        const pathStart = rel.path?.[0];
        const pathEnd = rel.path?.[rel.path.length - 1];

        const sourceChanged =
          !pathStart ||
          Math.abs(sourceAbsPos.x - (relBounds.x + pathStart.x)) > 1 ||
          Math.abs(sourceAbsPos.y - (relBounds.y + pathStart.y)) > 1;
        const targetChanged =
          !pathEnd ||
          Math.abs(targetAbsPos.x - (relBounds.x + pathEnd.x)) > 1 ||
          Math.abs(targetAbsPos.y - (relBounds.y + pathEnd.y)) > 1;

        if (!sourceChanged && !targetChanged) {
          // Elements haven't moved - safe to skip recalculation
          continue;
        }
        // Elements have moved - fall through to recalculate
      }
    }

    yield call(recalc, value.id);
  }
}

function* layoutElement(): SagaIterator {
  const action: MoveAction | ResizeAction = yield take([MovingActionTypes.MOVE, ResizingActionTypes.RESIZE]);
  const { elements }: ModelState = yield select();
  const relationships = Object.values(elements).filter((x): x is IUMLRelationship =>
    UMLRelationship.isUMLRelationship(x),
  );
  
  // Track both directly and indirectly affected relationships
  const directUpdates: string[] = [];
  const allUpdates = new Set<string>();

  // First pass: find direct relationships connected to moved elements
  loop: for (const relationship of relationships) {
    let source: string | null = relationship.source.element;
    while (source) {
      if (action.payload.ids.includes(source)) {
        directUpdates.push(relationship.id);
        allUpdates.add(relationship.id);
        continue loop;
      }
      if (!elements[source]) break;
      source = elements[source].owner;
    }
    let target: string | null = relationship.target.element;
    while (target) {
      if (action.payload.ids.includes(target)) {
        directUpdates.push(relationship.id);
        allUpdates.add(relationship.id);
        continue loop;
      }
      if (!elements[target]) break;
      target = elements[target].owner;
    }
  }

  // Process the direct updates first
  for (const id of directUpdates) {
    yield call(recalc, id);
  }

  // Second pass: find relationships connected to relationships that were updated
  // We may need multiple passes to handle deeply nested relationship chains
  let updatedInLastPass = [...directUpdates];
  let additionalUpdates: string[] = [];

  // Continue until no new updates are found
  while (updatedInLastPass.length > 0) {
    additionalUpdates = [];
    
    // Look for relationships connected to relationships updated in previous pass
    for (const relationship of relationships) {
      // Skip if this relationship was already updated
      if (allUpdates.has(relationship.id)) {
        continue;
      }
      
      // Check if this relationship connects to any updated relationship
      if (updatedInLastPass.includes(relationship.source.element) || 
          updatedInLastPass.includes(relationship.target.element)) {
        additionalUpdates.push(relationship.id);
        allUpdates.add(relationship.id);
      }
    }
    
    // Update these relationships
    for (const id of additionalUpdates) {
      yield call(recalc, id);
    }
    
    // Prepare for next pass
    updatedInLastPass = [...additionalUpdates];
  }
}


function* deleteElement(): SagaIterator {
  const action: DeleteAction = yield take(UMLElementActionTypes.DELETE);
  const { elements }: ModelState = yield select();
  const relationships = Object.values(elements)
    .filter((x): x is IUMLRelationship => UMLRelationship.isUMLRelationship(x))
    .filter(
      (relationship) =>
        action.payload.ids.includes(relationship.source.element) ||
        action.payload.ids.includes(relationship.target.element),
    )
    .map((relationship) => relationship.id);

  yield all([
    put<RemoveAction>({
      type: UMLContainerActionTypes.REMOVE,
      payload: { ids: relationships },
      undoable: false,
    }),
    put<DeleteAction>({
      type: UMLElementActionTypes.DELETE,
      payload: { ids: relationships },
      undoable: false,
    }),
  ]);
}

export function* recalc(id: string): SagaIterator {
  const { elements, selected, editor }: ModelState = yield select();
  const layer: ILayer = yield getContext('layer');
  const relationship = UMLRelationshipRepository.get(elements[id]);
  if (!relationship) {
    return;
  }

  // Check if source is a relationship
  let source;
  const sourceElement = elements[relationship.source.element];
  if (!sourceElement) return;
  if (UMLRelationship.isUMLRelationship(sourceElement)) {
    source = UMLRelationshipRepository.get(sourceElement);
  } else {
    source = UMLElementRepository.get(sourceElement);
  }

  // Check if target is a relationship
  let target;
  const targetElement = elements[relationship.target.element];
  if (!targetElement) return;
  if (UMLRelationship.isUMLRelationship(targetElement)) {
    target = UMLRelationshipRepository.get(targetElement);
  } else {
    target = UMLElementRepository.get(targetElement);
  }
  
  if (!source || !target) {
    return;
  }

  const sourcePosition = yield select((state: ModelState) => {
    let element = state.elements[relationship.source.element];
    let x = element.bounds.x;
    let y = element.bounds.y;
    while (element.owner) {
      element = state.elements[element.owner];
      x += element.bounds.x;
      y += element.bounds.y;
    }
    return { x, y };
  });
  source.bounds = { ...source.bounds, ...sourcePosition };

  const targetPosition = yield select((state: ModelState) => {
    let element = state.elements[relationship.target.element];
    let x = element.bounds.x;
    let y = element.bounds.y;
    while (element.owner) {
      element = state.elements[element.owner];
      x += element.bounds.x;
      y += element.bounds.y;
    }
    return { x, y };
  });
  target.bounds = { ...target.bounds, ...targetPosition };

  const original = elements[id] as any;
  const [updates] = relationship.render(layer, source, target) as UMLRelationship[];

  const { path, bounds } = diff(original, updates) as Partial<IUMLRelationship>;
  if (path) {
    // Check if this relationship connects to other relationships
    const connectsToRelationship = UMLRelationship.isUMLRelationship(elements[relationship.source.element]) || 
                                  UMLRelationship.isUMLRelationship(elements[relationship.target.element]);
    
    // If it connects to another relationship, we should always update its layout
    if (relationship.isManuallyLayouted && shouldPreserveLayout(source.id, target.id, selected, editor.readonly) && !connectsToRelationship) {
      yield put<WaypointLayoutAction>(
        UMLRelationshipRepository.layoutWaypoints(updates.id, original.path, { ...original.bounds, ...bounds }),
      );
    } else {
      yield put<LayoutAction>(UMLRelationshipRepository.layout(updates.id, path, { ...original.bounds, ...bounds }));
    }
  }
  // layout messages of CommunicationLink
  if (updates.type === UMLRelationshipType.CommunicationLink) {
    yield put<UpdateAction>(UMLElementRepository.update<IUMLCommunicationLink>(updates.id, updates));
  }
}

const shouldPreserveLayout = (sourceId: string, targetId: string, selected: string[], isEditorReadOnly: boolean) => {
  return (selected.includes(sourceId) && selected.includes(targetId)) || isEditorReadOnly ? true : false;
};
