import React, { FunctionComponent } from 'react';
import { ThemedPolyline } from '../../../../components/theme/themedComponents';

export const BPMNCompensationIcon: FunctionComponent<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg {...props} height={20} width={20}>
    <ThemedPolyline
      points={'3 10, 9 6, 9 14, 3 10'}
      strokeLinecap="round"
      strokeLinejoin="round"
      fillColor="transparent"
      fillRule="evenodd"
    />
    <ThemedPolyline
      points={'10 10, 16 6, 16 14, 10 10'}
      strokeLinecap="round"
      strokeLinejoin="round"
      fillColor="transparent"
      fillRule="evenodd"
    />
  </svg>
);
