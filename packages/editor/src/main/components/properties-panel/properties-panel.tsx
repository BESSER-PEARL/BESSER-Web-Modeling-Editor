import React, { Component, ComponentClass, ComponentType, createRef } from 'react';
import { connect } from 'react-redux';
import { compose } from 'redux';
import en from '../../i18n/en.json';
import { Popups } from '../../packages/popups';
import { UMLElementType } from '../../packages/uml-element-type';
import { ApollonMode } from '../../services/editor/editor-types';
import { IUMLElement } from '../../services/uml-element/uml-element';
import { UMLElementRepository } from '../../services/uml-element/uml-element-repository';
import { Assessment } from '../assessment/assessment';
import { I18nContext } from '../i18n/i18n-context';
import { localized } from '../i18n/localized';
import { ModelState } from '../store/model-state';
import {
  PanelWrapper,
  ResizeHandle,
  PanelContainer,
  PanelHeader,
  PanelHeaderTitle,
  CloseButton,
  PanelBody,
} from './properties-panel-styles';

/** CSS custom property name used to communicate the panel width to fixed-position elements (e.g. assistant widget). */
const PANEL_WIDTH_VAR = '--properties-panel-width';

/**
 * Names of the ``packages.*`` groups in the editor dictionaries (e.g.
 * ``ClassDiagram``, ``StateDiagram``). Used to resolve an element-type label
 * when the diagram type doesn't map 1:1 to a group name — notably
 * ``StateMachineDiagram`` (diagram type) vs ``StateDiagram`` (i18n group).
 */
const PACKAGE_GROUPS: string[] = Object.keys((en as { packages?: Record<string, unknown> }).packages ?? {});

type OwnProps = {};

type StateProps = {
  element: IUMLElement | null;
  disabled: boolean;
  mode: ApollonMode;
  readonly: boolean;
  diagramType: string;
};

type DispatchProps = {
  updateEnd: typeof UMLElementRepository.updateEnd;
};

type Props = OwnProps & StateProps & DispatchProps & I18nContext;

const enhance = compose<ComponentClass<OwnProps>>(
  localized,
  connect<StateProps, DispatchProps, OwnProps, ModelState>(
    (state) => ({
      element: state.elements[state.updating[0]] || null,
      disabled: !state.editor.enablePopups,
      mode: state.editor.mode,
      readonly: state.editor.readonly,
      diagramType: state.diagram.type,
    }),
    {
      updateEnd: UMLElementRepository.updateEnd,
    },
  ),
);

interface PropertiesPanelState {
  panelWidth: number;
}

const MIN_WIDTH = 250;
const MAX_WIDTH = 600;
const DEFAULT_WIDTH = 320;

class PropertiesPanelComponent extends Component<Props, PropertiesPanelState> {
  state: PropertiesPanelState = {
    panelWidth: DEFAULT_WIDTH,
  };

  private wrapperRef = createRef<HTMLDivElement>();
  private prevIsVisible = false;
  private prevTotalWidth = 0;

  componentDidMount() {
    document.addEventListener('keydown', this.handleKeyDown);
    document.addEventListener('dblclick', this.handleCanvasDblClick);
    this.syncCssVar();
  }

  componentDidUpdate() {
    this.syncCssVar();
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('dblclick', this.handleCanvasDblClick);
    document.documentElement.style.setProperty(PANEL_WIDTH_VAR, '0px');
  }

  /** Publish the panel's total width (panel + resize handle) as a CSS custom property on :root.
   *  Only touches the DOM when the value actually changes. */
  private syncCssVar() {
    const { element, disabled, readonly } = this.props;
    const isVisible = !!element && !disabled && !readonly;
    const totalWidth = isVisible ? this.state.panelWidth + 6 : 0;

    if (isVisible !== this.prevIsVisible || totalWidth !== this.prevTotalWidth) {
      this.prevIsVisible = isVisible;
      this.prevTotalWidth = totalWidth;
      document.documentElement.style.setProperty(PANEL_WIDTH_VAR, `${totalWidth}px`);
    }
  }

  render() {
    const { element, disabled, mode, readonly, translate } = this.props;
    const { panelWidth } = this.state;

    if (disabled || readonly) {
      return null;
    }

    if (!element) {
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

    const typeLabel = this.getTypeLabel(element.type);

    return (
      <PanelWrapper ref={this.wrapperRef}>
        <ResizeHandle onMouseDown={this.handleResizeMouseDown} />
        <PanelContainer style={{ width: panelWidth }}>
          <PanelHeader>
            <PanelHeaderTitle title={typeLabel}>{typeLabel}</PanelHeaderTitle>
            <CloseButton onClick={this.handleClose} title={translate('propertiesPanel.close')}>&times;</CloseButton>
          </PanelHeader>
          <PanelBody>
            <CustomPopupComponent element={element} />
          </PanelBody>
        </PanelContainer>
      </PanelWrapper>
    );
  }

  /**
   * Localized element-type heading (e.g. "Class" → "Classe" in French).
   *
   * Element-type names live under ``packages.<DiagramType>.<ElementType>`` in
   * the editor dictionaries. We first try the group matching the element's
   * diagram type, then fall back to scanning every group — this bridges cases
   * where the diagram-type value and the i18n group name diverge (e.g.
   * ``StateMachineDiagram`` vs the ``StateDiagram`` group). Element-type keys
   * shared across groups (``Interface``, ``Component``, …) translate to the
   * same word, so a scan match is safe. When nothing matches (or a locale is
   * missing the key), fall back to inserting spaces before capitals so the
   * header never renders blank.
   */
  private getTypeLabel(type: string): string {
    const { diagramType, translate } = this.props;

    if (diagramType) {
      const direct = translate(`packages.${diagramType}.${type}`);
      if (direct) {
        return direct;
      }
    }

    for (const group of PACKAGE_GROUPS) {
      if (group === diagramType) continue; // already tried above
      const translated = translate(`packages.${group}.${type}`);
      if (translated) {
        return translated;
      }
    }

    return this.formatTypeName(type);
  }

  private formatTypeName(type: string): string {
    return type.replace(/([A-Z])/g, ' $1').trim();
  }

  private handleCanvasDblClick = (event: MouseEvent): void => {
    if (!this.props.element) return;
    if (this.wrapperRef.current && event.target instanceof Node && this.wrapperRef.current.contains(event.target)) {
      return;
    }
    const target = event.target as Element;
    if (target.tagName === 'svg' || target.classList.contains('apollon-editor')) {
      this.props.updateEnd(this.props.element.id);
    }
  };

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && this.props.element) {
      this.props.updateEnd(this.props.element.id);
    }
  };

  private handleClose = (): void => {
    if (this.props.element) {
      this.props.updateEnd(this.props.element.id);
    }
  };

  private handleResizeMouseDown = (e: React.MouseEvent<HTMLDivElement>): void => {
    e.preventDefault();
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const startX = e.clientX;
    const startWidth = this.state.panelWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.min(Math.max(startWidth - (moveEvent.clientX - startX), MIN_WIDTH), MAX_WIDTH);
      this.setState({ panelWidth: newWidth });
    };

    const onMouseUp = () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };
}

export const PropertiesPanel = enhance(PropertiesPanelComponent);
