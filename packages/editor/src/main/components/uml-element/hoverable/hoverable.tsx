import React, { Component, ComponentType } from 'react';
import { findDOMNode } from 'react-dom';
import { connect, ConnectedComponent } from 'react-redux';
import { UMLElementRepository } from '../../../services/uml-element/uml-element-repository';
import { ModelState } from '../../store/model-state';
import { UMLElementComponentProps } from '../uml-element-component-props';
import { UMLContainer } from '../../../services/uml-container/uml-container';

import { canElementConnect } from '../connectable/connectable';

type OwnProps = UMLElementComponentProps;

type StateProps = { cannotBeHovered: boolean };

type DispatchProps = {
  hover: typeof UMLElementRepository.hover;
  leave: typeof UMLElementRepository.leave;
};

type Props = OwnProps & StateProps & DispatchProps;

const enhance = connect<StateProps, DispatchProps, OwnProps, ModelState>(
  (state, props) => {
    let canConnect = canElementConnect(state, props)

    return {
      // cannot emmit hover events when the selection box is active
      // or (any object is moving and the object is not a UMLContainer)
      cannotBeHovered: !canConnect ||
        state.editor.selectionBoxActive ||
        (state.moving.length > 0 && !UMLContainer.isUMLContainer(state.elements[props.id])),
    };
  },
  {
    hover: UMLElementRepository.hover,
    leave: UMLElementRepository.leave,
  },
);

export const hoverable = (
  WrappedComponent: ComponentType<UMLElementComponentProps>,
): ConnectedComponent<ComponentType<Props>, OwnProps> => {
  class Hoverable extends Component<Props> {
    private leaveTimer: ReturnType<typeof setTimeout> | null = null;

    componentDidMount() {
      const node = findDOMNode(this) as HTMLElement;
      node.addEventListener('pointerenter', this.enter);
      node.addEventListener('pointerleave', this.leave);
    }

    componentWillUnmount() {
      if (this.leaveTimer) clearTimeout(this.leaveTimer);
      const node = findDOMNode(this) as HTMLElement;
      node.removeEventListener('pointerenter', this.enter);
      node.removeEventListener('pointerleave', this.leave);
    }

    render() {
      const { hover, leave, cannotBeHovered, ...props } = this.props;
      return <WrappedComponent {...props} />;
    }

    private enter = (event: MouseEvent) => {
      if (this.leaveTimer) {
        clearTimeout(this.leaveTimer);
        this.leaveTimer = null;
      }
      // console.debug('[Hover] enter', { id: this.props.id, cannotBeHovered: this.props.cannotBeHovered, target: event.target });
      if (!this.props.cannotBeHovered) this.props.hover(this.props.id);
      event.stopPropagation();
    };

    private leave = (event: MouseEvent) => {
      // console.debug('[Hover] leave', { id: this.props.id, cannotBeHovered: this.props.cannotBeHovered, relatedTarget: event.relatedTarget });
      if (this.leaveTimer) clearTimeout(this.leaveTimer);
      this.leaveTimer = setTimeout(() => {
        if (!this.props.cannotBeHovered) this.props.leave(this.props.id);
        this.leaveTimer = null;
      }, 30);
      event.stopPropagation();
    };
  }

  return enhance(Hoverable);
};
