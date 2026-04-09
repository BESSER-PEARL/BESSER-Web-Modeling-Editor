import { DefaultUMLRelationshipType, UMLRelationshipType } from '../../../packages/uml-relationship-type';
import { UMLRelationships } from '../../../packages/uml-relationships';
import { AsyncAction } from '../../../utils/actions/actions';
import { Connection } from '../../uml-relationship/connection';
import { UMLElementCommonRepository } from '../uml-element-common-repository';
import { Direction, IUMLElementPort } from '../uml-element-port';
import { ConnectableActionTypes, ConnectEndAction, ConnectStartAction } from './connectable-types';
import { UMLElements } from '../../../packages/uml-elements';
import { UMLElementType } from '../../../packages/uml-element-type';
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

        // console.debug('[Connection] connect called', { sources, targets });

        if (!targets.length || (targets.length !== 1 && targets.length !== sources.length)) {
          // console.warn('[Connection] Aborted: target/source length mismatch', { targets: targets.length, sources: sources.length });
          return;
        }

        const connections: (Connection & { sourceElement: IUMLElement | IUMLRelationship; targetElement: IUMLElement | IUMLRelationship })[] = [];
        for (const [index, port] of sources.entries()) {
          // try to connect to target - if target.length === 1 -> connect to same element
          const connectionTarget = targets.length === 1 ? targets[0] : targets[index];

          // Skip if trying to connect the same point to itself
          if (port.element === connectionTarget.element && port.direction === connectionTarget.direction) {
            // console.debug('[Connection] Skipped: same point self-connection', { port, connectionTarget });
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
          // 1. Don't allow connecting to center port of regular elements
          if (!isTargetRelationship && connectionTarget.direction === Direction.Center) {
            // console.debug('[Connection] Skipped: center port on non-relationship target');
            continue;
          }

          // 2. Don't allow connecting from center port of regular elements
          if (!isSourceRelationship && port.direction === Direction.Center) {
            // console.debug('[Connection] Skipped: center port on non-relationship source');
            continue;
          }

          // 3. Don't allow connecting to/from center port of relationships that aren't allowed to have it
          if (port.direction === Direction.Center &&
            sourceElement && UMLRelationship.isUMLRelationship(sourceElement) &&
            !canHaveCenterPort(sourceElement)) {
            // console.debug('[Connection] Skipped: center port not allowed on source relationship');
            continue;
          }

          // 4. Don't allow connecting to center port of relationships that aren't allowed to have it
          if (connectionTarget.direction === Direction.Center &&
            targetElement && UMLRelationship.isUMLRelationship(targetElement) &&
            !canHaveCenterPort(targetElement)) {
            // console.debug('[Connection] Skipped: center port not allowed on target relationship');
            continue;
          }

          // Skip if source or target element could not be resolved
          if (!sourceElement || !targetElement) {
            // console.warn('[Connection] Skipped: could not resolve elements', {
            //   sourceId: port.element, sourceResolved: !!sourceElement,
            //   targetId: connectionTarget.element, targetResolved: !!targetElement,
            // });
            continue;
          }

          // console.debug('[Connection] Valid connection pair', {
          //   source: { id: port.element, dir: port.direction, type: sourceElement.type },
          //   target: { id: connectionTarget.element, dir: connectionTarget.direction, type: targetElement.type },
          // });
          connections.push({ source: port, target: connectionTarget, sourceElement, targetElement });
        }

        if (!connections.length) {
          // console.warn('[Connection] No valid connections after validation');
        }

        const relationships = connections.map((connection) => {
          const { sourceElement, targetElement } = connection;

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
                sourceElement as any,
                targetElement as any,
              ]);

              // console.debug('[Connection] Supported relationship types', {
              //   common: commonSupportedConnections,
              //   diagramDefault: DefaultUMLRelationshipType[getState().diagram.type],
              // });

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
              { element: sourceElement as any, direction: connection.source.direction },
              { element: targetElement as any, direction: connection.target.direction },
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

        // console.debug('[Connection] Result', {
        //   attempted: relationships.length,
        //   valid: validRelationships.length,
        //   types: validRelationships.map((r) => r?.type),
        // });

        if (validRelationships.length) {
          // Use type assertion to satisfy TypeScript
          dispatch(UMLElementCommonRepository.create(validRelationships as IUMLElement[]));

          // Auto-fill context class name for OCL constraints when a ClassOCLLink is created
          for (const rel of validRelationships) {
            if (rel && rel.type === UMLRelationshipType.ClassOCLLink) {
              const relationship = rel as IUMLRelationship;
              const sourceEl = dispatch(UMLElementCommonRepository.getById(relationship.source.element));
              const targetEl = dispatch(UMLElementCommonRepository.getById(relationship.target.element));

              // Determine which is the constraint and which is the class
              let constraintEl: IUMLElement | null = null;
              let classEl: IUMLElement | null = null;

              if (sourceEl?.type === UMLElementType.ClassOCLConstraint) {
                constraintEl = sourceEl;
                classEl = targetEl;
              } else if (targetEl?.type === UMLElementType.ClassOCLConstraint) {
                constraintEl = targetEl;
                classEl = sourceEl;
              }

              // Auto-fill the constraint text if it doesn't already have a context clause
              const currentConstraint = (constraintEl as any)?.constraint || '';
              const hasContext = currentConstraint.trimStart().startsWith('context ');
              if (constraintEl && classEl && !hasContext) {
                dispatch(UMLElementCommonRepository.update<any>(constraintEl.id, {
                  constraint: `context ${classEl.name} inv : `,
                }));
              }
            }
          }
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
