import React, { Component, ComponentType } from 'react';
import { connect, ConnectedComponent } from 'react-redux';
import { Direction, IUMLElementPort } from '../../services/uml-element/uml-element-port';
import { UMLElementRepository } from '../../services/uml-element/uml-element-repository';
import { AsyncDispatch } from '../../utils/actions/actions';
import { IPoint, Point } from '../../utils/geometry/point';
import { ModelState } from '../store/model-state';
import { getPortsForElement } from '../../services/uml-element/uml-element';
import { styled } from '../theme/styles';
import { UMLRelationship } from '../../services/uml-relationship/uml-relationship';

type OwnProps = {
  port: IUMLElementPort;
  target: Point;
};

type StateProps = {
  ports: { [key in Direction]: Point };
};

type DispatchProps = {
  end: AsyncDispatch<typeof UMLElementRepository.endConnecting>;
  getAbsolutePosition: AsyncDispatch<typeof UMLElementRepository.getAbsolutePosition>;
};

type Props = OwnProps & StateProps & DispatchProps;

// Add safe version of getPortsForElement function
const safeGetPortsForElement = (element: any): { [key in Direction]: Point } => {
  if (!element) {
    // Return default ports at origin if element is null
    return {
      [Direction.Up]: new Point(0, 0),
      [Direction.Right]: new Point(0, 0),
      [Direction.Down]: new Point(0, 0),
      [Direction.Left]: new Point(0, 0),
      [Direction.Upright]: new Point(0, 0),
      [Direction.Downright]: new Point(0, 0),
      [Direction.Upleft]: new Point(0, 0),
      [Direction.Downleft]: new Point(0, 0),
      [Direction.Topright]: new Point(0, 0),
      [Direction.Topleft]: new Point(0, 0),
      [Direction.Bottomright]: new Point(0, 0),
      [Direction.Bottomleft]: new Point(0, 0),
      [Direction.Center]: new Point(0, 0),
    };
  }
  return getPortsForElement(element);
};

const enhance = connect<StateProps, DispatchProps, OwnProps, ModelState>(
  (state, props) => {
    const element = state.elements[props.port.element];
    
    // If element is null, return default ports
    if (!element) {
      return {
        ports: safeGetPortsForElement(null)
      };
    }
    
    const isRelationship = UMLRelationship.isUMLRelationship(element);
    
    // For relationships, use getPortsForRelationship
    if (isRelationship) {
      // Import and use the helper function
      const { getPortsForRelationship } = require('../../services/uml-relationship/uml-relationship-port');
      return {
        ports: getPortsForRelationship(element)
      };
    }
    
    // For regular elements, use standard ports
    return {
      ports: safeGetPortsForElement(element)
    };
  },
  {
    end: UMLElementRepository.endConnecting,
    getAbsolutePosition: UMLElementRepository.getAbsolutePosition as any as AsyncDispatch<
      typeof UMLElementRepository.getAbsolutePosition
    >,
  },
);

const Polyline = styled.polyline`
  stroke: ${(props) => props.theme.color.primaryContrast};
  fill: 'none';
  pointer-events: 'none';
`;

class RelationshipPreview extends Component<Props> {
  render() {
    const { port, ports } = this.props;

    const { x, y }: IPoint = this.props.getAbsolutePosition(port.element);
    const position: IPoint = { ...ports[port.direction] };

    const source = new Point(x + position.x, y + position.y);
    const path = [source, this.props.target];
    const points = path.map((p) => `${p.x} ${p.y}`).join(', ');

    return <Polyline points={points} pointer-events="none" stroke="black" fill="none" strokeDasharray="5,5" />;
  }
}

export const UMLRelationshipPreview: ConnectedComponent<ComponentType<Props>, OwnProps> = enhance(RelationshipPreview);
