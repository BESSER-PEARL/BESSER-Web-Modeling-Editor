import React, { FunctionComponent } from 'react';
import { Direction, IUMLElementPort } from '../../../services/uml-element/uml-element-port';
import { Point } from '../../../utils/geometry/point';
import { ClassRelationshipType } from '../../uml-class-diagram';
import { UMLAssociation } from './uml-association';
import { GeneralRelationshipType, UMLRelationshipType } from '../../uml-relationship-type';
import { ThemedPath, ThemedPathContrast, ThemedPolygon, ThemedPolyline } from '../../../components/theme/themedComponents';
import { settingsService } from '../../../services/settings/settings-service';
import { parseMultiplicity, toERCardinality } from './multiplicity';
// Re-export so downstream consumers can keep importing these from the
// association component module.
export { parseMultiplicity, toERCardinality };

const Marker = {
  // `orient` defaults to pointing along the path (for a markerEnd, i.e. an
  // arrowhead at the target). Pass 'auto-start-reverse' when the same arrow
  // is used as a markerStart, so it points back at the source instead of
  // forward past it.
  Arrow: (id: string, color?: string, orient: string = 'auto') => (
    <marker
      id={id}
      viewBox={'0 0 30 30'}
      markerWidth={22}
      markerHeight={30}
      refX={30}
      refY={15}
      orient={orient}
      markerUnits="strokeWidth"
    >
      <ThemedPath d={`M0,29 L30,15 L0,1`} fillColor="none" strokeColor={color} />
    </marker>
  ),
  Rhombus: (id: string, color?: string) => (
    <marker
      id={id}
      viewBox="0 0 30 30"
      markerWidth="30"
      markerHeight="30"
      refX="30"
      refY="15"
      orient="auto"
      markerUnits="strokeWidth"
    >
      <ThemedPath d="M0,15 L15,22 L30,15 L15,8 z" fillColor={color} strokeColor={color} />
    </marker>
  ),
  RhombusFilled: (id: string, color?: string) => (
    <marker
      id={id}
      viewBox="0 0 30 30"
      markerWidth="30"
      markerHeight="30"
      refX="30"
      refY="15"
      orient="auto"
      markerUnits="strokeWidth"
    >
      <ThemedPathContrast d="M0,15 L15,22 L30,15 L15,8 z" fillColor={color} />
    </marker>
  ),
  Triangle: (id: string, color?: string) => (
    <marker
      id={id}
      viewBox="0 0 30 30"
      markerWidth="22"
      markerHeight="30"
      refX="30"
      refY="15"
      orient="auto"
      markerUnits="strokeWidth"
    >
      <ThemedPath d="M0,1 L0,29 L30,15 z" strokeColor={color} />
    </marker>
  ),
};

export const layoutTextForUMLAssociation = (location: IUMLElementPort['direction'], position: 'TOP' | 'BOTTOM') => {
  switch (location) {
    case Direction.Up:
    case Direction.Topright:
    case Direction.Topleft:
      return {
        dx: position === 'TOP' ? -5 : 5,
        textAnchor: position === 'TOP' ? 'end' : 'start',
      };
    case Direction.Right:
    case Direction.Upright:
    case Direction.Downright:
      return {
        dy: position === 'TOP' ? -10 : 21,
        textAnchor: 'start',
      };
    case Direction.Down:
    case Direction.Bottomright:
    case Direction.Bottomleft:
      return {
        dx: position === 'TOP' ? -5 : 5,
        dy: 10,
        textAnchor: position === 'TOP' ? 'end' : 'start',
      };
    case Direction.Left:
    case Direction.Upleft:
    case Direction.Downleft:
      return {
        dy: position === 'TOP' ? -10 : 21,
        textAnchor: 'end',
      };
  }
};

export const computeTextPositionForUMLAssociation = (alignmentPath: Point[], hasMarker: boolean = false): Point => {
  const distance = hasMarker ? 31 : 8;
  if (alignmentPath.length < 2) return new Point();
  const vector = alignmentPath[1].subtract(alignmentPath[0]);
  return alignmentPath[0].add(vector.normalize().scale(distance));
};

export const computeMiddlePositionForUMLAssociation = (alignmentPath: Point[]): Point => {
  if (alignmentPath.length < 2) return new Point();
  const midIndex = Math.floor(alignmentPath.length / 2);
  if (alignmentPath.length % 2 === 0) {
    const a = alignmentPath[midIndex - 1];
    const b = alignmentPath[midIndex];
    return new Point((a.x + b.x) / 2, (a.y + b.y) / 2);
  }
  return new Point(alignmentPath[midIndex].x, alignmentPath[midIndex].y);
};

// Plain associations (the generic "Association" type, plus the legacy
// ClassUnidirectional kept for backward compatibility) don't get a marker
// from their type alone -- whether/where an arrowhead is drawn on them is
// entirely driven by each end's navigability, computed in the component below.
export const getMarkerForTypeForUMLAssociation = (relationshipType: UMLRelationshipType) => {
  return ((type) => {
    switch (type) {
      case ClassRelationshipType.ClassDependency:
        return Marker.Arrow;
      case ClassRelationshipType.ClassAggregation:
        return Marker.Rhombus;
      case ClassRelationshipType.ClassComposition:
        return Marker.RhombusFilled;
      case ClassRelationshipType.ClassInheritance:
      case ClassRelationshipType.ClassRealization:
        return Marker.Triangle;
      case ClassRelationshipType.ClassOCLLink:
        // return Marker.Arrow;
    }
  })(relationshipType);
};

export const UMLAssociationComponent: FunctionComponent<Props> = ({ element }) => {
  const isInheritance = element.type === ClassRelationshipType.ClassInheritance;
  // Add special check for OCL Link
  const isLinkRel = element.type === ClassRelationshipType.ClassLinkRel;
  const showAssociationNames = settingsService.shouldShowAssociationNames();
  const notation = settingsService.getClassNotation();
  const isER = notation === 'ER';

  // In ER (Chen) mode, replace the UML arrow/rhombus end markers with a named
  // diamond drawn at the midpoint — but only for the four "plain" binary
  // associations that have an ER counterpart. Inheritance, realization, OCL,
  // dependency, and link relationships keep their UML rendering. Using an
  // explicit allow-list here (instead of excluding types) means new
  // relationship types won't silently inherit the ER diamond.
  const ER_DIAMOND_RELATIONSHIP_TYPES: ReadonlyArray<string> = [
    ClassRelationshipType.ClassBidirectional,
    ClassRelationshipType.ClassUnidirectional,
    ClassRelationshipType.ClassAggregation,
    ClassRelationshipType.ClassComposition,
  ];
  const showsERDiamond = isER && ER_DIAMOND_RELATIONSHIP_TYPES.includes(element.type);

  // For a plain association, the arrowhead is derived from navigability
  // instead of the type: no arrow when both ends are navigable, and one
  // arrow pointing at whichever single end is navigable otherwise (both
  // ends non-navigable is prevented by the editor).
  const isPlainAssociation =
    element.type === ClassRelationshipType.ClassBidirectional ||
    element.type === ClassRelationshipType.ClassUnidirectional;
  // In a composition the target end is always the composite ("whole") and
  // keeps its diamond regardless of navigability; the source ("part") end
  // is normally always navigable, but if the whole is made non-navigable an
  // arrow appears at the part end to show that's the only way to navigate.
  const isComposition = element.type === ClassRelationshipType.ClassComposition;
  const sourceNavigable = element.source.navigable !== false;
  const targetNavigable = element.target.navigable !== false;
  const showSourceArrow =
    (isPlainAssociation && sourceNavigable && !targetNavigable) || (isComposition && !targetNavigable);
  const showTargetArrow = isPlainAssociation && targetNavigable && !sourceNavigable;

  const targetMarker = showsERDiamond
    ? undefined
    : showTargetArrow
      ? Marker.Arrow
      : getMarkerForTypeForUMLAssociation(element.type);
  const sourceMarker = showsERDiamond || !showSourceArrow ? undefined : Marker.Arrow;

  const stroke = ((type) => {
    switch (type) {
      case ClassRelationshipType.ClassDependency:
      case ClassRelationshipType.ClassRealization:
        return 7;
      case ClassRelationshipType.ClassOCLLink:
      case ClassRelationshipType.ClassLinkRel:
      case GeneralRelationshipType.Link:
        return "5,5";
    }
  })(element.type);

  const path = element.path.map((point) => new Point(point.x, point.y));
  const source: Point = computeTextPositionForUMLAssociation(path, !!sourceMarker);
  const middle: Point = computeMiddlePositionForUMLAssociation(path);
  const target: Point = computeTextPositionForUMLAssociation(path.reverse(), !!targetMarker);
  const id = `marker-${element.id}`;
  const startMarkerId = `${id}-start`;
  const endMarkerId = `${id}-end`;

  const textFill = element.textColor ? { fill: element.textColor } : {};
  return (
    <g>
      {targetMarker && targetMarker(endMarkerId, element.strokeColor)}
      {sourceMarker && sourceMarker(startMarkerId, element.strokeColor, 'auto-start-reverse')}
      <ThemedPolyline
        points={element.path.map((point) => `${point.x} ${point.y}`).join(',')}
        strokeColor={element.strokeColor}
        fillColor="none"
        strokeWidth={1}
        markerStart={sourceMarker ? `url(#${startMarkerId})` : undefined}
        markerEnd={targetMarker ? `url(#${endMarkerId})` : undefined}
        strokeDasharray={stroke}
      />
      {showAssociationNames && element.name && !isInheritance && !isLinkRel && !showsERDiamond && (
        <text
          x={middle.x || 0}
          y={middle.y || 0}
          textAnchor="middle"
          dy="-5"
          pointerEvents="none"
          style={{ ...textFill, fontSize: '12px', fontWeight: 'bold' }}
        >
          {element.name}
        </text>
      )}
      {showsERDiamond && (
        <g
          transform={`translate(${middle.x || 0} ${middle.y || 0})`}
          pointerEvents="none"
          data-testid="er-relationship-diamond"
        >
          <ThemedPolygon
            points="-30,0 0,-15 30,0 0,15"
            fillColor={element.fillColor}
            strokeColor={element.strokeColor}
            strokeWidth={1}
          />
          {element.name && (
            <text
              x={0}
              y={0}
              textAnchor="middle"
              dominantBaseline="middle"
              style={{ ...textFill, fontSize: '11px' }}
            >
              {element.name}
            </text>
          )}
        </g>
      )}
      {!isInheritance && !isLinkRel && (
        <>
          <text
            x={source.x || 0}
            y={source.y || 0}
            {...layoutTextForUMLAssociation(element.source.direction, 'BOTTOM')}
            pointerEvents="none"
            style={{ ...textFill }}
          >
            {isER ? toERCardinality(element.source.multiplicity) : element.source.multiplicity}
          </text>
          <text
            x={target.x || 0}
            y={target.y || 0}
            {...layoutTextForUMLAssociation(element.target.direction, 'BOTTOM')}
            pointerEvents="none"
            style={{ ...textFill }}
          >
            {isER ? toERCardinality(element.target.multiplicity) : element.target.multiplicity}
          </text>
          <text
            x={source.x || 0}
            y={source.y || 0}
            {...layoutTextForUMLAssociation(element.source.direction, 'TOP')}
            pointerEvents="none"
            style={{ ...textFill }}
          >
            {element.source.role}
          </text>
          <text
            x={target.x || 0}
            y={target.y || 0}
            {...layoutTextForUMLAssociation(element.target.direction, 'TOP')}
            pointerEvents="none"
            style={{ ...textFill }}
          >
            {element.target.role}
          </text>
        </>
      )}
    </g>
  );
};

interface Props {
  element: UMLAssociation;
}