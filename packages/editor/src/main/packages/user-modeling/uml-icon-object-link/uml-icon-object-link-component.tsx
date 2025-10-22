import React, { FunctionComponent } from 'react';
import { UMLIconObjectLink } from './uml-icon-object-link';
import { ThemedPolyline } from '../../../components/theme/themedComponents';

// here is to change the style of connections in iconobjectlink
export const UMLIconObjectLinkComponent: FunctionComponent<Props> = ({ element }) => (
  <g>
    <ThemedPolyline
      points={element.path.map((point) => `${point.x} ${point.y}`).join(',')}
      strokeColor={element.strokeColor}
      fillColor="none"
      strokeWidth={3}
    />
  </g>
);

interface Props {
  element: UMLIconObjectLink;
}
