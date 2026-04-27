import React, { FunctionComponent } from 'react';
import { ThemedPolyline } from '../../../../components/theme/themedComponents';

export const BPMNServiceIcon: FunctionComponent<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg {...props} height={20} width={20}>
    <ThemedPolyline
      points={'10 2, 13 6, 17 6, 15 10, 17 14, 13 14, 10 18, 7 14, 3 14, 5 10, 3 6, 7 6, 10 2'}
      strokeLinecap="round"
      strokeLinejoin="round"
      fillColor="transparent"
    />
  </svg>
);
