import React, { FunctionComponent } from 'react';
import { Text } from '../../../components/controls/text/text';
import { UMLObjectName } from './uml-object-name';
import { ThemedPath, ThemedRect } from '../../../components/theme/themedComponents';
import { diagramBridge } from '../../../services/diagram-bridge/diagram-bridge-service';
import { settingsService } from '../../../services/settings/settings-service';
import { UserModelElementType } from '../../user-modeling';

export const UMLObjectNameComponent: FunctionComponent<Props> = ({ element, children, fillColor }) => {
  // Helper function to get the class name from the classId
  const getClassName = (): string => {
    if (!element.classId) {
      return '';
    }
    
    const classInfo = diagramBridge.getClassById(element.classId);
    return classInfo ? classInfo.name : '';
  };

  const className = getClassName();
  const isUserModelElement = element.type === (UserModelElementType as any).UserModelName;
  const displayLabel = isUserModelElement
    ? (className || element.className || element.name)
    : `${element.name}${className ? ` : ${className}` : ''}`;
  
  // Check if we should show icon view or normal view
  const shouldShowIconView = settingsService.shouldShowIconView();

  if (shouldShowIconView) {
    return renderIconView(element, children, fillColor, displayLabel);
  } else {
    return renderNormalView(element, children, fillColor, displayLabel);
  }
};

const renderIconView = (element: UMLObjectName, children: React.ReactNode, fillColor?: string, displayLabel?: string) => {
  const clipId = `clip-${element.id}`;
  const displayText = displayLabel || element.name;
  // Left-align long text so the beginning is always visible
  const textFitsBox = displayText.length * 8 < element.bounds.width;
  return (
    <g>
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
        <svg height={40}>
          <Text
            fill={element.textColor}
            fontStyle={element.italic ? 'italic' : undefined}
            textDecoration={element.underline ? 'underline' : undefined}
            x={textFitsBox ? '50%' : 8}
            textAnchor={textFitsBox ? 'middle' : 'start'}
          >
            {displayText}
          </Text>
        </svg>
        {children}
      </g>
      <ThemedRect width="100%" height="100%" strokeColor={element.strokeColor} fillColor="none" pointerEvents="none" />
      <ThemedPath d={`M 0 ${element.headerHeight} H ${element.bounds.width}`} strokeColor={element.strokeColor} />
    </g>
  );
};

const renderNormalView = (element: UMLObjectName, children: React.ReactNode, fillColor?: string, displayLabel?: string) => {
  const clipId = `clip-${element.id}`;
  const displayText = displayLabel || element.name;
  const textFitsBox = displayText.length * 8 < element.bounds.width;
  return (
    <g>
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
                x={textFitsBox ? '50%' : 8}
                dy={18}
                textAnchor={textFitsBox ? 'middle' : 'start'}
                fontStyle={element.italic ? 'italic' : undefined}
                textDecoration="underline"
              >
                {displayText}
              </tspan>
            </Text>
          </svg>
        ) : (
          <svg height={40}>
            <Text
              fill={element.textColor}
              fontStyle={element.italic ? 'italic' : undefined}
              textDecoration="underline"
              x={textFitsBox ? '50%' : 8}
              textAnchor={textFitsBox ? 'middle' : 'start'}
            >
              {displayText}
            </Text>
          </svg>
        )}
        {children}
      </g>
      <ThemedRect width="100%" height="100%" strokeColor={element.strokeColor} fillColor="none" pointerEvents="none" />
      {element.hasAttributes && (
        <ThemedPath d={`M 0 ${element.headerHeight} H ${element.bounds.width}`} strokeColor={element.strokeColor} />
      )}
      {element.hasMethods && element.stereotype !== 'enumeration' && (
        <ThemedPath d={`M 0 ${element.deviderPosition} H ${element.bounds.width}`} strokeColor={element.strokeColor} />
      )}
    </g>
  );
};

interface Props {
  element: UMLObjectName;
  fillColor?: string;
  children?: React.ReactNode;
}
