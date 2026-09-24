import React, { FunctionComponent } from 'react';
import { Direction, IUMLElementPort } from '../../../services/uml-element/uml-element-port';
import { Point } from '../../../utils/geometry/point';
import { ClassRelationshipType } from '../../uml-class-diagram';
import { UMLAssociation } from './uml-association';
import { GeneralRelationshipType, UMLRelationshipType } from '../../uml-relationship-type';
import { ThemedPath, ThemedPathContrast, ThemedPolygon, ThemedPolyline } from '../../../components/theme/themedComponents';
import { settingsService } from '../../../services/settings/settings-service';
import { parseMultiplicity, toERCardinality } from './multiplicity';
import { resolveAssociationNavigability } from './uml-association-navigability';
// Re-export so downstream consumers can keep importing these from the
// association component module.
export { parseMultiplicity, toERCardinality };

const markerPath = (d: string, fillColor: string | undefined, strokeColor?: string) => (
  <ThemedPath d={d} fillColor={fillColor} strokeColor={strokeColor} />
);

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
      {markerPath('M0,29 L30,15 L0,1', 'none', color)}
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
  // Aggregation diamond at a navigable whole end: the open navigability
  // arrowhead sits on the line just before the diamond, which is unchanged.
  RhombusArrow: (id: string, color?: string) => (
    <marker
      id={id}
      viewBox="0 0 52 30"
      markerWidth="52"
      markerHeight="30"
      refX="52"
      refY="15"
      orient="auto"
      markerUnits="strokeWidth"
    >
      {markerPath('M0,29 L22,15 L0,1', 'none', color)}
      {markerPath('M22,15 L37,22 L52,15 L37,8 z', color, color)}
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

// Plain associations (ClassBidirectional, and the legacy ClassUnidirectional)
// don't get a marker from their type alone: their arrowheads come from each
// end's navigability, see getMarkersForUMLAssociation.
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

type MarkerFactory = (id: string, color?: string, orient?: string) => React.JSX.Element;

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

export const showsERDiamondForUMLAssociation = (type: UMLRelationshipType): boolean =>
  settingsService.getClassNotation() === 'ER' && ER_DIAMOND_RELATIONSHIP_TYPES.includes(type);

/**
 * The end markers drawn for an association, following UML notation: an open
 * arrowhead at a navigable end when the other end is not navigable (no arrows
 * when both ends are navigable). The diamond of an aggregation or composition
 * always stays on the target (whole) end; for an aggregation whose only
 * navigable end is the whole, the arrowhead is drawn in front of the diamond.
 * Relationships without navigability keep their type-based marker.
 */
export const getMarkersForUMLAssociation = (element: {
  type: UMLRelationshipType;
  source: { navigable?: boolean };
  target: { navigable?: boolean };
}): { source?: MarkerFactory; target?: MarkerFactory } => {
  if (showsERDiamondForUMLAssociation(element.type)) {
    return {};
  }
  const typeMarker = getMarkerForTypeForUMLAssociation(element.type);
  switch (element.type) {
    case ClassRelationshipType.ClassBidirectional:
    case ClassRelationshipType.ClassUnidirectional:
    case ClassRelationshipType.ClassAggregation:
    case ClassRelationshipType.ClassComposition: {
      const navigability = resolveAssociationNavigability(element);
      const onlySource = navigability.source && !navigability.target;
      const onlyTarget = navigability.target && !navigability.source;
      let target: MarkerFactory | undefined = typeMarker;
      if (onlyTarget) {
        target = element.type === ClassRelationshipType.ClassAggregation ? Marker.RhombusArrow : typeMarker || Marker.Arrow;
      }
      return { source: onlySource ? Marker.Arrow : undefined, target };
    }
    default:
      return { target: typeMarker };
  }
};

export const UMLAssociationComponent: FunctionComponent<Props> = ({ element }) => {
  const isInheritance = element.type === ClassRelationshipType.ClassInheritance;
  // Add special check for OCL Link
  const isLinkRel = element.type === ClassRelationshipType.ClassLinkRel;
  const showAssociationNames = settingsService.shouldShowAssociationNames();
  const isER = settingsService.getClassNotation() === 'ER';
  const showsERDiamond = showsERDiamondForUMLAssociation(element.type);
  const { source: sourceMarker, target: targetMarker } = getMarkersForUMLAssociation(element);

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