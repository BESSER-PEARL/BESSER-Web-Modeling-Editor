import React, { FunctionComponent } from 'react';
import { Direction, IUMLElementPort } from '../../../services/uml-element/uml-element-port';
import { Point } from '../../../utils/geometry/point';
import { ClassRelationshipType } from '../../uml-class-diagram';
import { UMLAssociation } from './uml-association';
import { GeneralRelationshipType, UMLRelationshipType } from '../../uml-relationship-type';
import { ThemedPath, ThemedPathContrast, ThemedPolygon, ThemedPolyline } from '../../../components/theme/themedComponents';
import { settingsService } from '../../../services/settings/settings-service';

const Marker = {
  Arrow: (id: string, color?: string) => (
    <marker
      id={id}
      viewBox={'0 0 30 30'}
      markerWidth={22}
      markerHeight={30}
      refX={30}
      refY={15}
      orient="auto"
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

/**
 * Normalize a UML multiplicity string into an explicit {min, max} pair,
 * accepting both the range form ("1..1", "0..*", "2..5") and the UML
 * shorthands ("1" == "1..1", "*" == "0..*"). `*` is kept as-is in max; the
 * caller maps it to the target notation (UML `*` or ER `N`). Returns `null`
 * for unparseable input so the caller can fall back to the original text.
 */
export const parseMultiplicity = (value: string): { min: string; max: string } | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.includes('..')) {
    const parts = trimmed.split('..');
    if (parts.length !== 2) return null;
    const min = parts[0].trim();
    const max = parts[1].trim();
    if (!min || !max) return null;
    return { min, max };
  }
  // Shorthands: "*" means "0..*", a standalone number "n" means "n..n".
  if (trimmed === '*') return { min: '0', max: '*' };
  return { min: trimmed, max: trimmed };
};

/**
 * Transform a UML multiplicity into an ER/Chen-style "(min,max)" cardinality.
 * Both UML range form and shorthands map to the same ER pair, so that
 * "1" and "1..1" both become "(1,1)", and "*" and "0..*" both become "(0,N)".
 * Unparseable input is returned unchanged to preserve user intent.
 */
export const toERCardinality = (multiplicity: string | undefined): string => {
  if (!multiplicity) return '';
  const parsed = parseMultiplicity(multiplicity);
  if (!parsed) return multiplicity;
  const max = parsed.max === '*' ? 'N' : parsed.max;
  return `(${parsed.min},${max})`;
};

// Note: UML mode deliberately renders the user's typed multiplicity string
// verbatim. Collapsing "1..1" → "1" at display time would silently rewrite
// every existing class diagram, so normalization only happens for ER mode
// via toERCardinality above.

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

export const getMarkerForTypeForUMLAssociation = (relationshipType: UMLRelationshipType) => {
  return ((type) => {
    switch (type) {
      case ClassRelationshipType.ClassDependency:
      case ClassRelationshipType.ClassUnidirectional:
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

  const marker = showsERDiamond ? undefined : getMarkerForTypeForUMLAssociation(element.type);

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
  const source: Point = computeTextPositionForUMLAssociation(path);
  const middle: Point = computeMiddlePositionForUMLAssociation(path);
  const target: Point = computeTextPositionForUMLAssociation(path.reverse(), !!marker);
  const id = `marker-${element.id}`;

  const textFill = element.textColor ? { fill: element.textColor } : {};
  return (
    <g>
      {marker && marker(id, element.strokeColor)}
      <ThemedPolyline
        points={element.path.map((point) => `${point.x} ${point.y}`).join(',')}
        strokeColor={element.strokeColor}
        fillColor="none"
        strokeWidth={1}
        markerEnd={`url(#${id})`}
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