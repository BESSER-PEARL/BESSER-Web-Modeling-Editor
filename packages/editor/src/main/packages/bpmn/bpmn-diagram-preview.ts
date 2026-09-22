import { ILayer } from '../../services/layouter/layer';
import { IBoundary } from '../../utils/geometry/boundary';
import { ComposePreview, PreviewElement } from '../compose-preview';
import { BPMNTask } from './bpmn-task/bpmn-task';
import { BPMNSubprocess } from './bpmn-subprocess/bpmn-subprocess';
import { BPMNStartEvent } from './bpmn-start-event/bpmn-start-event';
import { BPMNIntermediateEvent } from './bpmn-intermediate-event/bpmn-intermediate-event';
import { BPMNEndEvent } from './bpmn-end-event/bpmn-end-event';
import { BPMNGateway } from './bpmn-gateway/bpmn-gateway';
import { BPMNTransaction } from './bpmn-transaction/bpmn-transaction';
import { BPMNCallActivity } from './bpmn-call-activity/bpmn-call-activity';
import { BPMNAnnotation } from './bpmn-annotation/bpmn-annotation';
import { BPMNPool } from './bpmn-pool/bpmn-pool';
import { BPMNDataObject } from './bpmn-data-object/bpmn-data-object';
import { BPMNGroup } from './bpmn-group/bpmn-group';
import { BPMNDataStore } from './bpmn-data-store/bpmn-data-store';
import { BPMNSwimlane } from './bpmn-swimlane/bpmn-swimlane';

export const composeBPMNPreview: ComposePreview = (
  layer: ILayer,
  translate?: (id: string) => string,
): PreviewElement[] => {
  const elements: PreviewElement[] = [];
  const defaultBounds: IBoundary = { x: 0, y: 0, width: 160, height: 60 };
  const t = translate || ((id: string) => id.split('.').pop() || '');

  elements.push(
    new BPMNTask({
      name: t('packages.BPMNDiagram.BPMNTask'),
      bounds: defaultBounds,
    }),
  );

  elements.push(
    new BPMNSubprocess({
      name: t('packages.BPMNDiagram.BPMNSubprocess'),
      bounds: defaultBounds,
    }),
  );

  elements.push(
    new BPMNTransaction({
      name: t('packages.BPMNDiagram.BPMNTransaction'),
      bounds: defaultBounds,
    }),
  );

  elements.push(
    new BPMNCallActivity({
      name: t('packages.BPMNDiagram.BPMNCallActivity'),
      bounds: defaultBounds,
    }),
  );

  elements.push(
    new BPMNGroup({
      bounds: defaultBounds,
    }),
  );

  elements.push(
    new BPMNAnnotation({
      name: t('packages.BPMNDiagram.BPMNAnnotation'),
      bounds: defaultBounds,
    }),
  );

  elements.push(
    new BPMNStartEvent({
      bounds: { x: 0, y: 0, width: 40, height: 40 },
    }),
  );

  elements.push(
    new BPMNIntermediateEvent({
      bounds: { x: 0, y: 0, width: 40, height: 40 },
    }),
  );

  elements.push(
    new BPMNEndEvent({
      bounds: { x: 0, y: 0, width: 40, height: 40 },
    }),
  );

  elements.push(
    new BPMNGateway({
      bounds: { x: 0, y: 0, width: 40, height: 40 },
    }),
  );

  elements.push(
    new BPMNDataObject({
      bounds: { x: 0, y: 0, width: 40, height: 60 },
    }),
  );

  elements.push(
    new BPMNDataStore({
      bounds: { x: 0, y: 0, width: 60, height: 60 },
    }),
  );

  elements.push(
    new BPMNPool({
      name: t('packages.BPMNDiagram.BPMNPool'),
      bounds: { x: 0, y: 0, width: 160, height: 80 },
    }),
  );

  elements.push(
    new BPMNSwimlane({
      name: t('packages.BPMNDiagram.BPMNSwimlane'),
      bounds: { x: 0, y: 0, width: 160, height: 80 },
    }),
  );

  return elements;
};
