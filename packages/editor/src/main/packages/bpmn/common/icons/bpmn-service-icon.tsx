import React, { FunctionComponent } from 'react';
import { ThemedCircle, ThemedPath } from '../../../../components/theme/themedComponents';

// BPMN 2.0.2 § 10.2.3.1 (Figure 10.11, p. 158): the Service-Task marker is a
// gear/cog. 8-tooth gear outline + hub hole, centred in the 20x20 box. Stroke
// from theme (ThemedPath / ThemedCircle), transparent fill — matches the
// outline style of the other task-type icons.
export const BPMNServiceIcon: FunctionComponent<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg {...props} height={20} width={20}>
    <ThemedPath
      d={
        'M 7.47 3.9 L 8.44 1.14 L 11.56 1.14 L 12.53 3.9 L 15.16 2.63 L 17.37 4.84 ' +
        'L 16.1 7.47 L 18.86 8.44 L 18.86 11.56 L 16.1 12.53 L 17.37 15.16 L 15.16 17.37 ' +
        'L 12.53 16.1 L 11.56 18.86 L 8.44 18.86 L 7.47 16.1 L 4.84 17.37 L 2.63 15.16 ' +
        'L 3.9 12.53 L 1.14 11.56 L 1.14 8.44 L 3.9 7.47 L 2.63 4.84 L 4.84 2.63 Z'
      }
      strokeLinejoin="round"
      fillColor="transparent"
    />
    <ThemedCircle cx="10" cy="10" r={2.7} fillColor="transparent" />
  </svg>
);
