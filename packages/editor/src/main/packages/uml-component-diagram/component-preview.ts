import { ILayer } from '../../services/layouter/layer';
import { UMLElement } from '../../services/uml-element/uml-element';
import { ComposePreview, PreviewElement } from '../compose-preview';
import { UMLComponentInterface } from './uml-component-interface/uml-component-interface';
import { UMLComponentComponent } from './uml-component/uml-component-component';
import { UMLSubsystem } from './uml-component-subsystem/uml-component-subsystem';

export const composeComponentPreview: ComposePreview = (
  layer: ILayer,
): PreviewElement[] => {
  const elements: PreviewElement[] = [];

  // UML Component
  const umlComponent = new UMLComponentComponent({ name: 'Component' });
  umlComponent.bounds = {
    ...umlComponent.bounds,
    width: umlComponent.bounds.width,
    height: umlComponent.bounds.height,
  };
  elements.push(umlComponent);

  // UML Subsystem
  const umlSubsystem = new UMLSubsystem({ name: 'Subsystem' });
  umlSubsystem.bounds = {
    ...umlSubsystem.bounds,
    width: umlSubsystem.bounds.width,
    height: umlSubsystem.bounds.height,
  };
  elements.push(umlSubsystem);

  // UML Component Interface
  const umlComponentInterface = new UMLComponentInterface({
    name: 'Component Interface',
  });
  umlComponentInterface.bounds = {
    ...umlComponentInterface.bounds,
    width: umlComponentInterface.bounds.width,
    height: umlComponentInterface.bounds.height,
  };
  const [umlInterface] = umlComponentInterface.render(layer) as [PreviewElement];
  umlInterface.styles = { paddingTop: 8 };
  elements.push(umlInterface);

  return elements;
};
