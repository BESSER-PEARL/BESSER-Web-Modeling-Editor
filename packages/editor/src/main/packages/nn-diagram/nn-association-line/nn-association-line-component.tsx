import React, { FunctionComponent } from 'react';
import { UMLAssociation } from '../../common/uml-association/uml-association';
import { ThemedPolyline } from '../../../components/theme/themedComponents';

interface Props {
  element: UMLAssociation;
}

export const NNAssociationLineComponent: FunctionComponent<Props> = ({ element }) => (
  <g>
    <ThemedPolyline
      points={element.path.map((point) => `${point.x} ${point.y}`).join(',')}
      strokeColor={element.strokeColor}
      fillColor="none"
      strokeWidth={1}
    />
  </g>
);