import { styled } from '../theme/styles';
import React, { Component, ComponentType, createRef, ReactNode } from 'react';
import { connect, ConnectedComponent } from 'react-redux';
import { ModelState } from '../store/model-state';
import isMobile from 'is-mobile';
import { UMLElementRepository } from '../../services/uml-element/uml-element-repository';
import { AsyncDispatch } from '../../utils/actions/actions';
import { EditorRepository } from '../../services/editor/editor-repository';
import { AutoLayoutRepository } from '../../services/layouter/auto-layout-repository';
import { clamp } from '../../utils/clamp';
import { ZoomPane } from './zoom-pane';

const minScale: number = 0.5;
const maxScale: number = 5.0;

const grid: number = 10;
const subdivisions: number = 5;
const borderWidth: number = 1;

const StyledEditor = styled.div<{ $scale: number; $animate: boolean }>`
  display: block;
  overflow: auto;

  position: relative;
  min-height: inherit;
  max-height: inherit;

  width: ${(props) => clamp(100 / props.$scale, 100, 100 / minScale)}%;
  height: ${(props) => clamp(100 / props.$scale, 100, 100 / minScale)}%;

  -ms-overflow-style: -ms-autohiding-scrollbar;
  border: ${borderWidth}px solid ${(props) => props.theme.color.gray};
  background-color: ${(props) => props.theme.color.background};
  background-position: calc(50% + ${(grid * subdivisions - borderWidth) / 2}px)
    calc(50% + ${(grid * subdivisions - borderWidth) / 2}px);
  background-size:
    ${grid * subdivisions}px ${grid * subdivisions}px,
    ${grid * subdivisions}px ${grid * subdivisions}px,
    ${grid}px ${grid}px;
  background-image: linear-gradient(to right, ${(props) => props.theme.color.grid} 1px, transparent 1px),
    linear-gradient(to bottom, ${(props) => props.theme.color.grid} 1px, transparent 1px),
    radial-gradient(circle, ${(props) => props.theme.color.gridMinor} 0.55px, transparent 0.75px);
  background-repeat: repeat;
  background-attachment: local;
  @media (prefers-reduced-motion: no-preference) {
    transition: ${(props) => (props.$animate ? 'transform 150ms ease-out' : 'none')};
  }
  transform-origin: top left;
  transform: scale(${(props) => props.$scale ?? 1});
`;

type OwnProps = { children: ReactNode };

type StateProps = { moving: string[]; connecting: boolean; reconnecting: boolean; scale: number };

type DispatchProps = {
  move: AsyncDispatch<typeof UMLElementRepository.move>;
  setZoomFactor: typeof EditorRepository.setZoomFactor;
  autoLayout: typeof AutoLayoutRepository.layout;
};

const enhance = connect<StateProps, DispatchProps, OwnProps, ModelState>(
  (state) => ({
    moving: [...state.moving],
    connecting: state.connecting.length > 0,
    reconnecting: Object.keys(state.reconnecting).length > 0,
    scale: state.editor.zoomFactor,
  }),
  {
    move: UMLElementRepository.move,
    setZoomFactor: EditorRepository.setZoomFactor,
    autoLayout: AutoLayoutRepository.layout,
  },
);

type Props = OwnProps & StateProps & DispatchProps;

const getInitialState = () => {
  return {
    scrollingDisabled: false,
    gestureStartZoomFactor: 1.0 as number,
    isMobile: isMobile({ tablet: true }),
  };
};

type State = typeof getInitialState;

const SCROLL_BORDER = 100;
const SCROLL_DISTANCE = 5;

class EditorComponent extends Component<Props, State> {
  state = getInitialState();
  editor = createRef<HTMLDivElement>();
  zoomContainer = createRef<HTMLDivElement>();

  /** Button zoom eases; wheel zoom follows the wheel directly, so it isn't animated. */
  private animateZoom = true;
  /** Canvas point (editor-local, unscaled px) that should stay under the cursor after a wheel zoom. */
  private zoomAnchor: { clientX: number; clientY: number; x: number; y: number } | null = null;
  private wheelTarget: HTMLElement | null = null;

  private wheelHandler = (event: WheelEvent) => {
    if (event.ctrlKey) {
      event.preventDefault();
      const step = 0.1;
      const direction = event.deltaY < 0 ? step : -step;
      const { scale = 1 } = this.props;
      const newZoom = clamp(scale + direction, minScale, maxScale);
      if (newZoom === scale) return;
      const editor = this.editor.current;
      if (editor) {
        const rect = editor.getBoundingClientRect();
        this.zoomAnchor = {
          clientX: event.clientX,
          clientY: event.clientY,
          x: (event.clientX - rect.left) / scale + editor.scrollLeft,
          y: (event.clientY - rect.top) / scale + editor.scrollTop,
        };
      }
      this.animateZoom = false;
      this.props.setZoomFactor(newZoom);
    }
  };

  private zoomFromButton = (zoomFactor: number) => {
    this.animateZoom = true;
    this.zoomAnchor = null;
    this.props.setZoomFactor(zoomFactor);
  };

  componentDidMount() {
    this.wheelTarget = this.zoomContainer.current;
    this.wheelTarget?.addEventListener('wheel', this.wheelHandler, { passive: false });
  }

  componentWillUnmount() {
    this.wheelTarget?.removeEventListener('wheel', this.wheelHandler);
  }

  componentDidUpdate(prevProps: Readonly<Props>, prevState: Readonly<State>, snapshot?: any) {
    if (prevProps.scale !== this.props.scale) {
      // Keep the canvas point that was under the cursor there (best effort: scroll clamps at the edges).
      const anchor = this.zoomAnchor;
      const editor = this.editor.current;
      this.zoomAnchor = null;
      if (anchor && editor) {
        const { scale = 1 } = this.props;
        const rect = editor.getBoundingClientRect();
        editor.scrollLeft = anchor.x - (anchor.clientX - rect.left) / scale;
        editor.scrollTop = anchor.y - (anchor.clientY - rect.top) / scale;
        // Above 100% the outer container scrolls too; it takes up what the editor's own scroll couldn't.
        const container = this.zoomContainer.current;
        if (container) {
          const after = editor.getBoundingClientRect();
          container.scrollLeft += after.left + (anchor.x - editor.scrollLeft) * scale - anchor.clientX;
          container.scrollTop += after.top + (anchor.y - editor.scrollTop) * scale - anchor.clientY;
        }
      }
    }

    if (this.state.isMobile) {
      if (this.editor.current) {
        const { moving, connecting, reconnecting } = this.props;
        const deactivateScroll = moving.length > 0 || connecting || reconnecting;
        // deactivate default scrolling and use custom scrolling
        if (deactivateScroll && !this.state.scrollingDisabled) {
          this.deactivateScrolling(this.editor.current);
        } else if (!deactivateScroll && this.state.scrollingDisabled) {
          this.activateScrolling(this.editor.current);
        }
      }
    }
  }

  render() {
    const { moving, connecting, reconnecting, scale = 1.0, move, setZoomFactor, autoLayout, ...props } = this.props;

    if (this.state.isMobile) {
      return (
        <div ref={this.zoomContainer} style={{ width: '100%', overflow: scale > 1.0 ? 'auto' : 'hidden' }}>
          <StyledEditor
            ref={this.editor}
            {...props}
            onTouchMove={this.customScrolling}
            $scale={scale}
            $animate={this.animateZoom}
            data-editor-scroll="1"
          />
          <ZoomPane
            value={scale}
            onChange={this.zoomFromButton}
            onAutoLayout={() => this.props.autoLayout()}
            min={minScale}
            max={maxScale}
            step={0.2}
          />
        </div>
      );
    } else {
      return (
        <div ref={this.zoomContainer} style={{ width: '100%', overflow: scale > 1.0 ? 'auto' : 'hidden' }}>
          <StyledEditor ref={this.editor} {...props} $scale={scale} $animate={this.animateZoom} data-editor-scroll="1" />
          <ZoomPane
            value={scale}
            onChange={this.zoomFromButton}
            onAutoLayout={() => this.props.autoLayout()}
            min={minScale}
            max={maxScale}
            step={0.2}
          />
        </div>
      );
    }
  }

  customScrolling = (event: React.TouchEvent) => {
    const { scale = 1 } = this.props;

    if (this.editor.current) {
      const clientRect = this.editor.current.getBoundingClientRect();

      const touch = event.touches[event.touches.length - 1];

      // scroll when on the edge of the element
      const scrollHorizontally =
        touch.clientX * scale < clientRect.x + SCROLL_BORDER
          ? -SCROLL_DISTANCE
          : touch.clientX * scale > clientRect.x + clientRect.width - SCROLL_BORDER
            ? SCROLL_DISTANCE
            : 0;
      const scrollVertically =
        touch.clientY * scale < clientRect.y + SCROLL_BORDER
          ? -SCROLL_DISTANCE
          : touch.clientY * scale > clientRect.y + clientRect.height - SCROLL_BORDER
            ? SCROLL_DISTANCE
            : 0;
      this.editor.current.scrollBy(scrollHorizontally, scrollVertically);
      if (this.props.moving) {
        this.props.move({ x: scrollHorizontally, y: scrollVertically }, this.props.moving);
      }
    }
    event.preventDefault();
    event.stopPropagation();
  };

  activateScrolling = (target: HTMLElement) => {
    if (target) {
      // enables default scrolling in editor
      (target as HTMLElement).style.overflow = 'auto';
      // enables pull to refresh
      document.body.style.overflowY = 'auto';
      (target as HTMLElement).style.overscrollBehavior = 'auto';
      this.setState({ scrollingDisabled: false });
    }
  };

  deactivateScrolling = (target: HTMLElement) => {
    if (target) {
      // disables default scrolling in editor
      (target as HTMLElement).style.overflow = 'hidden';

      // disables pull to refresh
      document.body.style.overflowY = 'hidden';
      (target as HTMLElement).style.overscrollBehavior = 'none';
      this.setState({ scrollingDisabled: true });
    }
  };
}

export const Editor: ConnectedComponent<ComponentType<Props>, OwnProps> = enhance(EditorComponent);
