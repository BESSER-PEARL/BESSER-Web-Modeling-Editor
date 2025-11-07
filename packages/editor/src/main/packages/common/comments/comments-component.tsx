import React, { FunctionComponent } from 'react';
import { Multiline } from '../../../utils/svg/multiline';
import { Comments } from './comments';
import { ThemedPath } from '../../../components/theme/themedComponents';

export const CommentsComponent: FunctionComponent<Props> = ({ element, fillColor }) => {
  const cornerRadius = 8;
  const pointerWidth = 12;
  const pointerHeight = 10;
  
  return (
    <g>
      {/* Main comment bubble body with rounded corners */}
      <ThemedPath
        d={`
          M ${cornerRadius} 0
          L ${element.bounds.width - cornerRadius} 0
          Q ${element.bounds.width} 0 ${element.bounds.width} ${cornerRadius}
          L ${element.bounds.width} ${element.bounds.height - cornerRadius - pointerHeight}
          Q ${element.bounds.width} ${element.bounds.height - pointerHeight} ${element.bounds.width - cornerRadius} ${element.bounds.height - pointerHeight}
          L ${pointerWidth + 5} ${element.bounds.height - pointerHeight}
          L ${pointerWidth / 2} ${element.bounds.height}
          L 5 ${element.bounds.height - pointerHeight}
          Q 0 ${element.bounds.height - pointerHeight} 0 ${element.bounds.height - cornerRadius - pointerHeight}
          L 0 ${cornerRadius}
          Q 0 0 ${cornerRadius} 0 Z
        `}
        fillColor={fillColor || element.fillColor}
        strokeColor={element.strokeColor}
        strokeWidth="1.5"
        strokeMiterlimit="10"
      />
      {/* Text content */}
      <Multiline
        x={element.bounds.width / 2}
        y={(element.bounds.height - pointerHeight) / 2}
        width={element.bounds.width - 10}
        height={element.bounds.height - pointerHeight - 10}
        fontWeight="normal"
        fill={element.textColor}
      >
        {element.name}
      </Multiline>
    </g>
  );
};

export interface Props {
  element: Comments;
  fillColor?: string;
}
