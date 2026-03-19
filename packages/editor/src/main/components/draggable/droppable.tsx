import React, { Component } from 'react';
import { findDOMNode } from 'react-dom';
import { DraggableContext } from './draggable-context';
import { withDraggable } from './with-draggable';

type Props = {
  owner?: string;
  children: React.ReactNode;
} & DraggableContext;

const enhance = withDraggable;

/**
 * This component adds events listener to determine when a drop is done
 */
class DroppableComponent extends Component<Props> {
  private handler: ((event: Event) => void) | null = null;

  componentDidMount() {
    const node = findDOMNode(this) as HTMLElement;
    // not distinguished between mobile and non mobile
    // when a touchend is fired, we fire our own pointerup event which triggers the drop
    // we do this, because firing own touchend is initialized with wrong coordinates
    this.handler = this.props.onDragEnd(this.props.owner);
    node.addEventListener('pointerup', this.handler);
  }

  componentWillUnmount() {
    const node = findDOMNode(this) as HTMLElement;
    // not distinguished between mobile and non mobile
    if (this.handler) {
      node.removeEventListener('pointerup', this.handler);
    }
  }

  render() {
    return this.props.children;
  }
}

export const Droppable = enhance(DroppableComponent);
