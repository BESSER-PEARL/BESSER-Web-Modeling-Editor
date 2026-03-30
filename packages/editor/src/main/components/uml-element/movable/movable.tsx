import React, { Component, ComponentType } from 'react';
import { findDOMNode } from 'react-dom';
import { connect, ConnectedComponent } from 'react-redux';
import { UMLElementRepository } from '../../../services/uml-element/uml-element-repository';
import { AsyncDispatch } from '../../../utils/actions/actions';
import { Point } from '../../../utils/geometry/point';
import { ModelState } from '../../store/model-state';
import { UMLElementComponentProps } from '../uml-element-component-props';
import isMobile from 'is-mobile';
import { getClientEventCoordinates } from '../../../utils/touch-event';

type StateProps = {
  movable: boolean;
  moving: boolean;
  zoomFactor: number;
  selectionBoxActive: boolean;
};

type DispatchProps = {
  start: AsyncDispatch<typeof UMLElementRepository.startMoving>;
  move: AsyncDispatch<typeof UMLElementRepository.move>;
  end: AsyncDispatch<typeof UMLElementRepository.endMoving>;
};

type Props = UMLElementComponentProps & StateProps & DispatchProps;

const initialState = {
  offset: new Point(),
};

type State = typeof initialState;

const enhance = connect<StateProps, DispatchProps, UMLElementComponentProps, ModelState>(
  (state, props) => ({
    movable: state.selected.includes(props.id) && !state.resizing.includes(props.id) && !state.connecting.length,
    moving: state.moving.includes(props.id),
    zoomFactor: state.editor.zoomFactor,
    selectionBoxActive: state.editor.selectionBoxActive,
  }),
  {
    start: UMLElementRepository.startMoving,
    move: UMLElementRepository.move,
    end: UMLElementRepository.endMoving,
  },
);

/**
 * HOC that makes a UML element draggable on the canvas.
 *
 * FIX (2026-03-30): Replaced React `this.state.offset` with a plain instance
 * variable `this.lastPointer` for pointer position tracking during drag.
 *
 * PROBLEM: The original code used `this.setState()` to store the last pointer
 * position and `this.state.offset` to read it back in the next `pointermove`.
 * Because React batches `setState` calls asynchronously, rapid pointer events
 * would read a stale `this.state.offset`, producing wildly wrong deltas
 * (e.g., dx jumps from +10 to -800 and back). This caused elements to
 * visually teleport/jump while being dragged.
 *
 * FIX: `this.lastPointer` is a plain class field — reads and writes are
 * synchronous, so the delta calculation in `onPointerMove` always uses the
 * true previous pointer position. The `move()` method still batches Redux
 * dispatches via `requestAnimationFrame` for performance.
 *
 * BEFORE (broken):
 *   onPointerDown:  this.setState({ offset: new Point(clientX, clientY) })
 *   onPointerMove:  dx = (clientX - this.state.offset.x) / zoom   // STALE!
 *   move():         this.setState(s => ({ offset: s.offset.add(dx * zoom, ...) }))
 *
 * AFTER (fixed):
 *   onPointerDown:  this.lastPointer = new Point(clientX, clientY)
 *   onPointerMove:  dx = (clientX - this.lastPointer.x) / zoom    // always fresh
 *                   this.lastPointer = new Point(clientX, clientY)  // update before move
 *   move():         (no offset state needed)
 */
export const movable = (
  WrappedComponent: ComponentType<UMLElementComponentProps>,
): ConnectedComponent<ComponentType<Props>, UMLElementComponentProps> => {
  class Movable extends Component<Props, State> {
    state = initialState;
    private moveWindow = new Point();
    private moveRaf: number | null = null;
    /** Synchronous pointer tracking — replaces the old async this.state.offset */
    private lastPointer = new Point();

    move = (x: number, y: number) => {
      x = Math.round(x / 10) * 10;
      y = Math.round(y / 10) * 10;
      if (x === 0 && y === 0) return;

      // Batch Redux dispatches to one per animation frame to avoid flooding re-renders
      this.moveWindow = new Point(this.moveWindow.x + x, this.moveWindow.y + y);
      if (!this.moveRaf) {
        this.moveRaf = requestAnimationFrame(() => {
          this.props.move({ x: this.moveWindow.x, y: this.moveWindow.y });
          this.moveWindow = new Point();
          this.moveRaf = null;
        });
      }
    };

    componentDidMount() {
      const node = findDOMNode(this) as HTMLElement;
      node.style.cursor = 'move';
      const child = node.firstChild as HTMLElement;
      if (isMobile({ tablet: true })) {
        child.addEventListener('touchstart', this.onPointerDown);
      } else {
        child.addEventListener('pointerdown', this.onPointerDown);
      }
    }

    componentDidUpdate(prevProps: Readonly<Props>, prevState: Readonly<State>, snapshot?: any) {
      const node = findDOMNode(this) as HTMLElement;
      if (this.props.selectionBoxActive) {
        node.style.cursor = 'default';
      } else {
        node.style.cursor = 'move';
      }
    }

    componentWillUnmount() {
      if (this.moveRaf) cancelAnimationFrame(this.moveRaf);
      const node = findDOMNode(this) as HTMLElement;
      const child = node.firstChild as HTMLElement;

      if (isMobile({ tablet: true })) {
        child.removeEventListener('touchstart', this.onPointerDown);
        document.removeEventListener('touchmove', this.onPointerMove);
        document.removeEventListener('touchend', this.onPointerUp);
      } else {
        child.removeEventListener('pointerdown', this.onPointerDown);
        document.removeEventListener('pointermove', this.onPointerMove);
        document.removeEventListener('pointerup', this.onPointerUp);
      }
    }

    render() {
      const { movable: _movable, zoomFactor: _zoomFactor, start, move, end, ...props } = this.props;
      return <WrappedComponent {...props} />;
    }

    private onPointerDown = (event: PointerEvent | TouchEvent) => {
      if (event.which && event.which !== 1) {
        return;
      }

      const clientEventCoordinates = getClientEventCoordinates(event);

      // Store pointer position synchronously — no setState race condition
      this.lastPointer = new Point(clientEventCoordinates.clientX, clientEventCoordinates.clientY);

      if (isMobile({ tablet: true })) {
        document.addEventListener('touchmove', this.onPointerMove);
        document.addEventListener('touchend', this.onPointerUp, { once: true });
      } else {
        document.addEventListener('pointermove', this.onPointerMove);
        document.addEventListener('pointerup', this.onPointerUp, { once: true });
      }
      setTimeout(() => !this.props.movable && this.onPointerUp(), 0);
    };

    private onPointerMove = (event: PointerEvent | TouchEvent) => {
      const { zoomFactor = 1 } = this.props;

      const clientEventCoordinates = getClientEventCoordinates(event);
      const x = (clientEventCoordinates.clientX - this.lastPointer.x) / zoomFactor;
      const y = (clientEventCoordinates.clientY - this.lastPointer.y) / zoomFactor;

      if (!this.props.moving) {
        if (Math.abs(x) > 5 || Math.abs(y) > 5) {
          this.props.start();
        }
      } else {
        // Update lastPointer synchronously BEFORE calling move
        this.lastPointer = new Point(clientEventCoordinates.clientX, clientEventCoordinates.clientY);
        this.move(x, y);
      }
    };

    private onPointerUp = () => {
      if (isMobile({ tablet: true })) {
        document.removeEventListener('touchmove', this.onPointerMove);
      } else {
        document.removeEventListener('pointermove', this.onPointerMove);
      }
      if (!this.props.moving) {
        return;
      }

      // Flush any pending batched move before ending
      if (this.moveRaf) {
        cancelAnimationFrame(this.moveRaf);
        this.moveRaf = null;
        if (this.moveWindow.x !== 0 || this.moveWindow.y !== 0) {
          this.props.move({ x: this.moveWindow.x, y: this.moveWindow.y });
          this.moveWindow = new Point();
        }
      }

      this.lastPointer = new Point();
      this.props.end();
    };
  }

  return enhance(Movable);
};
