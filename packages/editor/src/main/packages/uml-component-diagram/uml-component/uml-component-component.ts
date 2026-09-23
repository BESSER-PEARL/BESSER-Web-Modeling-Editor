import { ComponentElementType, ComponentRelationshipType } from '..';
import { IUMLComponent, UMLComponent } from '../../common/uml-component/uml-component';
import { DeepPartial } from 'redux';
import * as Apollon from '../../../typings';
import { assign } from '../../../utils/fx/assign';

export class UMLComponentComponent extends UMLComponent {
  static supportedRelationships = [
    ComponentRelationshipType.ComponentDependency,
    ComponentRelationshipType.ComponentInterfaceProvided,
    ComponentRelationshipType.ComponentInterfaceRequired,
  ];
  type = ComponentElementType.Component;
  // Agent-diagram UUID this agent-Component is defined by
  // (from the source lane's `agentDiagramRef`). Optional, single (1:1 link).
  agentModelRef?: string;

  constructor(values?: DeepPartial<IUMLComponent>) {
    super();
    assign<IUMLComponent>(this, values);
  }

  serialize(): Apollon.UMLComponentComponent {
    return {
      ...super.serialize(),
      type: this.type as keyof typeof ComponentElementType,
      stereotype: this.stereotype,
      displayStereotype: this.displayStereotype,
      realizes: this.realizes,
      processModelRefs: this.processModelRefs,
      agentModelRef: this.agentModelRef,
    };
  }

  deserialize<T extends Apollon.UMLModelElement>(values: T, children?: Apollon.UMLModelElement[]): void {
    const assert = (v: Apollon.UMLModelElement): v is Apollon.UMLComponentComponent =>
      v.type === ComponentElementType.Component;
    if (!assert(values)) {
      return;
    }

    super.deserialize(values, children);
    this.stereotype = values.stereotype;
    this.displayStereotype = values.displayStereotype;
    this.realizes = values.realizes ?? [];
    this.processModelRefs = values.processModelRefs ?? [];
    this.agentModelRef = values.agentModelRef;
  }
}
