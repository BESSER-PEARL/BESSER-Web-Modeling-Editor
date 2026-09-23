import { DeepPartial } from 'redux';
import { ComponentRelationshipType } from '..';
import { UMLDependency } from '../../common/uml-dependency/uml-component-dependency';
import { IUMLRelationship } from '../../../services/uml-relationship/uml-relationship';
import * as Apollon from '../../../typings';
import { assign } from '../../../utils/fx/assign';

export interface IUMLComponentDependency extends IUMLRelationship {
  stereotype?: string;
}

export class UMLComponentDependency extends UMLDependency implements IUMLComponentDependency {
  type = ComponentRelationshipType.ComponentDependency;
  stereotype?: string;

  constructor(values?: DeepPartial<IUMLComponentDependency>) {
    super();
    assign<IUMLComponentDependency>(this, values);
  }

  serialize(): Apollon.UMLComponentDependency {
    return {
      ...super.serialize(),
      type: this.type,
      stereotype: this.stereotype,
    };
  }

  deserialize<T extends Apollon.UMLModelElement>(values: T): void {
    super.deserialize(values);
    const assert = (v: Apollon.UMLModelElement): v is Apollon.UMLComponentDependency =>
      v.type === ComponentRelationshipType.ComponentDependency;
    if (!assert(values)) {
      return;
    }
    this.stereotype = values.stereotype;
  }
}
