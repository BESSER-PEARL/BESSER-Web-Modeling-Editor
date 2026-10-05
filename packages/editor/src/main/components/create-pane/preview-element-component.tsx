import React, { Component } from 'react';
import { UMLElement } from '../../services/uml-element/uml-element';
import { Draggable } from '../draggable/draggable';
import { DropEvent } from '../draggable/drop-event';
import { Point } from '../../utils/geometry/point';
import { styled } from '../theme/styles';
import { CanvasElement } from '../uml-element/canvas-element';
import { hoverable } from '../uml-element/hoverable/hoverable';

type Props = {
  element: UMLElement;
  create: (element: UMLElement, owner?: string) => void;
  /** Model coordinates of the visible canvas centre, used to insert without dragging. */
  getInsertCenter?: () => { x: number; y: number } | undefined;
  scale?: number;
};

export const Preview = styled(hoverable(CanvasElement)).attrs((props: { scale?: number }) => ({
  child: CanvasElement,
  scale: props.scale,
}))`
  overflow: visible;
  fill: ${(props) => props.theme.color.background};
  scale: ${(props) => props.scale ?? 0.8};
  transform-origin: center;
`;

const PaletteItem = styled.div`
  border-radius: 4px;
  outline: none;

  &:focus-visible {
    outline: 2px solid ${(props) => props.theme.color.primary};
    outline-offset: 2px;
  }
`;

// A pointer that travels further than this between press and release was a drag, not a click.
const CLICK_TOLERANCE = 4;

export class PreviewElementComponent extends Component<Props> {
  private pointerStart?: { x: number; y: number };

  render() {
    const { element } = this.props;

    return (
      <PaletteItem
        role="button"
        tabIndex={0}
        aria-label={element.name || element.type}
        onPointerDown={this.onPointerDown}
        onClick={this.onClick}
        onKeyDown={this.onKeyDown}
      >
        <Draggable onDrop={this.onDrop}>
          <Preview id={element.id} />
        </Draggable>
      </PaletteItem>
    );
  }

  private onDrop = (event: DropEvent) => {
    const element = this.props.element.clone({
      bounds: { ...this.props.element.bounds, ...event.position },
    });

    this.props.create(element, event.owner);
  };

  private onPointerDown = (event: React.PointerEvent) => {
    this.pointerStart = { x: event.clientX, y: event.clientY };
  };

  private onClick = (event: React.MouseEvent) => {
    const start = this.pointerStart;
    this.pointerStart = undefined;
    // detail === 0 is a keyboard-generated click; onKeyDown already handled it.
    if (!start || event.detail === 0) return;
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > CLICK_TOLERANCE) return;
    this.insertAtCenter();
  };

  private onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    // Keep the document-level canvas shortcuts (Enter opens the selection's properties) out of it.
    event.stopPropagation();
    this.insertAtCenter();
  };

  /** Insert the element centred on the visible canvas, through the same create path as a drop. */
  private insertAtCenter() {
    const center = this.props.getInsertCenter?.();
    if (!center) return;
    const { bounds } = this.props.element;
    this.onDrop({
      position: new Point(
        Math.round((center.x - bounds.width / 2) / 10) * 10,
        Math.round((center.y - bounds.height / 2) / 10) * 10,
      ),
    });
  }
}
