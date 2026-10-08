import React, { FunctionComponent } from 'react';
import { Text } from '../../../components/controls/text/text';
import { UMLDeploymentAssociation } from './uml-deployment-association';
import { ThemedPolyline } from '../../../components/theme/themedComponents';
import { relationshipMidpoint, relationshipLabelLayout } from '../../common/relationship-label/relationship-midpoint';

export const UMLDeploymentAssociationComponent: FunctionComponent<Props> = ({ element }) => {
  const { position, direction } = relationshipMidpoint(element.path);
  const layout = relationshipLabelLayout(direction);
  const { stereotype } = element;

  return (
    <g>
      <ThemedPolyline
        points={element.path.map((point) => `${point.x} ${point.y}`).join(',')}
        strokeColor={element.strokeColor}
        fillColor="none"
        strokeWidth={1}
      />
      {stereotype && (
        <Text
          fill={element.textColor}
          x={position.x}
          y={element.name ? position.y - 12 : position.y}
          {...layout}
          pointerEvents="none"
          fontSize="85%"
        >
          {`«${stereotype}»`}
        </Text>
      )}
      <Text fill={element.textColor} x={position.x} y={position.y} {...layout} pointerEvents="none">
        {element.name}
      </Text>
    </g>
  );
};

interface Props {
  element: UMLDeploymentAssociation;
}
