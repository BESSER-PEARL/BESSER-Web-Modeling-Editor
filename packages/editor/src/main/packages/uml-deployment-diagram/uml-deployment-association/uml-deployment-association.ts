import { DeepPartial } from 'redux';
import { DeploymentRelationshipType } from '..';
import { UMLRelationshipCenteredDescription } from '../../../services/uml-relationship/uml-relationship-centered-description';
import { IUMLRelationship } from '../../../services/uml-relationship/uml-relationship';
import * as Apollon from '../../../typings';
import { assign } from '../../../utils/fx/assign';

export interface IUMLDeploymentAssociation extends IUMLRelationship {
  stereotype?: string;
}

export class UMLDeploymentAssociation extends UMLRelationshipCenteredDescription implements IUMLDeploymentAssociation {
  type = DeploymentRelationshipType.DeploymentAssociation;
  stereotype?: string;

  constructor(values?: DeepPartial<IUMLDeploymentAssociation>) {
    super();
    assign<IUMLDeploymentAssociation>(this, values);
  }

  serialize(): Apollon.UMLDeploymentAssociation {
    return {
      ...super.serialize(),
      type: this.type,
      stereotype: this.stereotype,
    };
  }

  deserialize<T extends Apollon.UMLModelElement>(values: T): void {
    super.deserialize(values);
    const assert = (v: Apollon.UMLModelElement): v is Apollon.UMLDeploymentAssociation =>
      v.type === DeploymentRelationshipType.DeploymentAssociation;
    if (!assert(values)) {
      return;
    }
    this.stereotype = values.stereotype;
  }
}
