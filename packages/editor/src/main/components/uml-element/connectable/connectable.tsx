import React, { Component, ComponentType } from 'react';
import { findDOMNode } from 'react-dom';
import { connect, ConnectedComponent } from 'react-redux';
import { Direction } from '../../../services/uml-element/uml-element-port';
import { UMLElementRepository } from '../../../services/uml-element/uml-element-repository';
import { UMLRelationshipRepository } from '../../../services/uml-relationship/uml-relationship-repository';
import { AsyncDispatch } from '../../../utils/actions/actions';
import { Point } from '../../../utils/geometry/point';
import { ModelState } from '../../store/model-state';
import { styled } from '../../theme/styles';
import { UMLElementComponentProps } from '../uml-element-component-props';
import { UMLElements } from '../../../packages/uml-elements';
import { UMLRelationships } from '../../../packages/uml-relationships';
import { UMLElementFeatures } from '../../../services/uml-element/uml-element-features';
import { UMLRelationshipFeatures } from '../../../services/uml-relationship/uml-relationship-features';
import { UMLElementType, UMLRelationshipType } from '../../..';
import { convertTouchEndIntoPointerUp } from '../../../utils/touch-event';
import isMobile from 'is-mobile';
import { getPortsForElement, IUMLElement } from '../../../services/uml-element/uml-element';
import { IUMLRelationship, UMLRelationship } from '../../../services/uml-relationship/uml-relationship';
import { getPortsForRelationship, canHaveCenterPort } from '../../../services/uml-relationship/uml-relationship-port';

import { diagramBridge } from '../../../services/diagram-bridge';

type StateProps = {
  hovered: boolean;
  selected: boolean;
  connecting: boolean;
  reconnecting: boolean;
  element: IUMLElement;
  type: UMLElementType | UMLRelationshipType;
};

type DispatchProps = {
  start: AsyncDispatch<typeof UMLElementRepository.startConnecting>;
  connect: AsyncDispatch<typeof UMLElementRepository.connect>;
  reconnect: AsyncDispatch<typeof UMLRelationshipRepository.reconnect>;
};
type ExtendedStateProps = StateProps & {
  canConnect?: boolean;
};
type Props = UMLElementComponentProps & ExtendedStateProps & DispatchProps;

const enhance = connect<StateProps, DispatchProps, UMLElementComponentProps, ModelState>(
  (state, props) => {

    const canConnect = canElementConnect(state, props);
    
    return {
      hovered: state.hovered[0] === props.id,
      selected: state.selected.includes(props.id),
      connecting: !!state.connecting.length,
      reconnecting: !!Object.keys(state.reconnecting).length,
      element: state.elements[props.id],
      type: state.elements[props.id].type as UMLElementType | UMLRelationshipType,
      canConnect,
    };
  },
  {
    start: UMLElementRepository.startConnecting,
    connect: UMLElementRepository.connect,
    reconnect: UMLRelationshipRepository.reconnect,
  },
);

const Handle = styled((props) => {
  const { alternativePortVisualization, ...otherProps } = props;
  // alternative port visualization size
  const alternativePortHeight = 15;
  const alternativePortWidth = 15;
  const alternativePortCircleSize = 0;

  // default port visualization size
  const defaultPortSize = 15;
  if (alternativePortVisualization) {
    return (
      <svg {...otherProps}>
        <path
          d={`M ${alternativePortWidth / 2
            } 0 v -${alternativePortHeight} h -${alternativePortWidth} v ${alternativePortHeight} Z`}
        />
        <path
          d={
            `M -${alternativePortCircleSize / 2} -${alternativePortHeight + alternativePortCircleSize / 2}` +
            ` a ${alternativePortCircleSize / 2} ${alternativePortCircleSize / 2
            } 0 0 1 ${alternativePortCircleSize} 0` +
            ` a ${alternativePortCircleSize / 2} ${alternativePortCircleSize / 2} 0 0 1 -${alternativePortCircleSize} 0`
          }
        />
      </svg>
    );
  } else {
    return (
      <svg {...otherProps}>
        <path
          d={`M -${defaultPortSize} 0 A ${defaultPortSize / 2} ${defaultPortSize / 2} 0 0 1 ${defaultPortSize} 0`}
        />
      </svg>
    );
  }
}).attrs<{ direction: Direction; ports: { [key in Direction]: Point } }>(({ direction, ports }) => ({
  fill: '#0064ff',
  fillOpacity: 0.2,
  x: `${ports[direction].x}px`,
  y: `${ports[direction].y}px`,
  rotate:
    direction === Direction.Up || direction === Direction.Topright || direction === Direction.Topleft
      ? 0
      : direction === Direction.Right || direction === Direction.Upright || direction === Direction.Downright
        ? 90
        : direction === Direction.Down || direction === Direction.Bottomright || direction === Direction.Bottomleft
          ? 180
          : direction === Direction.Center
            ? 0
            : -90,
})) <{ rotate: number }>`
  cursor: crosshair;
  pointer-events: all;

  path {
    transform: rotate(${(props) => props.rotate}deg);
  }
`;

const CenterHandle = styled((props) => {
  const { ...otherProps } = props;
  return (
    <svg {...otherProps}>
      <circle r="7" />
    </svg>
  );
}).attrs<{ ports: { [key in Direction]: Point } }>(({ ports }) => ({
  fill: '#0064ff',
  fillOpacity: 0.3,
  x: `${ports[Direction.Center].x}px`,
  y: `${ports[Direction.Center].y}px`,
}))`
  cursor: crosshair;
  pointer-events: all;
`;

export const connectable = (
  WrappedComponent: ComponentType<UMLElementComponentProps>,
): ConnectedComponent<ComponentType<Props>, UMLElementComponentProps> => {
  class Connectable extends Component<Props> {
    componentDidMount() {
      const node = findDOMNode(this) as HTMLElement;
      node.addEventListener('pointerup', this.elementOnPointerUp.bind(this));
      if (isMobile({ tablet: true })) {
        node.addEventListener('touchend', this.elementOnPointerUp.bind(this));
      }
    }

    componentWillUnmount() {
      const node = findDOMNode(this) as HTMLElement;
      node.removeEventListener('pointerup', this.elementOnPointerUp);
      if (isMobile({ tablet: true })) {
        node.removeEventListener('touchend', this.elementOnPointerUp);
      }
    }


    render() {
      const {
        hovered,
        selected,
        connecting,
        reconnecting,
        start,
        connect: _,
        reconnect,
        type,
        element,
        canConnect,
        ...props
      } = this.props;

      if (!element) {
        return <WrappedComponent {...props} />;
      }

      const features = { ...UMLElements, ...UMLRelationships }[type].features as UMLElementFeatures &
        UMLRelationshipFeatures;

      const isRelationship = UMLRelationship.isUMLRelationship(element);
      const ports = isRelationship
        ? getPortsForRelationship(element as IUMLRelationship)
        : getPortsForElement(element);
      // // Check if we're currently connecting from a relationship center handle
      // const connectingFromRelationshipCenter = connecting &&
      //   UMLRelationship.isUMLRelationship(element);

      // Check if this relationship type is allowed to have a center port
      const allowCenterPort = isRelationship && canHaveCenterPort(element as IUMLRelationship);
      // connecting makes other ports visible to see to which you can connect

      
      return (
        <WrappedComponent {...props}>
          {props.children}
          {(hovered || selected || connecting || reconnecting) && (canConnect) && (
            <>
              {/* If it's a relationship with allowed center port, show the center point */}
              {isRelationship ? (
                allowCenterPort
                // && !connectingFromRelationshipCenter 
                && (
                  <CenterHandle
                    ports={ports}
                    direction={Direction.Center}
                    onPointerDown={this.onPointerDown}
                    onPointerUp={this.onPointerUp}
                  />
                )
              ) : (
                <>
                  {/* Top edge handles */}
                  <Handle
                    ports={ports}
                    direction={Direction.Topleft}
                    onPointerDown={this.onPointerDown}
                    onPointerUp={this.onPointerUp}
                    alternativePortVisualization={features.alternativePortVisualization}
                  />
                  <Handle
                    ports={ports}
                    direction={Direction.Up}
                    onPointerDown={this.onPointerDown}
                    onPointerUp={this.onPointerUp}
                    alternativePortVisualization={features.alternativePortVisualization}
                  />
                  <Handle
                    ports={ports}
                    direction={Direction.Topright}
                    onPointerDown={this.onPointerDown}
                    onPointerUp={this.onPointerUp}
                    alternativePortVisualization={features.alternativePortVisualization}
                  />

                  {/* Right edge handles */}
                  <Handle
                    ports={ports}
                    direction={Direction.Upright}
                    onPointerDown={this.onPointerDown}
                    onPointerUp={this.onPointerUp}
                    alternativePortVisualization={features.alternativePortVisualization}
                  />
                  <Handle
                    ports={ports}
                    direction={Direction.Right}
                    onPointerDown={this.onPointerDown}
                    onPointerUp={this.onPointerUp}
                    alternativePortVisualization={features.alternativePortVisualization}
                  />
                  <Handle
                    ports={ports}
                    direction={Direction.Downright}
                    onPointerDown={this.onPointerDown}
                    onPointerUp={this.onPointerUp}
                    alternativePortVisualization={features.alternativePortVisualization}
                  />

                  {/* Bottom edge handles */}
                  <Handle
                    ports={ports}
                    direction={Direction.Bottomleft}
                    onPointerDown={this.onPointerDown}
                    onPointerUp={this.onPointerUp}
                    alternativePortVisualization={features.alternativePortVisualization}
                  />
                  <Handle
                    ports={ports}
                    direction={Direction.Down}
                    onPointerDown={this.onPointerDown}
                    onPointerUp={this.onPointerUp}
                    alternativePortVisualization={features.alternativePortVisualization}
                  />
                  <Handle
                    ports={ports}
                    direction={Direction.Bottomright}
                    onPointerDown={this.onPointerDown}
                    onPointerUp={this.onPointerUp}
                    alternativePortVisualization={features.alternativePortVisualization}
                  />

                  {/* Left edge handles */}
                  <Handle
                    ports={ports}
                    direction={Direction.Upleft}
                    onPointerDown={this.onPointerDown}
                    onPointerUp={this.onPointerUp}
                    alternativePortVisualization={features.alternativePortVisualization}
                  />
                  <Handle
                    ports={ports}
                    direction={Direction.Left}
                    onPointerDown={this.onPointerDown}
                    onPointerUp={this.onPointerUp}
                    alternativePortVisualization={features.alternativePortVisualization}
                  />
                  <Handle
                    ports={ports}
                    direction={Direction.Downleft}
                    onPointerDown={this.onPointerDown}
                    onPointerUp={this.onPointerUp}
                    alternativePortVisualization={features.alternativePortVisualization}
                  />

                  {/* No center handle for regular elements */}
                </>
              )}
            </>
          )}
        </WrappedComponent>
      );
    }

    private elementOnPointerUp = (event: PointerEvent | TouchEvent) => {
      const node = findDOMNode(this) as HTMLElement;

      // create pointer up event in order to follow connection logic
      // created pointer up event has the correct target, (touchend triggered on same element as touchstart)
      // -> connection logic for desktop can be applied
      if (!(event instanceof PointerEvent)) {
        convertTouchEndIntoPointerUp(event);
        return;
      }

      if (!this.props.element) {
        return;
      }

      let direction;

      // if available, we can get the direction from the event target
      if (
        event.target instanceof SVGElement &&
        event.target.parentElement != null &&
        event.target.parentElement.hasAttribute('direction')
      ) {
        direction = event.target.parentElement.getAttribute('direction') as Direction;

        // Skip if trying to use center port on a non-relationship element
        const isRelationship = UMLRelationship.isUMLRelationship(this.props.element);
        if (!isRelationship && direction === Direction.Center) {
          console.warn('Cannot use center port on a non-relationship element');
          return;
        }
      }

      // otherwise get the direction the old way
      if (direction == null) {
        // calculate event position relative to object position in %
        const nodeRect = node.getBoundingClientRect();

        const relEventPosition = {
          x: (event.clientX - nodeRect.left) / nodeRect.width,
          y: (event.clientY - nodeRect.top) / nodeRect.height,
        };

        // Check if this is a relationship or regular element
        const isRelationship = UMLRelationship.isUMLRelationship(this.props.element);

        // relative port locations in %
        const relativePortLocation: { [key in Direction]: Point } = {
          // Top edge (3 points)
          [Direction.Topleft]: new Point(0.25, 0),
          [Direction.Up]: new Point(0.5, 0),
          [Direction.Topright]: new Point(0.75, 0),

          // Right edge (3 points)
          [Direction.Upright]: new Point(1, 0.25),
          [Direction.Right]: new Point(1, 0.5),
          [Direction.Downright]: new Point(1, 0.75),

          // Bottom edge (3 points)
          [Direction.Bottomleft]: new Point(0.25, 1),
          [Direction.Down]: new Point(0.5, 1),
          [Direction.Bottomright]: new Point(0.75, 1),

          // Left edge (3 points)
          [Direction.Upleft]: new Point(0, 0.25),
          [Direction.Left]: new Point(0, 0.5),
          [Direction.Downleft]: new Point(0, 0.75),

          // Center point - only for relationships
          [Direction.Center]: new Point(0.5, 0.5),
        };

        // calculate the distances to all valid handles
        const distances = Object.entries(relativePortLocation)
          // Filter out center port for regular elements
          .filter(([key]) => isRelationship || key !== Direction.Center)
          .map(([key, value]) => ({
            key,
            distance: Math.sqrt(
              Math.pow(value.x - relEventPosition.x, 2) +
              Math.pow(value.y - relEventPosition.y, 2),
            ),
          }));

        // use handle with min distance to connect to
        const minDistance = Math.min(...distances.map((value) => value.distance));
        direction = distances.filter((value) => minDistance === value.distance)[0].key as Direction;
      }

      if (this.props.connecting && this.props.canConnect) {
        this.props.connect({ element: this.props.id, direction });
      }
      if (this.props.reconnecting && !event.defaultPrevented) {
        this.props.reconnect({ element: this.props.id, direction });
        event.preventDefault();
      }
    };

    private onPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
      const direction = event.currentTarget.getAttribute('direction') as Direction;
      const id = event.currentTarget.parentElement!.getAttribute('id') as string;

      // Arrêter la propagation de l'événement pour qu'il ne soit pas capturé par d'autres éléments
      event.stopPropagation();

      // Adapter le comportement pour les associations avec le point central
      const { element } = this.props;
      if (element && UMLRelationship.isUMLRelationship(element) && direction === Direction.Center) {
        console.log('Starting connection from relationship center point', element.id);
      }

      this.props.start(direction, id);
    };

    private onPointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
      const direction = event.currentTarget.getAttribute('direction') as Direction;
      if (this.props.connecting) {
        this.props.connect({ element: this.props.id, direction });
      }
      if (this.props.reconnecting) {
        this.props.reconnect({ element: this.props.id, direction });
      }
    };
  }

  return enhance(Connectable);
};

// while this works, it is not the best way to do this
// it would be better to have a more generic way to check if an element can connect
// such as adding this information to the element itself via a list
// right now for every element, we call this function, definitely inefficient
export function canElementConnect(
  state: ModelState,
  props: UMLElementComponentProps
): boolean {
  const isConnecting = !!state.connecting.length;
  const connectingElement = isConnecting ? state.connecting[0] : undefined;
  const element = state.elements[props.id];
  const classId = element && "classId" in element ? (element as { classId?: string }).classId : undefined;

  if (!state.selected.includes(props.id) && isConnecting && classId) {
    const sourceElementId = connectingElement?.element;

    if (
      sourceElementId &&
      sourceElementId in state.elements
    ) {
      const sourceElement = state.elements[sourceElementId];
      const sourceClassId =
        "classId" in sourceElement ? (sourceElement as { classId?: string }).classId : undefined;

      if (
        sourceClassId &&
        diagramBridge.getAvailableAssociations(classId, sourceClassId).length
      ) {
        return true;
      }
      return false;
    }
    return false;
  }
  return true;
}
