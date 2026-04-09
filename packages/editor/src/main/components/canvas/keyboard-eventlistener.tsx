import { Component, ComponentType } from 'react';
import { connect } from 'react-redux';
import { compose } from 'redux';
import { CopyRepository } from '../../services/copypaste/copy-repository';
import { ApollonMode } from '../../services/editor/editor-types';
import { UMLElementRepository } from '../../services/uml-element/uml-element-repository';
import { UndoRepository } from '../../services/undo/undo-repository';
import { AsyncDispatch } from '../../utils/actions/actions';
import { ModelState } from '../store/model-state';
import { CanvasContext } from './canvas-context';
import { withCanvas } from './with-canvas';

type OwnProps = {};

type StateProps = {
  readonly: boolean;
  mode: ApollonMode;
};

type DispatchProps = {
  undo: typeof UndoRepository.undo;
  redo: typeof UndoRepository.redo;
  copy: typeof CopyRepository.copy;
  paste: typeof CopyRepository.paste;
  select: AsyncDispatch<typeof UMLElementRepository.select>;
  deselect: AsyncDispatch<typeof UMLElementRepository.deselect>;
  startMoving: AsyncDispatch<typeof UMLElementRepository.startMoving>;
  move: AsyncDispatch<typeof UMLElementRepository.move>;
  endMoving: AsyncDispatch<typeof UMLElementRepository.endMoving>;
  delete: AsyncDispatch<typeof UMLElementRepository.delete>;
};

type Props = OwnProps & StateProps & DispatchProps & CanvasContext;

const enhance = compose<ComponentType<OwnProps>>(
  withCanvas,
  connect<StateProps, DispatchProps, OwnProps, ModelState>(
    (state) => ({
      readonly: state.editor.readonly,
      mode: state.editor.mode,
    }),
    {
      undo: UndoRepository.undo,
      redo: UndoRepository.redo,
      copy: CopyRepository.copy,
      paste: CopyRepository.paste,
      select: UMLElementRepository.select,
      deselect: UMLElementRepository.deselect,
      startMoving: UMLElementRepository.startMoving,
      move: UMLElementRepository.move,
      endMoving: UMLElementRepository.endMoving,
      delete: UMLElementRepository.delete,
    },
  ),
);

class KeyboardEventListenerComponent extends Component<Props> {
  componentDidMount() {
    const { layer } = this.props.canvas;
    if (!this.props.readonly && this.props.mode !== ApollonMode.Assessment) {
      // Listen on document so keyboard shortcuts work regardless of SVG focus
      document.addEventListener('keydown', this.keyDown);
      document.addEventListener('keyup', this.keyUp);
    }
    layer.addEventListener('pointerdown', this.pointerDown);
  }

  componentWillUnmount() {
    const { layer } = this.props.canvas;
    document.removeEventListener('keydown', this.keyDown);
    document.removeEventListener('keyup', this.keyUp);
    layer.removeEventListener('pointerdown', this.pointerDown);
  }

  render() {
    return null;
  }

  private pointerDown = (event: PointerEvent) => {
    // console.log('[PointerDown] target:', (event.target as HTMLElement).tagName, 'x:', Math.round(event.clientX), 'y:', Math.round(event.clientY));
    if (event.target !== event.currentTarget || event.shiftKey) {
      return;
    }
    this.props.deselect();
  };

  private keyDown = (event: KeyboardEvent) => {
    // Don't intercept keyboard shortcuts when user is typing in a form element
    const target = event.target as HTMLElement;
    const tag = target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) {
      return;
    }

    switch (event.key) {
      case 'ArrowUp':
        event.preventDefault();
        if (!event.repeat) {
          this.props.startMoving();
        }
        this.props.move({ x: 0, y: -10 });
        break;
      case 'ArrowRight':
        event.preventDefault();
        if (!event.repeat) {
          this.props.startMoving();
        }
        this.props.move({ x: 10, y: 0 });
        break;
      case 'ArrowDown':
        event.preventDefault();
        if (!event.repeat) {
          this.props.startMoving();
        }
        this.props.move({ x: 0, y: 10 });
        break;
      case 'ArrowLeft':
        event.preventDefault();
        if (!event.repeat) {
          this.props.startMoving();
        }
        this.props.move({ x: -10, y: 0 });
        break;
      case 'Backspace':
      case 'Delete':
        event.preventDefault();
        this.props.delete();
        break;
      case 'Escape':
        event.preventDefault();
        this.props.deselect();
        break;
    }
    if (event.metaKey || event.ctrlKey) {
      switch (event.key) {
        case 'a':
          event.preventDefault();
          this.props.select();
          break;
        case 'c':
          event.preventDefault();
          this.props.copy();
          break;
        case 'v':
          event.preventDefault();
          this.props.paste();
          break;
        case 'z':
          event.preventDefault();
          event.shiftKey ? this.props.redo() : this.props.undo();
          break;
      }
    }
  };

  private keyUp = (event: KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowUp':
      case 'ArrowRight':
      case 'ArrowDown':
      case 'ArrowLeft':
        this.props.endMoving(undefined, true);
        break;
    }
  };
}

export const KeyboardEventListener = enhance(KeyboardEventListenerComponent);
