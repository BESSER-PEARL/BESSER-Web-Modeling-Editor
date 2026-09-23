import { BPMNElementType, BPMNRelationshipType } from '..';
import { ILayer } from '../../../services/layouter/layer';
import { ILayoutable } from '../../../services/layouter/layoutable';
import { UMLElementType } from '../../uml-element-type';
import { UMLElementFeatures } from '../../../services/uml-element/uml-element-features';
import { IBoundary } from '../../../utils/geometry/boundary';
import { DeepPartial } from 'redux';
import { assign } from '../../../utils/fx/assign';
import * as Apollon from '../../../typings';
import { UMLContainer } from '../../../services/uml-container/uml-container';
import { BPMNGatewayRole, clampTrustScore } from '../common/types';

export type BPMNGatewayType = 'complex' | 'event-based' | 'exclusive' | 'inclusive' | 'parallel';

// Agentic BPMN (SEAA'25 § 4.3): collaboration constructs only attach to
// AgenticOR (inclusive) and AgenticAND (parallel) gateways. Exclusive is
// excluded by the paper; complex / event-based are not in the paper.
export const AGENTIC_ELIGIBLE_GATEWAY_TYPES: ReadonlySet<BPMNGatewayType> = new Set<BPMNGatewayType>([
  'parallel',
  'inclusive',
]);

export class BPMNGateway extends UMLContainer {
  static features: UMLElementFeatures = { ...UMLContainer.features, resizable: false, droppable: false };
  static defaultGatewayType: BPMNGatewayType = 'exclusive';
  static supportedRelationships = [BPMNRelationshipType.BPMNFlow];

  // Agentic BPMN defaults — only meaningful when isAgentic.
  static defaultGatewayRole: BPMNGatewayRole = 'diverging';
  static defaultTrustScore = 0;

  type: UMLElementType = BPMNElementType.BPMNGateway;
  bounds: IBoundary = { ...this.bounds, width: 40, height: 40 };
  gatewayType: BPMNGatewayType;
  isAgentic: boolean;
  gatewayRole: BPMNGatewayRole;
  trustScore: number;
  // Governance DSL. Optional, free-text. Only set on
  // merging gateways; undefined = "not authored". Generated from the
  // collaboration block (see common/governance-dsl.ts), then user-editable.
  governanceDsl?: string;

  constructor(values?: DeepPartial<BPMNGateway>) {
    super(values);
    assign<BPMNGateway>(this, values);
    this.gatewayType = values?.gatewayType || BPMNGateway.defaultGatewayType;
    this.isAgentic = values?.isAgentic ?? false;
    this.gatewayRole = values?.gatewayRole ?? BPMNGateway.defaultGatewayRole;
    this.trustScore = clampTrustScore(values?.trustScore ?? BPMNGateway.defaultTrustScore);
    this.governanceDsl = values?.governanceDsl;
  }

  serialize(children?: UMLContainer[]): Apollon.BPMNGateway {
    return {
      ...super.serialize(),
      type: this.type as keyof typeof BPMNElementType,
      gatewayType: this.gatewayType,
      isAgentic: this.isAgentic,
      gatewayRole: this.gatewayRole,
      trustScore: this.trustScore,
      governanceDsl: this.governanceDsl,
    };
  }

  deserialize<T extends Apollon.UMLModelElement>(
    values: T & {
      gatewayType?: BPMNGatewayType;
      isAgentic?: boolean;
      gatewayRole?: BPMNGatewayRole;
      trustScore?: number;
      governanceDsl?: string;
    },
    children?: Apollon.UMLModelElement[],
  ): void {
    super.deserialize(values, children);
    this.gatewayType = values.gatewayType || BPMNGateway.defaultGatewayType;
    this.isAgentic = values.isAgentic ?? false;
    this.gatewayRole = values.gatewayRole ?? BPMNGateway.defaultGatewayRole;
    this.trustScore = clampTrustScore(values.trustScore ?? BPMNGateway.defaultTrustScore);
    this.governanceDsl = values.governanceDsl;
  }

  render(canvas: ILayer): ILayoutable[] {
    return [this];
  }
}
