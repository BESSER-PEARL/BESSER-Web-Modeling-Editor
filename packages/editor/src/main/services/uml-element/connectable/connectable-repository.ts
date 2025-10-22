import { DefaultUMLRelationshipType, UMLRelationshipType } from '../../../packages/uml-relationship-type';
import { UMLRelationships } from '../../../packages/uml-relationships';
import { AsyncAction } from '../../../utils/actions/actions';
import { Connection } from '../../uml-relationship/connection';
import { UMLElementCommonRepository } from '../uml-element-common-repository';
import { Direction, IUMLElementPort } from '../uml-element-port';
import { ConnectableActionTypes, ConnectEndAction, ConnectStartAction } from './connectable-types';
import { UMLElements } from '../../../packages/uml-elements';
import { UMLElementType } from '../../..';
import { UMLRelationshipCommonRepository } from '../../uml-relationship/uml-relationship-common-repository';
import { IUMLRelationship, UMLRelationship } from '../../uml-relationship/uml-relationship';
import { IUMLElement } from '../uml-element';
import { IPath } from '../../../utils/geometry/path';
import { canHaveCenterPort } from '../../uml-relationship/uml-relationship-port';


export const Connectable = {
  startConnecting:
    (direction: Direction | Direction[], id?: string | string[]): AsyncAction =>
      (dispatch, getState) => {
        const ids = id
          ? Array.isArray(id)
            ? id
            : [id]
          : getState()
            .selected.map((elementId) => dispatch(UMLElementCommonRepository.getById(elementId)))
            .filter((element) => element !== null)
            .filter((element) => UMLElements[element!.type as UMLElementType].features.connectable)
            .map((element) => element!.id);
        const directions = Array.isArray(direction) ? direction : [direction];
        if (!ids.length || (directions.length !== 1 && directions.length !== ids.length)) {
          return;
        }

        const ports = ids.map<IUMLElementPort>((elementId, index) => ({
          element: elementId,
          direction: directions.length === 1 ? directions[0] : directions[index],
        }));

        dispatch<ConnectStartAction>({
          type: ConnectableActionTypes.START,
          payload: { ports },
          undoable: false,
        });
      },

  connect:
    (target: IUMLElementPort | IUMLElementPort[], source?: IUMLElementPort | IUMLElementPort[]): AsyncAction =>
      (dispatch, getState) => {
        const sources = source ? (Array.isArray(source) ? source : [source]) : getState().connecting;
        const targets = Array.isArray(target) ? target : [target];

        if (!targets.length || (targets.length !== 1 && targets.length !== sources.length)) {
          return;
        }

        const connections: Connection[] = [];
        for (const [index, port] of sources.entries()) {
          // try to connect to target - if target.length === 1 -> connect to same element
          const connectionTarget = targets.length === 1 ? targets[0] : targets[index];

          // Skip if trying to connect the same point to itself
          if (port.element === connectionTarget.element && port.direction === connectionTarget.direction) {
            continue;
          }

          // For source element, check if it's a relationship or a regular element
          let sourceElement;
          sourceElement = dispatch(UMLRelationshipCommonRepository.getById(port.element));

          // If not found or not a relationship, try as a regular element
          if (!sourceElement || !UMLRelationship.isUMLRelationship(sourceElement)) {
            sourceElement = dispatch(UMLElementCommonRepository.getById(port.element));
          }

          // For target element, check if it's a relationship or a regular element
          let targetElement;
          targetElement = dispatch(UMLRelationshipCommonRepository.getById(connectionTarget.element));

          // If not found or not a relationship, try as a regular element
          if (!targetElement || !UMLRelationship.isUMLRelationship(targetElement)) {
            targetElement = dispatch(UMLElementCommonRepository.getById(connectionTarget.element));
          }

          // Validate center port usage
          const isSourceRelationship = sourceElement && UMLRelationship.isUMLRelationship(sourceElement);
          const isTargetRelationship = targetElement && UMLRelationship.isUMLRelationship(targetElement);

          // Skip invalid connections:
          // // 1. Don't allow connecting to center port of regular elements
          if (!isTargetRelationship && connectionTarget.direction === Direction.Center) {
            console.warn('Cannot connect to center port of non-relationship element');
            continue;
          }

          // 2. Don't allow connecting from center port of regular elements
          if (!isSourceRelationship && port.direction === Direction.Center) {
            console.warn('Cannot connect from center port of non-relationship element');
            continue;
          }

          // 3. Don't allow connecting to/from center port of relationships that aren't allowed to have it
          if (port.direction === Direction.Center &&
            sourceElement && UMLRelationship.isUMLRelationship(sourceElement) &&
            !canHaveCenterPort(sourceElement)) {
            console.warn(`Relationship type ${sourceElement.type} is not allowed to have center port connections`);
            continue;
          }

          // 4. Don't allow connecting to center port of relationships that aren't allowed to have it
          if (connectionTarget.direction === Direction.Center &&
            targetElement && UMLRelationship.isUMLRelationship(targetElement) &&
            !canHaveCenterPort(targetElement)) {
            console.warn(`Relationship type ${targetElement.type} is not allowed to have center port connections`);
            continue;
          }

          connections.push({ source: port, target: connectionTarget });
        }

        const relationships = connections.map((connection) => {
          let sourceElement;
          sourceElement = dispatch(UMLRelationshipCommonRepository.getById(connection.source.element));
          if (!sourceElement || !UMLRelationship.isUMLRelationship(sourceElement)) {
            sourceElement = dispatch(UMLElementCommonRepository.getById(connection.source.element));
          }

          // For target element, check if it's a relationship or a regular element
          let targetElement;
          targetElement = dispatch(UMLRelationshipCommonRepository.getById(connection.target.element));
          if (!targetElement || !UMLRelationship.isUMLRelationship(targetElement)) {
            targetElement = dispatch(UMLElementCommonRepository.getById(connection.target.element));
          }

          // Skip creating the relationship if source or target element is not found
          if (!sourceElement || !targetElement) {
            console.error('Cannot create relationship: source or target element not found', {
              sourceElementId: connection.source.element,
              targetElementId: connection.target.element
            });
            return null;
          }

          let relationshipType: UMLRelationshipType;

          // Check if this is a connection from or to a relationship center point - if so, use Link type
          const isFromOrToRelationshipCenter = (UMLRelationship.isUMLRelationship(sourceElement) &&
            connection.source.direction === Direction.Center) ||
            (UMLRelationship.isUMLRelationship(targetElement) &&
              connection.target.direction === Direction.Center);

          if (isFromOrToRelationshipCenter) {
            // When connecting from or to a relationship center, always use Link type
            relationshipType = UMLRelationshipType.ClassLinkRel;
          } else {
            // determine the common supported connection types and choose one for the connection
            if (sourceElement && targetElement) {
              const commonSupportedConnections = UMLRelationshipCommonRepository.getSupportedConnectionsForElements([
                sourceElement,
                targetElement,
              ]);

              // take the first common supported connection type or default diagram type
              relationshipType =
                commonSupportedConnections.length > 0
                  ? commonSupportedConnections[0]
                  : DefaultUMLRelationshipType[getState().diagram.type];

            } else {
              // take default diagram type
              relationshipType = DefaultUMLRelationshipType[getState().diagram.type];
            }
          }

          try {
            // Create the relationship with the connection
            const Classifier = UMLRelationships[relationshipType];
            const relationship = new Classifier(connection);

            // Calculate the path directly using Connection.computePath
            const path = Connection.computePath(
              { element: sourceElement, direction: connection.source.direction },
              { element: targetElement, direction: connection.target.direction },
              { isStraight: false, isVariable: true }
            );

            // Set the path and calculate bounds
            relationship.path = path as IPath;

            // Calculate bounds based on the path
            const x = Math.min(...path.map((point) => point.x));
            const y = Math.min(...path.map((point) => point.y));
            const width = Math.max(Math.max(...path.map((point) => point.x)) - x, 1);
            const height = Math.max(Math.max(...path.map((point) => point.y)) - y, 1);

            // Set the bounds
            relationship.bounds = { x, y, width, height };

            // Adjust the path to be relative to the bounds
            relationship.path = path.map((point) => ({ x: point.x - x, y: point.y - y })) as IPath;

            return relationship;
          } catch (error) {
            console.error('Error creating relationship:', error);
            return null;
          }
        });

        // Filter out null relationships
        const validRelationships = relationships.filter(Boolean);

        if (validRelationships.length) {
          // Use type assertion to satisfy TypeScript
          dispatch(UMLElementCommonRepository.create(validRelationships as IUMLElement[]));
        }

        if (!source) {
          dispatch<ConnectEndAction>({
            type: ConnectableActionTypes.END,
            payload: { ports: sources },
            undoable: false,
          });
        }
      },

  endConnecting:
    (port?: IUMLElementPort | IUMLElementPort[]): AsyncAction =>
      (dispatch, getState) => {
        const ports = port ? (Array.isArray(port) ? port : [port]) : getState().connecting;
        if (!ports.length) {
          return;
        }

        dispatch<ConnectEndAction>({
          type: ConnectableActionTypes.END,
          payload: { ports },
          undoable: false,
        });
      },

};
