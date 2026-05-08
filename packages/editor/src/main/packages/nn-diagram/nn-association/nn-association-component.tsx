import React, { FunctionComponent } from 'react';
import { Point } from '../../../utils/geometry/point';
import { UMLAssociation } from '../../common/uml-association/uml-association';
import { ThemedPath, ThemedPolyline } from '../../../components/theme/themedComponents';
import {
  computeTextPositionForUMLAssociation,
  layoutTextForUMLAssociation
} from '../../common/uml-association/uml-association-component';

const Marker = {
  Arrow: (id: string, color?: string) => (
    <marker
      id={id}
      viewBox={'0 0 30 30'}
      markerWidth={12}
      markerHeight={18}
      refX={30}
      refY={15}
      orient="auto"
      markerUnits="strokeWidth"
    >
      <ThemedPath d={`M0,29 L30,15 L0,1`} fillColor="none" strokeColor={color} />
    </marker>
  ),
};

interface Props {
  element: UMLAssociation;
}

export const NNAssociationComponent: FunctionComponent<Props> = ({ element }) => {
  const marker = Marker.Arrow;
  const path = element.path.map((point) => new Point(point.x, point.y));
  const source: Point = computeTextPositionForUMLAssociation(path);
  const target: Point = computeTextPositionForUMLAssociation([...path].reverse(), !!marker);
  const id = `marker-${element.id}`;

  // Calculate true geometric middle of the path
  let middle: Point;
  if (path.length === 2) {
    // For simple 2-point line, calculate midpoint
    middle = new Point(
      (path[0].x + path[1].x) / 2,
      (path[0].y + path[1].y) / 2
    );
  } else {
    // For multi-point paths, use the middle segment's midpoint
    const midIndex = Math.floor(path.length / 2);
    const p1 = path[midIndex - 1];
    const p2 = path[midIndex];
    middle = new Point(
      (p1.x + p2.x) / 2,
      (p1.y + p2.y) / 2
    );
  }

  const textFill = element.textColor ? { fill: element.textColor } : {};

  // Use "next" as default name if element.name is not set
  const displayName = element.name || 'next';

  return (
    <g>
      {marker && marker(id, element.strokeColor)}
      <ThemedPolyline
        points={element.path.map((point) => `${point.x} ${point.y}`).join(',')}
        strokeColor={element.strokeColor}
        fillColor="none"
        strokeWidth={1}
        markerEnd={`url(#${id})`}
      />
      {/* Always show name for NN associations */}
      <text
        x={middle.x || 0}
        y={middle.y || 0}
        textAnchor="middle"
        dy="-12"
        pointerEvents="none"
        style={{ ...textFill, fontSize: '12px', fontWeight: 'bold' }}
      >
        {displayName}
      </text>
      {/* Show multiplicity if set */}
      {element.source.multiplicity && (
        <text
          x={source.x || 0}
          y={source.y || 0}
          {...layoutTextForUMLAssociation(element.source.direction, 'BOTTOM')}
          pointerEvents="none"
          style={{ ...textFill }}
        >
          {element.source.multiplicity}
        </text>
      )}
      {element.target.multiplicity && (
        <text
          x={target.x || 0}
          y={target.y || 0}
          {...layoutTextForUMLAssociation(element.target.direction, 'BOTTOM')}
          pointerEvents="none"
          style={{ ...textFill }}
        >
          {element.target.multiplicity}
        </text>
      )}
      {/* Show role if set */}
      {element.source.role && (
        <text
          x={source.x || 0}
          y={source.y || 0}
          {...layoutTextForUMLAssociation(element.source.direction, 'TOP')}
          pointerEvents="none"
          style={{ ...textFill }}
        >
          {element.source.role}
        </text>
      )}
      {element.target.role && (
        <text
          x={target.x || 0}
          y={target.y || 0}
          {...layoutTextForUMLAssociation(element.target.direction, 'TOP')}
          pointerEvents="none"
          style={{ ...textFill }}
        >
          {element.target.role}
        </text>
      )}
    </g>
  );
};
