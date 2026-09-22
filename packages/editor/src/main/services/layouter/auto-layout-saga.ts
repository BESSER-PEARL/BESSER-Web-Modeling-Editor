import { SagaIterator } from 'redux-saga';
import { call, put, select, take } from 'redux-saga/effects';
import { ModelState } from '../../components/store/model-state';
import { UMLDiagramType } from '../../packages/diagram-type';
import { run } from '../../utils/actions/sagas';
import { MoveAction, MovingActionTypes } from '../uml-element/movable/moving-types';
import { UMLElement } from '../uml-element/uml-element';
import { IUMLRelationship, UMLRelationship } from '../uml-relationship/uml-relationship';
import { AutoLayoutActionTypes } from './auto-layout-types';
import { computeElkLayout, ElkLayoutResult, LayoutEdge, LayoutNode, LayoutPosition } from './elk-layouter';
import { LayouterRepository } from './layouter-repository';

export function* AutoLayouter() {
  yield run([autoLayout]);
}

function* autoLayout(): SagaIterator {
  yield take(AutoLayoutActionTypes.AUTO_LAYOUT);
  const { elements, diagram }: ModelState = yield select();

  // Only class diagrams are supported for now.
  if (diagram.type !== UMLDiagramType.ClassDiagram) {
    return;
  }

  const nodes: LayoutNode[] = diagram.ownedElements
    .map((id) => elements[id])
    .filter((element) => Boolean(element) && UMLElement.isUMLElement(element))
    .map((element) => ({ id: element.id, width: element.bounds.width, height: element.bounds.height }));

  if (!nodes.length) {
    return;
  }

  const edges: LayoutEdge[] = diagram.ownedRelationships
    .map((id) => elements[id] as IUMLRelationship | undefined)
    .filter((rel): rel is IUMLRelationship => Boolean(rel && UMLRelationship.isUMLRelationship(rel) && rel.source && rel.target))
    .map((rel) => ({ id: rel.id, sourceId: rel.source.element, targetId: rel.target.element }));

  // The interactive layouter only needs node positions here; it re-routes
  // relationships through the editor's own layouter saga below.
  const { nodes: positions }: ElkLayoutResult = yield call(computeElkLayout, nodes, edges);
  if (!positions.length) {
    return;
  }

  // Recenter the ELK result onto the diagram's current center so the layout
  // stays where the user already had it (ELK emits coordinates from ~origin).
  const sizeById = new Map(nodes.map((node) => [node.id, node]));
  const offset = recenterOffset(positions, sizeById, elements);

  for (const position of positions) {
    const element = elements[position.id];
    if (!element) {
      continue;
    }
    const delta = {
      x: position.x + offset.x - element.bounds.x,
      y: position.y + offset.y - element.bounds.y,
    };
    if (delta.x === 0 && delta.y === 0) {
      continue;
    }
    yield put<MoveAction>({
      type: MovingActionTypes.MOVE,
      payload: { ids: [position.id], delta },
      undoable: false,
    });
  }

  // Re-route relationships and reflow class members to the new positions.
  yield put(LayouterRepository.layout());
}

/** Offset that maps the ELK layout's bounding-box center onto the diagram's current center. */
function recenterOffset(
  positions: LayoutPosition[],
  sizeById: Map<string, LayoutNode>,
  elements: ModelState['elements'],
): { x: number; y: number } {
  let newMinX = Infinity;
  let newMinY = Infinity;
  let newMaxX = -Infinity;
  let newMaxY = -Infinity;
  let curMinX = Infinity;
  let curMinY = Infinity;
  let curMaxX = -Infinity;
  let curMaxY = -Infinity;

  for (const position of positions) {
    const size = sizeById.get(position.id);
    const current = elements[position.id];
    if (!size || !current) {
      continue;
    }
    newMinX = Math.min(newMinX, position.x);
    newMinY = Math.min(newMinY, position.y);
    newMaxX = Math.max(newMaxX, position.x + size.width);
    newMaxY = Math.max(newMaxY, position.y + size.height);
    curMinX = Math.min(curMinX, current.bounds.x);
    curMinY = Math.min(curMinY, current.bounds.y);
    curMaxX = Math.max(curMaxX, current.bounds.x + current.bounds.width);
    curMaxY = Math.max(curMaxY, current.bounds.y + current.bounds.height);
  }

  if (!Number.isFinite(newMinX) || !Number.isFinite(curMinX)) {
    return { x: 0, y: 0 };
  }

  const newCenter = { x: (newMinX + newMaxX) / 2, y: (newMinY + newMaxY) / 2 };
  const curCenter = { x: (curMinX + curMaxX) / 2, y: (curMinY + curMaxY) / 2 };
  return { x: curCenter.x - newCenter.x, y: curCenter.y - newCenter.y };
}
