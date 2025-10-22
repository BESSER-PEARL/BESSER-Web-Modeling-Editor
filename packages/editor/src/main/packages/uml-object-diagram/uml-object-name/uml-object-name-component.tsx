import React, { FunctionComponent } from 'react';
import { Text } from '../../../components/controls/text/text';
import { UMLObjectName } from './uml-object-name';
import { ThemedPath, ThemedRect } from '../../../components/theme/themedComponents';
import { diagramBridge } from '../../../services/diagram-bridge/diagram-bridge-service';
import { settingsService } from '../../../services/settings/settings-service';

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
  
  // Check if we should show icon view or normal view
  const shouldShowIconView = settingsService.shouldShowIconView();

  if (shouldShowIconView) {
    return renderIconView(element, children, fillColor, className);
  } else {
    return renderNormalView(element, children, fillColor, className);
  }
};

const renderIconView = (element: UMLObjectName, children: React.ReactNode, fillColor?: string, className?: string) => {
  return (
    <g>
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
      <ThemedPath d={`M 0 ${element.headerHeight} H ${element.bounds.width}`} strokeColor={element.strokeColor} />
      {/* MOVE THIS TO THE END TO APPEAR ON TOP */}
      
        <svg height={40}>
          <Text
            fill={element.textColor}
            fontStyle={element.italic ? 'italic' : undefined}
            textDecoration={element.underline ? 'underline' : undefined}
          >
            {element.name}{className ? ` : ${className}` : ''}
          </Text>
        </svg>
    

      {children}
      <ThemedRect width="100%" height="100%" strokeColor={element.strokeColor} fillColor="none" pointer-events="none" />
    </g>
  );
};

const renderNormalView = (element: UMLObjectName, children: React.ReactNode, fillColor?: string, className?: string) => {
  return (
    <g>
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
              textDecoration="underline"
            >
              {element.name}{className ? ` : ${className}` : ''}
            </tspan>
          </Text>
        </svg>
      ) : (
        <svg height={40}>
          <Text
            fill={element.textColor}
            fontStyle={element.italic ? 'italic' : undefined}
            textDecoration="underline"
          >
            {element.name}{className ? ` : ${className}` : ''}
          </Text>
        </svg>
      )}
      {children}
      <ThemedRect width="100%" height="100%" strokeColor={element.strokeColor} fillColor="none" pointer-events="none" />
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
