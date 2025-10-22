import React, { Component, ComponentClass } from 'react';
import { connect } from 'react-redux';
import { compose } from 'redux';
import { EditorRepository } from '../../services/editor/editor-repository';
import { ApollonMode, ApollonView } from '../../services/editor/editor-types';
import { CreatePane } from '../create-pane/create-pane';
import { I18nContext } from '../i18n/i18n-context';
import { localized } from '../i18n/localized';
import { ModelState } from '../store/model-state';
import { Container } from './sidebar-styles';
import { SelectableState } from '../../services/uml-element/selectable/selectable-types';
import { settingsService } from '../../services/settings/settings-service';
import { LayouterRepository } from '../../services/layouter/layouter-repository';

declare global {
  interface Window {
    apollon?: any;
  }
}

type OwnProps = {};

type StateProps = {
  readonly: boolean;
  mode: ApollonMode;
  view: ApollonView;
  selected: SelectableState;
  diagramType: string;
};

type DispatchProps = {
  changeView: typeof EditorRepository.changeView;
  layout: typeof LayouterRepository.layout;
};

type Props = OwnProps & StateProps & DispatchProps & I18nContext;

const enhance = compose<ComponentClass<OwnProps>>(
  localized,
  connect<StateProps, DispatchProps, OwnProps, ModelState>(
    (state) => {
      return {
        readonly: state.editor.readonly,
        mode: state.editor.mode,
        view: state.editor.view,
        selected: state.selected,
        diagramType: state.diagram.type,
      };
    },
    {
      changeView: EditorRepository.changeView,
      layout: LayouterRepository.layout,
    },
  ),
);

interface SidebarComponentState {
  sidebarWidth: number;
  showIcon: boolean;
}

class SidebarComponent extends Component<Props, SidebarComponentState> {
  constructor(props: Props) {
    super(props);
    this.state = {
      sidebarWidth: 250,
      showIcon: settingsService.shouldShowIconView(),
    };
  }

  render() {
    const { readonly, mode, view, diagramType, translate, changeView } = this.props;
    const { sidebarWidth, showIcon } = this.state;
    const isObjectDiagram = diagramType.includes("Object")

    if (readonly || mode === ApollonMode.Assessment) return null;

    // Sidebar content
    const sidebarContent = (
      <div
        id="modeling-editor-sidebar"
        data-cy="modeling-editor-sidebar"
        ref={this.handleSidebarRef}
        style={{
          width: sidebarWidth,
          minWidth: 128,
          maxWidth: 1000,
          resize: 'none',
          overflow: 'auto',
          borderRight: '1px solid #ddd',
        }}
      >
        {mode === ApollonMode.Exporting && (
          <div className="dropdown" style={{ width: 128 }}>
            <select
              value={view}
              onChange={e => changeView(e.target.value as ApollonView)}
              color="primary"
            >
              <option value={ApollonView.Modelling}>{translate('views.modelling')}</option>
              <option value={ApollonView.Exporting}>{translate('views.exporting')}</option>
            </select>
          </div>
        )}
        {view === ApollonView.Modelling ? (
          <>

            {isObjectDiagram && (
              <label htmlFor="toggleIconMode" style={{ display: 'block', marginTop: 8 }}>
                <input
                  id="toggleIconMode"
                  type="checkbox"
                  checked={showIcon}
                  onChange={this.handleToggleIconMode}
                />
                Display Object Diagram in Icon Mode
              </label>
            )}
            {/* Force CreatePane to rerender when showIcon changes by using key */}
            <CreatePane key={showIcon ? 'icon' : 'default'} />
          </>
        ) : (
          <label htmlFor="toggleInteractiveElementsMode">
            <input
              id="toggleInteractiveElementsMode"
              type="checkbox"
              checked={view === ApollonView.Exporting}
              onChange={this.toggleInteractiveElementsMode}
            />
            {translate('views.highlight')}
          </label>
        )}
      </div>
    );

    // Resize handle
    const resizeHandle = (
      <div
        style={{
          width: 8,
          cursor: 'ew-resize',
          background: '#eee',
          userSelect: 'none',
        }}
        onMouseDown={this.handleResizeMouseDown}
      />
    );

    return (
      <div style={{ display: 'flex', flexDirection: 'row', height: '100%' }}>
        {sidebarContent}
        {resizeHandle}
      </div>
    );
  }

  handleSidebarRef = (el: HTMLDivElement | null) => {
    if (el && this.state.sidebarWidth === 250) {
      // Only set initial width once
      const rect = el.getBoundingClientRect();
      if (rect.width > 150) {
        el.style.width = 'auto';
        const autoWidth = el.getBoundingClientRect().width;
        el.style.width = '';
        this.setState({ sidebarWidth: autoWidth });
        el.style.maxWidth = `${Math.min(autoWidth)}px`;
      }
    }
  };

  handleResizeMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    document.body.style.cursor = 'col-resize';
    const startX = e.clientX;
    const startWidth = this.state.sidebarWidth;
    const onMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.min(
        Math.max(startWidth + moveEvent.clientX - startX, 128),
        1000,
      );
      this.setState({ sidebarWidth: newWidth });
    };
    const onMouseUp = () => {
      document.body.style.cursor = '';
      const sidebarElement = document.getElementById('modeling-editor-sidebar');
      if (sidebarElement) {
        const contentWidth = sidebarElement.scrollWidth;
        if (this.state.sidebarWidth >= contentWidth) {
          this.setState({ sidebarWidth: contentWidth });
        }
      }
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  toggleInteractiveElementsMode = (event: React.FormEvent<HTMLInputElement>) => {
    const { checked } = event.currentTarget;
    const view: ApollonView = checked ? ApollonView.Exporting : ApollonView.Highlight;
    this.props.changeView(view);
  };

  handleToggleIconMode = () => {
    const newValue = !this.state.showIcon;
    settingsService.updateSetting('showIconView', newValue);
    this.setState({ showIcon: newValue });
    
    // Force re-render of the entire diagram by triggering a layout refresh
    // This will cause all components to re-render and check their visibility conditions
    this.props.layout();
  };

}

export const Sidebar = enhance(SidebarComponent);
