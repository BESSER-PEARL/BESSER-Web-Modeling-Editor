import { DeepPartial } from 'redux';
import { DeploymentElementType, DeploymentRelationshipType } from '..';
import { ILayer } from '../../../services/layouter/layer';
import { ILayoutable } from '../../../services/layouter/layoutable';
import { IUMLElement, UMLElement } from '../../../services/uml-element/uml-element';
import * as Apollon from '../../../typings';
import { assign } from '../../../utils/fx/assign';
import { IBoundary } from '../../../utils/geometry/boundary';
import { calculateNameBounds } from '../../../utils/name-bounds';
import { UMLElementType } from '../../uml-element-type';

export class UMLDeploymentArtifact extends UMLElement {
  static supportedRelationships = [
    DeploymentRelationshipType.DeploymentDependency,
    DeploymentRelationshipType.DeploymentInterfaceProvided,
    DeploymentRelationshipType.DeploymentInterfaceRequired,
  ];
  type: UMLElementType = DeploymentElementType.DeploymentArtifact;
  bounds: IBoundary = { ...this.bounds, height: 40 };
  // Cross-diagram ids of the Components this artifact manifests
  // (BESSER `Artifact.manifests: List[str]`, UML 2.5 § 19.4).
  // Auto-populated by the Component→Deployment derivation; persisted here
  // so it survives the editor load/save round-trip.
  manifests: string[] = [];
  // UUID of the Agent diagram this artifact deploys, threaded from
  // the source Component's `agentModelRef`. BESSER reads it as
  // `Artifact.agent_model_ref` to bake the right BAF agent
  // into this artifact's build context. Optional, single (1:1 lane→agent link).
  agentModelRef?: string;

  constructor(values?: DeepPartial<IUMLElement>) {
    super();
    assign<IUMLElement>(this, values);
    this.bounds.height = (values && values.bounds && values.bounds.height) || 40;
  }

  serialize(): Apollon.UMLDeploymentArtifact {
    return {
      ...super.serialize(),
      type: this.type as keyof typeof DeploymentElementType,
      manifests: this.manifests,
      agentModelRef: this.agentModelRef,
    };
  }

  deserialize<T extends Apollon.UMLModelElement>(values: T, children?: Apollon.UMLModelElement[]): void {
    const assert = (v: Apollon.UMLModelElement): v is Apollon.UMLDeploymentArtifact =>
      v.type === DeploymentElementType.DeploymentArtifact;
    if (!assert(values)) {
      return;
    }

    super.deserialize(values, children);
    this.manifests = values.manifests ?? [];
    this.agentModelRef = values.agentModelRef;
  }

  render(layer: ILayer): ILayoutable[] {
    this.bounds.height = Math.max(this.bounds.height, 40);
    this.bounds = calculateNameBounds(this, layer);
    return [this];
  }
}
