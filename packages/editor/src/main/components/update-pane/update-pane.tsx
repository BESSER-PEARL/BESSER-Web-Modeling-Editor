import React, { Component, ComponentClass, ComponentType, createRef, RefObject } from 'react';
import { createPortal } from 'react-dom';
import { connect } from 'react-redux';
import { compose } from 'redux';
import { Popups } from '../../packages/popups';
import { UMLElementType } from '../../packages/uml-element-type';
import { ApollonMode } from '../../services/editor/editor-types';
import { IUMLElement } from '../../services/uml-element/uml-element';
import { UMLElementRepository } from '../../services/uml-element/uml-element-repository';
import { UMLRelationship } from '../../services/uml-relationship/uml-relationship';
import { AsyncDispatch } from '../../utils/actions/actions';
import { Path } from '../../utils/geometry/path';
import { Point } from '../../utils/geometry/point';
import { Assessment } from '../assessment/assessment';
import { CanvasContext } from '../canvas/canvas-context';
import { withCanvas } from '../canvas/with-canvas';
import { Popover } from '../controls/popover/popover';
import { ModelState } from '../store/model-state';
import { withRoot } from '../root/with-root';
import { RootContext } from '../root/root-context';

type OwnProps = {};

type StateProps = {
  element: IUMLElement | null;
  disabled: boolean;
  mode: ApollonMode;
};

type DispatchProps = {
  updateEnd: typeof UMLElementRepository.updateEnd;
  getAbsolutePosition: AsyncDispatch<typeof UMLElementRepository.getAbsolutePosition>;
};

type Props = OwnProps & StateProps & DispatchProps & CanvasContext & RootContext;

const enhance = compose<ComponentClass<OwnProps>>(
  withCanvas,
  withRoot,
  connect<StateProps, DispatchProps, OwnProps, ModelState>(
    (state) => ({
      element: state.elements[state.updating[0]],
      disabled: !state.editor.enablePopups,
      mode: state.editor.mode,
    }),
    {
      updateEnd: UMLElementRepository.updateEnd,
      getAbsolutePosition: UMLElementRepository.getAbsolutePosition as any as AsyncDispatch<
        typeof UMLElementRepository.getAbsolutePosition
      >,
    },
  ),
);

const initialState = Object.freeze({
  position: null as { x: number; y: number } | null,
  placement: undefined as 'top' | 'right' | 'bottom' | 'left' | undefined,
  alignment: undefined as 'start' | 'center' | 'end' | undefined,
  isDragging: false as boolean, // Change to boolean type instead of literal false
  dragOffset: { x: 0, y: 0 },
  hasBeenMoved: false as boolean, // Track if the user has manually moved the popover
  hoverEdge: false as boolean, // Add this property
});

type State = typeof initialState;

class UnwrappedUpdatePane extends Component<Props, State> {
  state: Readonly<State> = {
    ...initialState,
    hoverEdge: false, // Add this to track if we're hovering over a draggable edge
  };

  popover: RefObject<HTMLDivElement> = createRef();

  componentDidUpdate(prevProps: Readonly<Props>): void {
    if (!prevProps.element && this.props.element) {
      // First appearance of popover
      setTimeout(this.show, 0);
    } else if (prevProps.element && this.props.element && prevProps.element.id !== this.props.element.id) {
      // Element has changed - reset position tracking and reposition
      this.setState({ hasBeenMoved: false }, () => {
        this.position(this.props);
      });
    }
  }

  componentDidMount(): void {
    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('mouseup', this.handleMouseUp);
  }

  componentWillUnmount(): void {
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('mouseup', this.handleMouseUp);
  }

  render() {
    const { element, disabled, mode } = this.props;
    const { position, alignment, placement, hoverEdge } = this.state;

    if (!element || disabled || !position) {
      return null;
    }

    let CustomPopupComponent: ComponentType<{ element: IUMLElement }> | null;
    if (mode === ApollonMode.Assessment) {
      CustomPopupComponent = Assessment;
    } else {
      CustomPopupComponent = Popups[element.type as UMLElementType];
    }
    if (!CustomPopupComponent) {
      return null;
    }

    return createPortal(
      <Popover 
        ref={this.popover} 
        position={position} 
        placement={placement} 
        alignment={alignment} 
        maxHeight={500}
        style={{ cursor: hoverEdge ? 'move' : 'default' }}
        onMouseDown={this.handleMouseDown}
        onMouseMove={this.handleMouseOver}
      >
        <CustomPopupComponent element={element} />
      </Popover>,
      this.props.root,
    );
  }

  private handleMouseDown = (event: React.MouseEvent): void => {
    // Only trigger drag on the popover's header/border areas, not on content
    // We can check if the click is near the edges of the popover
    if (this.popover.current) {
      const rect = this.popover.current.getBoundingClientRect();
      const dragHandleSize = 15; // Use the same size for all edges
      
      const isEdgeClick = 
        event.clientY - rect.top <= dragHandleSize || // Top edge
        rect.bottom - event.clientY <= dragHandleSize || // Bottom edge
        event.clientX - rect.left <= dragHandleSize || // Left edge
        rect.right - event.clientX <= dragHandleSize; // Right edge
      
      if (isEdgeClick) {
        const { position } = this.state;
        if (position) {
          this.setState({
            isDragging: true,
            dragOffset: {
              x: event.clientX - position.x,
              y: event.clientY - position.y,
            }
          });
          // Prevent text selection during drag
          event.preventDefault();
        }
      }
    }
  };

  private handleMouseMove = (event: MouseEvent): void => {
    const { isDragging, dragOffset } = this.state;
    if (isDragging) {
      // Update position based on mouse movement
      this.setState({
        position: {
          x: event.clientX - dragOffset.x,
          y: event.clientY - dragOffset.y,
        },
        hasBeenMoved: true // Mark that the user has manually moved the popover
      });
    }
  };

  private handleMouseUp = (): void => {
    if (this.state.isDragging) {
      this.setState({ isDragging: false });
    }
  };

  private handleMouseOver = (event: React.MouseEvent): void => {
    if (this.popover.current) {
      const rect = this.popover.current.getBoundingClientRect();
      const dragHandleSize = 20; // Same size as in handleMouseDown
      
      const isEdgeHover = 
        event.clientY - rect.top <= dragHandleSize || // Top edge
        rect.bottom - event.clientY <= dragHandleSize || // Bottom edge
        event.clientX - rect.left <= dragHandleSize || // Left edge
        rect.right - event.clientX <= dragHandleSize; // Right edge
      
      // Only update state if it's changed to avoid unnecessary renders
      if (isEdgeHover !== this.state.hoverEdge) {
        this.setState({ hoverEdge: isEdgeHover });
      }
    }
  };

  private show = (): void => {
    // Only position if it hasn't been moved by the user
    if (!this.state.hasBeenMoved) {
      this.position(this.props);
    }
    document.addEventListener('pointerdown', this.onPointerDown);

    const { parentElement: canvas }: SVGSVGElement = this.props.canvas.layer;
    if (canvas) {
      canvas.addEventListener('scroll', this.onScroll);
    }
  };

  private dismiss = (): void => {
    this.setState(initialState);
    document.removeEventListener('pointerdown', this.onPointerDown);

    const { parentElement: canvas }: SVGSVGElement = this.props.canvas.layer;
    if (canvas) {
      canvas.removeEventListener('scroll', this.onScroll);
    }

    if (this.props.element) {
      this.props.updateEnd(this.props.element.id);
    }
  };

  private position = ({ element, canvas }: Readonly<Props>): void => {
    // Skip repositioning if the user has manually moved the popover
    if (this.state.hasBeenMoved) {
      return;
    }
    
    const container: HTMLElement | null = canvas.layer.parentElement;

    if (element && container) {
      const absolute: Point = this.props
        // relative to drawing area (0,0)
        .getAbsolutePosition(element.id)
        .add(
          canvas
            .origin()
            .subtract(this.props.root.getBoundingClientRect().x, this.props.root.getBoundingClientRect().y),
        );

      const elementCenter: Point = absolute.add(element.bounds.width / 2, element.bounds.height / 2);

      const position = absolute;

      // calculate if element is in half or right position of canvas (drawing area) and align popup
      const canvasBounds: ClientRect = container.getBoundingClientRect();
      const placement = elementCenter.x < canvasBounds.width / 2 ? 'right' : 'left';
      const alignment = elementCenter.y < canvasBounds.height / 2 ? 'start' : 'end';

      if (UMLRelationship.isUMLRelationship(element)) {
        const path = new Path(element.path);

        const p = path.position(path.length / 2);
        position.x += p.x;
        position.y += p.y;

        if (alignment === 'start') {
          position.y -= 15;
        }
        if (alignment === 'end') {
          position.y += 15;
        }
      } else {
        if (placement === 'right') {
          // add width to be on right side of element
          position.x += element.bounds.width;
        }
        if (alignment === 'end') {
          // add height to be at the bottom of element
          position.y += element.bounds.height;
        }
      }

      this.setState({ position, alignment, placement });
    }
  };

  private onPointerDown = (event: PointerEvent): void => {
    if (this.popover.current && event.target instanceof HTMLElement && this.popover.current.contains(event.target)) {
      return;
    }

    this.dismiss();
  };

  private onScroll = (event: Event) => {
    this.dismiss();
  };
}

export const UpdatePane = enhance(UnwrappedUpdatePane);
