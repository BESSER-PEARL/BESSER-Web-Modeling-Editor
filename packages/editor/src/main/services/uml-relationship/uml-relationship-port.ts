import { Point } from '../../utils/geometry/point';
import { Direction } from '../uml-element/uml-element-port';
import { IUMLRelationship } from './uml-relationship';
import { UMLRelationshipType } from '../../packages/uml-relationship-type';

// Define which relationship types are allowed to have center port connections
export const RELATIONSHIP_TYPES_WITH_CENTER_PORT: string[] = [
  'ClassBidirectional',
  'ClassUnidirectional'
];

/**
 * Checks if a relationship type is allowed to have a center port connection
 */
export function canHaveCenterPort(relationship: IUMLRelationship): boolean {
  return RELATIONSHIP_TYPES_WITH_CENTER_PORT.includes(relationship.type);
}

/**
 * Calculates the exact position of the central port of a relationship
 * This function is more precise than simply using the center of the bounding rectangle
 */
export function getRelationshipCenterPoint(relationship: IUMLRelationship): Point {
  if (!relationship || !relationship.path || relationship.path.length < 2) {
    return new Point(
      relationship?.bounds?.width ? relationship.bounds.width / 2 : 0,
      relationship?.bounds?.height ? relationship.bounds.height / 2 : 0
    );
  }
  
  // For a multi-segment path, find a middle point
  const middleIndex = Math.floor(relationship.path.length / 2);
  
  // If we're at index 0, use a point between 0 and 1
  if (middleIndex === 0) {
    const startPoint = relationship.path[0];
    const endPoint = relationship.path[1];
    return new Point(
      startPoint.x + (endPoint.x - startPoint.x) / 2,
      startPoint.y + (endPoint.y - startPoint.y) / 2
    );
  }
  
  // Otherwise use the middle point of the segment
  const startPoint = relationship.path[middleIndex - 1];
  const endPoint = relationship.path[middleIndex];
  
  // Get the middle point of the segment
  return new Point(
    startPoint.x + (endPoint.x - startPoint.x) / 2,
    startPoint.y + (endPoint.y - startPoint.y) / 2
  );
}

/**
 * Gets all ports for a relationship, with the central port correctly positioned
 */
export function getPortsForRelationship(relationship: IUMLRelationship): { [key in Direction]: Point } {
  if (!relationship || !relationship.bounds) {
    // Return default ports if relationship is invalid
    return Object.values(Direction).reduce((acc, dir) => {
      acc[dir] = new Point(0, 0);
      return acc;
    }, {} as { [key in Direction]: Point });
  }
  
  // Calculate the central point with precision
  const centerPoint = getRelationshipCenterPoint(relationship);
  
  // Check if this relationship type is allowed to have a center port
  const hasCenterPort = canHaveCenterPort(relationship);
  
  // Return all ports but place the center port based on whether it's allowed
  return {
    [Direction.Up]: new Point(relationship.bounds.width / 2, 0),
    [Direction.Right]: new Point(relationship.bounds.width, relationship.bounds.height / 2),
    [Direction.Down]: new Point(relationship.bounds.width / 2, relationship.bounds.height),
    [Direction.Left]: new Point(0, relationship.bounds.height / 2),
    [Direction.Upright]: new Point(relationship.bounds.width, relationship.bounds.height / 4),
    [Direction.Downright]: new Point(relationship.bounds.width, (3 * relationship.bounds.height) / 4),
    [Direction.Upleft]: new Point(0, relationship.bounds.height / 4),
    [Direction.Downleft]: new Point(0, (3 * relationship.bounds.height) / 4),
    [Direction.Topright]: new Point((3 * relationship.bounds.width) / 4, 0),
    [Direction.Bottomright]: new Point((3 * relationship.bounds.width) / 4, relationship.bounds.height),
    [Direction.Topleft]: new Point(relationship.bounds.width / 4, 0),
    [Direction.Bottomleft]: new Point(relationship.bounds.width / 4, relationship.bounds.height),
    [Direction.Center]: hasCenterPort ? centerPoint : new Point(-1000, -1000),
  };
}
