import { BPMNElementType, BPMNRelationshipType } from '..';
import { ILayer } from '../../../services/layouter/layer';
import { ILayoutable } from '../../../services/layouter/layoutable';
import { UMLElementType } from '../../uml-element-type';
import { UMLContainer } from '../../../services/uml-container/uml-container';
import { DeepPartial } from 'redux';
import { assign } from '../../../utils/fx/assign';
import * as Apollon from '../../../typings';
import { BPMNMarkerType } from '../common/types';

// A task that renders a top-left type icon (taskType !== 'default') wraps its
// centred name within an inset width (TASK_ICON_SIDE_INSET on each side) so a
// long name can't slide under the icon at (10,10). Plain default tasks stay
// full-width so short names don't needlessly break. Ported (agentic bits
// stripped) from dev/agentic-swarm-connection's AGENTIC_TASK_SIDE_INSET. See
// guide 14.
export const TASK_ICON_SIDE_INSET = 26;

export type BPMNTaskType = 'default' | 'user' | 'service' | 'send' | 'receive' | 'manual' | 'business-rule' | 'script';

export class BPMNTask extends UMLContainer {
  static features = { ...UMLContainer.features, droppable: false };
  static defaultTaskType: BPMNTaskType = 'default';
  static defaultMarker: BPMNMarkerType = 'none';
  static supportedRelationships = [BPMNRelationshipType.BPMNFlow];

  type: UMLElementType = BPMNElementType.BPMNTask;
  taskType: BPMNTaskType;
  marker: BPMNMarkerType;

  constructor(values?: DeepPartial<BPMNTask>) {
    super(values);
    assign<BPMNTask>(this, values);
    this.taskType = values?.taskType || BPMNTask.defaultTaskType;
    this.marker = values?.marker || BPMNTask.defaultMarker;
  }

  serialize(children?: UMLContainer[]): Apollon.BPMNTask {
    return {
      ...super.serialize(),
      type: this.type as keyof typeof BPMNElementType,
      taskType: this.taskType,
      marker: this.marker,
    };
  }

  deserialize<T extends Apollon.UMLModelElement>(
    values: T & { taskType?: BPMNTaskType; marker?: BPMNMarkerType },
    children?: Apollon.UMLModelElement[],
  ): void {
    super.deserialize(values, children);
    this.taskType = values.taskType || BPMNTask.defaultTaskType;
    this.marker = values.marker || BPMNTask.defaultMarker;
  }

  render(canvas: ILayer): ILayoutable[] {
    return [this];
  }
}
