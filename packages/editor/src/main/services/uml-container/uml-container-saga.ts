import { SagaIterator } from 'redux-saga';
import { call, delay, getContext, put, race, select, take } from 'redux-saga/effects';
import { ModelState } from '../../components/store/model-state';
import { UMLElementType } from '../../packages/uml-element-type';
import { UMLElements } from '../../packages/uml-elements';
import { run } from '../../utils/actions/sagas';
import { ILayer } from '../layouter/layer';
import { render } from '../layouter/layouter';
import { MovableActionTypes, MoveEndAction, MoveStartAction } from '../uml-element/movable/movable-types';
import { UMLElementState } from '../uml-element/uml-element-types';
import { UMLContainer } from './uml-container';
import { UMLContainerRepository } from './uml-container-repository';
import { AppendAction, RemoveAction, UMLContainerActionTypes } from './uml-container-types';
import { UMLElementCommonRepository } from '../uml-element/uml-element-common-repository';
import { IUMLRelationship, UMLRelationship } from '../uml-relationship/uml-relationship';
import { recalc } from '../uml-relationship/uml-relationship-saga';

/** Bounds captured at each drag-start, consumed by revertOnSiblingOverlap on drag-end. */
const moveBoundsCache: { [id: string]: { x: number; y: number; width: number; height: number } } = {};

function boundsOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  // 1 px inset so touching edges don't trigger a revert
  return a.x + 1 < b.x + b.width && a.x + a.width - 1 > b.x && a.y + 1 < b.y + b.height && a.y + a.height - 1 > b.y;
}

function* recordBoundsOnStart(): SagaIterator {
  const startAction: MoveStartAction = yield take(MovableActionTypes.START);
  const { elements }: ModelState = yield select();
  for (const id of startAction.payload.ids) {
    if (elements[id]) {
      const { x, y, width, height } = elements[id].bounds;
      moveBoundsCache[id] = { x, y, width, height };
    }
  }
}

function* revertOnSiblingOverlap(): SagaIterator {
  const endAction: MoveEndAction = yield take(MovableActionTypes.END);
  if (endAction.payload.keyboard) return;

  // One frame: lets appendAfterMove (reparent) and renderAfterMove (layout) finish first
  yield delay(16);

  const { elements, diagram }: ModelState = yield select();
  const ownersToRerender: string[] = [];

  for (const id of endAction.payload.ids) {
    const movedEl = elements[id];
    const origBounds = moveBoundsCache[id];
    delete moveBoundsCache[id];
    if (!movedEl || !origBounds) continue;

    const hasSiblingOverlap = Object.values(elements).some(
      (el) =>
        el.id !== id &&
        el.owner === movedEl.owner &&
        !('path' in el) && // exclude relationships
        boundsOverlap(movedEl.bounds, el.bounds),
    );

    if (hasSiblingOverlap) {
      yield put(UMLElementCommonRepository.update(id, { bounds: origBounds }));
      const owner = movedEl.owner || diagram.id;
      if (!ownersToRerender.includes(owner)) ownersToRerender.push(owner);
    }
  }

  for (const owner of ownersToRerender) {
    yield call(render, owner);
  }

  // After reverting overlapping elements, recalculate flows whose endpoints
  // were repositioned — render() alone does not update relationship geometry.
  if (ownersToRerender.length > 0) {
    const { elements: afterElements, diagram: afterDiagram }: ModelState = yield select();
    for (const relId of afterDiagram.ownedRelationships) {
      const rel = afterElements[relId] as IUMLRelationship | undefined;
      if (!rel || !UMLRelationship.isUMLRelationship(rel)) continue;
      if (!afterElements[rel.source.element] || !afterElements[rel.target.element]) continue;
      yield call(recalc, relId);
    }
  }
}

export function* UMLContainerSaga(): SagaIterator {
  yield run([append, remove, appendAfterMove, renderAfterMove, recordBoundsOnStart, revertOnSiblingOverlap]);
}

function* append(): SagaIterator {
  const action: AppendAction = yield take(UMLContainerActionTypes.APPEND);
  const { elements, diagram }: ModelState = yield select();
  const state: UMLElementState = { ...elements, [diagram.id]: diagram };
  const container = UMLContainerRepository.get(state[action.payload.owner]);

  if (!container) {
    return;
  }

  yield call(render, container.id);
}

function* remove(): SagaIterator {
  const action: RemoveAction = yield take(UMLContainerActionTypes.REMOVE);
  const layer: ILayer = yield getContext('layer');
  const { elements, diagram }: ModelState = yield select();
  const state: UMLElementState = { ...elements, [diagram.id]: diagram };
  const owners = [
    ...new Set(action.payload.ids.filter((id) => id in state).map((id) => state[id].owner || diagram.id)),
  ];

  for (const owner of owners) {
    yield call(render, owner);
  }

  // After container re-render (which repositions child elements like BPMN lanes),
  // relationships whose endpoints moved need their absolute canvas bounds refreshed.
  // The layoutElement saga handles most cases via MOVE events, but is fragile against
  // timing gaps (an error during an intermediate recalc restarts the saga after MOVE
  // events have already been dispatched and dropped). This explicit pass guarantees
  // correct flow positions on every deletion.
  if (owners.length > 0) {
    const { elements: afterElements, diagram: afterDiagram }: ModelState = yield select();
    for (const relId of afterDiagram.ownedRelationships) {
      const rel = afterElements[relId] as IUMLRelationship | undefined;
      if (!rel || !UMLRelationship.isUMLRelationship(rel)) continue;
      if (!afterElements[rel.source.element] || !afterElements[rel.target.element]) continue;
      yield call(recalc, relId);
    }
  }
}

function* appendAfterMove(): SagaIterator {
  const action: MoveEndAction = yield take(MovableActionTypes.END);
  const { elements, hovered }: ModelState = yield select();
  let containerID: string | null = null;

  if (hovered.length) {
    const container = elements[hovered[0]];
    if (
      !container ||
      !UMLContainer.isUMLContainer(container) ||
      !UMLElements[container.type as UMLElementType].features.droppable
    ) {
      return;
    }

    containerID = container.id;
  }

  const movedElements = action.payload.ids.filter((id) => elements[id].owner !== containerID && id !== containerID);
  if (!movedElements.length || action.payload.keyboard) {
    return;
  }

  // Don't reparent an element into a container of the same type
  // (e.g. BPMNPool dragged onto BPMNPool must stay at root level so
  // revertOnSiblingOverlap can detect the overlap and snap it back).
  const targetContainer = containerID ? elements[containerID] : null;
  if (targetContainer && movedElements.some((id) => elements[id]?.type === targetContainer.type)) {
    return;
  }

  yield put(UMLContainerRepository.remove(movedElements));
  yield put(UMLContainerRepository.append(movedElements, containerID || undefined));
}

function* renderAfterMove(): SagaIterator {
  const action: MoveEndAction = yield take(MovableActionTypes.END);
  const { elements, diagram }: ModelState = yield select();

  const state: UMLElementState = { ...elements, [diagram.id]: diagram };

  yield race({
    append: take(UMLContainerActionTypes.APPEND),
    resize: call(function* () {
      yield delay(0);

      const owners = [...new Set(action.payload.ids.map((id) => state[id].owner || diagram.id))];
      for (const owner of owners) {
        yield call(render, owner);
      }
    }),
  });
}
