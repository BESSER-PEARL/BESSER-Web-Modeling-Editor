import React, { FunctionComponent } from 'react';
import { Text } from '../../../components/controls/text/text';
import { UMLClassifier } from './uml-classifier';
import { ThemedPath, ThemedRect } from '../../../components/theme/themedComponents';
import { settingsService } from '../../../services/settings/settings-service';
import { ClassElementType } from '../../uml-class-diagram';

// Classifier types that map to ER entities and can thus be rendered with
// ER flavor (no methods compartment). Enumerations and interfaces have no
// ER equivalent — interfaces in particular define an operation contract,
// which is the exact opposite of an entity.
const ER_CAPABLE_CLASSIFIER_TYPES: ReadonlyArray<string> = [
  ClassElementType.Class,
  ClassElementType.AbstractClass,
];

export const UMLClassifierComponent: FunctionComponent<Props> = ({ element, children, fillColor }) => {
  const clipId = `clip-${element.id}`;
  const isERClassifier =
    settingsService.getClassNotation() === 'ER' &&
    ER_CAPABLE_CLASSIFIER_TYPES.includes(element.type);
  return (
    <g>
      {/* Clip all content to the element's bounding box so text doesn't overflow */}
      <defs>
        <clipPath id={clipId}>
          <rect width={element.bounds.width} height={element.bounds.height} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <ThemedRect
          fillColor={fillColor || element.fillColor}
          strokeColor="none"
          width="100%"
          height={element.stereotype ? 50 : 40}
        />
        <ThemedRect
          y={element.stereotype ? 50 : 40}
          width="100%"
          height={element.bounds.height - (element.stereotype ? 50 : 40)}
          strokeColor="none"
        />
        {element.stereotype ? (
          <svg height={50}>
            <Text fill={element.textColor}>
              <tspan x="50%" dy={-8} textAnchor="middle" fontSize="85%">
                {`«${element.stereotype}»`}
              </tspan>
              <tspan
                x="50%"
                dy={18}
                textAnchor="middle"
                fontStyle={element.italic ? 'italic' : undefined}
                textDecoration={element.underline ? 'underline' : undefined}
              >
                {element.name}
              </tspan>
            </Text>
          </svg>
        ) : (
          <svg height={40}>
            <Text
              fill={element.textColor}
              fontStyle={element.italic ? 'italic' : undefined}
              textDecoration={element.underline ? 'underline' : undefined}
            >
              {element.name}
            </Text>
          </svg>
        )}
        {children}
      </g>
      {/* Border and dividers drawn OUTSIDE the clip so they're always visible */}
      <ThemedRect width="100%" height="100%" strokeColor={element.strokeColor} fillColor="none" pointerEvents="none" />
      {element.hasAttributes && (
        <ThemedPath d={`M 0 ${element.headerHeight} H ${element.bounds.width}`} strokeColor={element.strokeColor} />
      )}
      {element.hasMethods && element.stereotype !== 'enumeration' && !isERClassifier && (
        <ThemedPath d={`M 0 ${element.deviderPosition} H ${element.bounds.width}`} strokeColor={element.strokeColor} />
      )}
    </g>
  );
};

interface Props {
  element: UMLClassifier;
  fillColor?: string;
  children?: React.ReactNode;
}
