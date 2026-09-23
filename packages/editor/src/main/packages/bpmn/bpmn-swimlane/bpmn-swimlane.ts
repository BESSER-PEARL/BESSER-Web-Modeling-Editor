import { DeepPartial } from 'redux';
import { BPMNElementType } from '..';
import { UMLElementType } from '../../uml-element-type';
import { UMLElementFeatures } from '../../../services/uml-element/uml-element-features';
import { UMLElement } from '../../../services/uml-element/uml-element';
import { ILayer } from '../../../services/layouter/layer';
import { ILayoutable } from '../../../services/layouter/layoutable';
import { UMLContainer } from '../../../services/uml-container/uml-container';
import { assign } from '../../../utils/fx/assign';
import * as Apollon from '../../../typings';
import { BPMNAgentRole, clampTrustScore, clampMultiplicity, migrateLegacyRole } from '../common/types';

export class BPMNSwimlane extends UMLContainer {
  static DEFAULT_HEIGHT = 80;
  static MIN_WIDTH = 80;
  static MIN_HEIGHT = 80;

  // Header strip widths (canvas coordinates within the lane). Children must
  // have bounds.x >= lane.bounds.x + LANE_HEADER_WIDTH so the rotated lane
  // name + (when agentic) bot icon / role letter / trust score stay readable.
  // Right-edge anchors live in bpmn-swimlane-component.tsx — update both
  // together if the marker layout changes.
  static LANE_HEADER_WIDTH = 30;
  static AGENTIC_LANE_HEADER_WIDTH = 60;

  // Agentic BPMN (04D): a lane is marked agentic via `isAgentic` rather than a
  // separate element type. `role` / `trustScore` are only meaningful when set.
  static defaultRole: BPMNAgentRole = 'solution';
  static defaultTrustScore = 0;
  static defaultMultiplicity = 1;

  static features: UMLElementFeatures = {
    ...UMLElement.features,
    droppable: true,
    movable: false,
    connectable: false,
    // updatable so a double-click opens the lane popup (name + agentic toggle).
    updatable: true,
    resizable: 'HEIGHT',
  };

  type: UMLElementType = BPMNElementType.BPMNSwimlane;
  isAgentic: boolean;
  role: BPMNAgentRole;
  trustScore: number;
  // Swarm size: N identical copies of this agent.
  // Only meaningful when isAgentic; default 1. [[swarm-multiplicity-semantics]]
  multiplicity: number;
  // Forward link to the BESSER Agent diagram that defines this lane's
  // agent. Set only when isAgentic === true and the user has clicked
  // "Define BESSER agent" on the popup. UUID-only — the title side is
  // cosmetic. Survives an isAgentic toggle off; the popup hides the
  // section but keeps the ref.
  agentDiagramRef?: string;

  constructor(values?: DeepPartial<BPMNSwimlane>) {
    super(values);
    assign<BPMNSwimlane>(this, values);
    this.isAgentic = values?.isAgentic ?? false;
    this.role = migrateLegacyRole(values?.role as string | undefined);
    this.trustScore = clampTrustScore(values?.trustScore ?? BPMNSwimlane.defaultTrustScore);
    this.multiplicity = clampMultiplicity(values?.multiplicity ?? BPMNSwimlane.defaultMultiplicity);
    this.agentDiagramRef = values?.agentDiagramRef ?? undefined;
  }

  serialize(children?: UMLContainer[]): Apollon.BPMNSwimlane {
    return {
      ...super.serialize(children),
      type: this.type as keyof typeof BPMNElementType,
      isAgentic: this.isAgentic,
      role: this.role,
      trustScore: this.trustScore,
      multiplicity: this.multiplicity,
      agentDiagramRef: this.agentDiagramRef,
    };
  }

  deserialize<T extends Apollon.UMLModelElement>(
    values: T & {
      isAgentic?: boolean;
      role?: BPMNAgentRole | 'supervisor' | 'worker' | 'manager';
      trustScore?: number;
      multiplicity?: number;
      agentDiagramRef?: string;
    },
    children?: Apollon.UMLModelElement[],
  ): void {
    super.deserialize(values, children);
    this.isAgentic = values.isAgentic ?? false;
    // Legacy diagrams carry 'worker' / 'manager'; migrate to the
    // four-token vocabulary on load. Cast to string first — `values.role` is
    // typed `BPMNAgentRole | undefined`, which TS narrows to the *new* union.
    this.role = migrateLegacyRole(values.role as string | undefined);
    this.trustScore = clampTrustScore(values.trustScore ?? BPMNSwimlane.defaultTrustScore);
    this.multiplicity = clampMultiplicity(values.multiplicity ?? BPMNSwimlane.defaultMultiplicity);
    this.agentDiagramRef = values.agentDiagramRef ?? undefined;
  }

  render(layer: ILayer, children: ILayoutable[] = []): ILayoutable[] {
    if (this.bounds.width < BPMNSwimlane.MIN_WIDTH) {
      this.bounds.width = BPMNSwimlane.MIN_WIDTH;
    }

    if (this.bounds.height < BPMNSwimlane.MIN_HEIGHT) {
      this.bounds.height = BPMNSwimlane.MIN_HEIGHT;
    }
    // Keep child elements out of the header strip so the lane name stays
    // readable. Children whose left edge would land inside the header are
    // snapped to the body's left edge on the next layout pass.
    const minChildX = this.bounds.x + BPMNSwimlane.LANE_HEADER_WIDTH;
    for (const child of children) {
      if (child === this) continue;
      if (child.bounds.x < minChildX) {
        child.bounds.x = minChildX;
      }
    }
    return [this, ...children];
  }
}
