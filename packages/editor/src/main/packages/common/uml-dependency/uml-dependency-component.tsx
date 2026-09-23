import React, { FunctionComponent } from 'react';
import { Text } from '../../../components/controls/text/text';
import { UMLDependency } from './uml-component-dependency';
import { ThemedPath, ThemedPolyline } from '../../../components/theme/themedComponents';
import { relationshipMidpoint, relationshipLabelLayout } from '../relationship-label/relationship-midpoint';

export const UMLDependencyComponent: FunctionComponent<Props> = ({ element }) => {
  // Shared by ComponentDependency and DeploymentDependency (components.ts).
  // Only ComponentDependency owns a user-editable `stereotype`; a
  // DeploymentDependency can carry a leftover one after a type-switch from
  // DeploymentAssociation — hidden in its popup, never serialized — so it must
  // not render here. Gate on the type that actually owns the field. (Bare
  // string, not the ComponentRelationshipType enum: importing that runtime
  // value into common/ would create a circular package dependency.)
  const stereotype =
    element.type === 'ComponentDependency' ? (element as { stereotype?: string }).stereotype : undefined;
  const midpoint = stereotype ? relationshipMidpoint(element.path) : undefined;

  return (
    <g>
      <marker
        id={`marker-${element.id}`}
        viewBox="0 0 30 30"
        markerWidth="22"
        markerHeight="30"
        refX="30"
        refY="15"
        orient="auto"
        markerUnits="strokeWidth"
      >
        <ThemedPath d="M0,29 L30,15 L0,1" fillColor="none" strokeColor={element.strokeColor} />
      </marker>
      <ThemedPolyline
        points={element.path.map((point) => `${point.x} ${point.y}`).join(',')}
        strokeColor={element.strokeColor}
        fillColor="none"
        strokeWidth={1}
        strokeDasharray={7}
        markerEnd={`url(#marker-${element.id})`}
      />
      {stereotype && midpoint && (
        <Text
          fill={element.textColor}
          x={midpoint.position.x}
          y={midpoint.position.y}
          {...relationshipLabelLayout(midpoint.direction)}
          pointerEvents="none"
          fontSize="85%"
        >
          {`«${stereotype}»`}
        </Text>
      )}
    </g>
  );
};

interface Props {
  element: UMLDependency;
}
