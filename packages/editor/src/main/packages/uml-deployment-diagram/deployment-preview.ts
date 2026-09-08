import { ILayer } from '../../services/layouter/layer';
import { UMLElement } from '../../services/uml-element/uml-element';
import { ComposePreview } from '../compose-preview';
import { UMLDeploymentArtifact } from './uml-deployment-artifact/uml-deployment-artifact';
import { UMLDeploymentNode } from './uml-deployment-node/uml-deployment-node';
import { UMLDeploymentInterface } from './uml-deployment-interface/uml-component-interface';
import { UMLDeploymentComponent } from './uml-deployment-component/uml-component';

export const composeDeploymentPreview: ComposePreview = (
  layer: ILayer,
): UMLElement[] => {
  const elements: UMLElement[] = [];

  // UML Deployment Node
  const umlDeploymentNode = new UMLDeploymentNode({ name: 'Deployment Node' });
  umlDeploymentNode.bounds = {
    ...umlDeploymentNode.bounds,
    width: umlDeploymentNode.bounds.width,
    height: umlDeploymentNode.bounds.height,
  };
  elements.push(umlDeploymentNode);

  // UML Component
  const umlComponent = new UMLDeploymentComponent({
    name: 'Deployment Component',
  });
  umlComponent.bounds = {
    ...umlComponent.bounds,
    width: umlComponent.bounds.width,
    height: umlComponent.bounds.height,
  };
  elements.push(umlComponent);

  // UML Deployment Artifact
  const umlDeploymentArtifact = new UMLDeploymentArtifact({
    name: 'Deployment Artifact',
  });
  umlDeploymentArtifact.bounds = {
    ...umlDeploymentArtifact.bounds,
    width: umlDeploymentArtifact.bounds.width,
  };
  elements.push(umlDeploymentArtifact);

  // UML Deployment Interface
  const umlDeploymentInterface = new UMLDeploymentInterface({
    name: 'Deployment Interface',
  });
  umlDeploymentInterface.bounds = {
    ...umlDeploymentInterface.bounds,
    width: umlDeploymentInterface.bounds.width,
    height: umlDeploymentInterface.bounds.height,
  };
  elements.push(umlDeploymentInterface);

  return elements;
};
