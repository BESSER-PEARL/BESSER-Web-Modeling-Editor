import { BPMNElementType, BPMNRelationshipType } from '..';
import { ILayer } from '../../../services/layouter/layer';
import { ILayoutable } from '../../../services/layouter/layoutable';
import { UMLElementType } from '../../uml-element-type';
import { UMLContainer } from '../../../services/uml-container/uml-container';
import { DeepPartial } from 'redux';
import { assign } from '../../../utils/fx/assign';
import * as Apollon from '../../../typings';
import { BPMNMarkerType, BPMNReflectionMode, clampTrustScore } from '../common/types';

// Agentic-task layout reserves (px). Shared with bpmn-task-component.tsx so the
// model's height floor and the component's text layout agree.
//
// The name stays horizontally centred; it wraps within an inset width
// (SIDE_INSET on each side) so a *long* name can't slide under the top-left bot
// marker (x≈8..24) — short names are unaffected and the task never widens.
export const AGENTIC_TASK_LINE_HEIGHT = 16;
export const AGENTIC_TASK_CAP_HEIGHT = 11;
export const AGENTIC_TASK_SIDE_INSET = 26;
// Vertical: the name centres in [0, height - REFLECTION_RESERVE]. TOP_MARGIN +
// CAP_HEIGHT + (reflection ? REFLECTION_RESERVE : 0) is a fixed minimum height
// (not width-driven) so the bot and reflection markers always have room and
// setting a reflection mode bumps a short task a little taller — while agentic
// tasks otherwise resize like normal tasks.
export const AGENTIC_TASK_TOP_MARGIN = 28;
export const AGENTIC_TASK_REFLECTION_RESERVE = 28;

// A task that renders a top-left type icon (taskType !== 'default') wraps its
// centred name within an inset width (TASK_ICON_SIDE_INSET on each side) so a
// long name can't slide under the icon at (10,10). Plain default tasks stay
// full-width so short names don't needlessly break. 
export const TASK_ICON_SIDE_INSET = 26;

export type BPMNTaskType = 'default' | 'user' | 'service' | 'send' | 'receive' | 'manual' | 'business-rule' | 'script';

export class BPMNTask extends UMLContainer {
  static features = { ...UMLContainer.features, droppable: false };
  static defaultTaskType: BPMNTaskType = 'default';
  static defaultMarker: BPMNMarkerType = 'none';
  // Agentic BPMN: a task is marked agentic via `isAgentic` rather than a
  // separate element type. `reflectionMode` / `trustScore` are only meaningful
  // when set.
  static defaultReflectionMode: BPMNReflectionMode = 'none';
  static defaultTrustScore = 0;
  static supportedRelationships = [BPMNRelationshipType.BPMNFlow];

  type: UMLElementType = BPMNElementType.BPMNTask;
  taskType: BPMNTaskType;
  marker: BPMNMarkerType;
  isAgentic: boolean;
  reflectionMode: BPMNReflectionMode;
  trustScore: number;
  // forward link to the BESSER
  // Agent diagram that defines this task's internal agent behavior. Set
  // only when isAgentic === true and the user clicked "Define agent
  // behavior" on the popup. UUID-only; survives an isAgentic toggle off
  // (the popup hides the section but keeps the ref).
  agentDiagramRef?: string;
  // Reviewer lane UUID for cross-reflection (reflectionMode === 'cross').
  // Absent means the reviewer is unspecified (peer="reviewer" placeholder).
  reflectionReviewerLaneId?: string;

  constructor(values?: DeepPartial<BPMNTask>) {
    super(values);
    assign<BPMNTask>(this, values);
    this.taskType = values?.taskType || BPMNTask.defaultTaskType;
    this.marker = values?.marker || BPMNTask.defaultMarker;
    this.isAgentic = values?.isAgentic ?? false;
    this.reflectionMode = values?.reflectionMode || BPMNTask.defaultReflectionMode;
    this.trustScore = clampTrustScore(values?.trustScore ?? BPMNTask.defaultTrustScore);
    // Optional pass-through — undefined when not linked.
    this.agentDiagramRef = values?.agentDiagramRef ?? undefined;
    this.reflectionReviewerLaneId = values?.reflectionReviewerLaneId ?? undefined;
  }

  serialize(children?: UMLContainer[]): Apollon.BPMNTask {
    return {
      ...super.serialize(),
      type: this.type as keyof typeof BPMNElementType,
      taskType: this.taskType,
      marker: this.marker,
      isAgentic: this.isAgentic,
      reflectionMode: this.reflectionMode,
      trustScore: this.trustScore,
      agentDiagramRef: this.agentDiagramRef,
      reflectionReviewerLaneId: this.reflectionReviewerLaneId,
    };
  }

  deserialize<T extends Apollon.UMLModelElement>(
    values: T & {
      taskType?: BPMNTaskType;
      marker?: BPMNMarkerType;
      isAgentic?: boolean;
      reflectionMode?: BPMNReflectionMode;
      trustScore?: number;
      agentDiagramRef?: string;
      reflectionReviewerLaneId?: string;
    },
    children?: Apollon.UMLModelElement[],
  ): void {
    super.deserialize(values, children);
    this.taskType = values.taskType || BPMNTask.defaultTaskType;
    this.marker = values.marker || BPMNTask.defaultMarker;
    this.isAgentic = values.isAgentic ?? false;
    this.reflectionMode = values.reflectionMode || BPMNTask.defaultReflectionMode;
    this.trustScore = clampTrustScore(values.trustScore ?? BPMNTask.defaultTrustScore);
    this.agentDiagramRef = values.agentDiagramRef ?? undefined;
    this.reflectionReviewerLaneId = values.reflectionReviewerLaneId ?? undefined;
  }

  render(canvas: ILayer): ILayoutable[] {
    // Agentic tasks keep a fixed minimum height so the bot marker (top) and, when
    // a reflection mode is set, the reflection marker (bottom) have room —
    // setting a reflection mode bumps a short task a little taller. The floor is
    // NOT width-driven, so agentic tasks otherwise resize like normal tasks (no
    // height jump when narrowing); the name is centred and clears the bot
    // horizontally by wrapping (see bpmn-task-component). Never widens, never
    // shrinks below the floor.
    if (this.isAgentic) {
      const bottom = this.reflectionMode !== 'none' ? AGENTIC_TASK_REFLECTION_RESERVE : 0;
      const minHeight = AGENTIC_TASK_TOP_MARGIN + AGENTIC_TASK_CAP_HEIGHT + bottom;
      if (this.bounds.height < minHeight) {
        this.bounds = { ...this.bounds, height: minHeight };
      }
    }
    return [this];
  }
}
