import { SagaIterator } from 'redux-saga';
import { put, select, take } from 'redux-saga/effects';
import { run } from '../../../utils/actions/sagas';
import { ModelState } from '../../../components/store/model-state';
import { UMLDiagramType } from '../../diagram-type';
import {
  ReconnectableActionTypes,
  ReconnectAction,
} from '../../../services/uml-relationship/reconnectable/reconnectable-types';
import { UMLElementRepository } from '../../../services/uml-element/uml-element-repository';
import { BPMNFlow } from './bpmn-flow';
import { canSourceCarryDefault } from './bpmn-flow-validator';

/**
 * BPMN 2.0.2 § 8.3.13: a default outgoing sequence flow's source must be an
 * Exclusive/Inclusive/Complex gateway or an Activity. The popup handlers
 * (04A1 Steps 4·c / 4·d) cover gateway-type change and flow flip; this saga
 * covers the third path — dragging a flow's source endpoint onto a node that
 * cannot carry a default. Mirrors the `run([...])` pattern of UMLRelationshipSaga.
 */
export function* BPMNFlowDefaultSaga(): SagaIterator {
  yield run([clearDefaultOnReconnect]);
}

function* clearDefaultOnReconnect(): SagaIterator {
  const action: ReconnectAction = yield take(ReconnectableActionTypes.RECONNECT);
  const { elements, diagram }: ModelState = yield select();

  // Guard: BPMN diagrams only — every other diagram type is untouched.
  if (diagram.type !== UMLDiagramType.BPMN) {
    return;
  }

  for (const connection of action.payload.connections) {
    const flow = elements[connection.id] as unknown as BPMNFlow | undefined;
    if (!flow || flow.type !== 'BPMNFlow' || !flow.isDefault) {
      continue;
    }
    const source = elements[connection.source.element];
    if (!canSourceCarryDefault(source)) {
      yield put(UMLElementRepository.update<BPMNFlow>(connection.id, { isDefault: false }));
    }
  }
}
