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
import { AssociationsList } from '../associations-list/associations-list';
import { UMLElementRepository } from '../../services/uml-element/uml-element-repository';
import { IUMLElement } from '../../services/uml-element/uml-element';

type OwnProps = {};

type StateProps = {
  readonly: boolean;
  mode: ApollonMode;
  view: ApollonView;
  selected: SelectableState;
  elements: { [key: string]: IUMLElement };
};

type DispatchProps = {
  changeView: typeof EditorRepository.changeView;
  onSelect: typeof UMLElementRepository.select;
  onUpdate: typeof UMLElementRepository.update;
};

type Props = OwnProps & StateProps & DispatchProps & I18nContext;

const enhance = compose<ComponentClass<OwnProps>>(
  localized,
  connect<StateProps, DispatchProps, OwnProps, ModelState>(
    (state: ModelState): StateProps => ({
      readonly: state.editor.readonly,
      mode: state.editor.mode,
      view: state.editor.view,
      selected: state.selected,
      elements: state.elements,
    }),
    {
      changeView: EditorRepository.changeView,
      onSelect: UMLElementRepository.select,
      onUpdate: UMLElementRepository.update,
    },
  ),
);

class SidebarComponent extends Component<Props> {
  handleSelect = (id: string) => {
    this.props.onSelect(id);
  };

  handleDoubleClick = (id: string) => {
    // This will trigger the update view for the association
    this.props.onSelect(id);
  };

  render() {
    console.log('Sidebar render:', {
      readonly: this.props.readonly,
      mode: this.props.mode,
      view: this.props.view,
      elements: this.props.elements
    });

    if (this.props.readonly || this.props.mode === ApollonMode.Assessment) {
      return null;
    }

    return (
      <Container id="modeling-editor-sidebar" data-cy="modeling-editor-sidebar">
        {this.props.view === ApollonView.Modelling && (
          <>
            <CreatePane />
            <AssociationsList 
              elements={this.props.elements}
              onSelect={this.handleSelect}
              onDoubleClick={this.handleDoubleClick}
            />
          </>
        )}
      </Container>
    );
  }
}

export const Sidebar = enhance(SidebarComponent);
