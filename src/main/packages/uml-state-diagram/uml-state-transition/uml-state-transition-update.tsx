import React, { Component, ComponentClass } from 'react';
import { connect } from 'react-redux';
import { compose } from 'redux';
import styled from 'styled-components';
import { Button } from '../../../components/controls/button/button';
import { Divider } from '../../../components/controls/divider/divider';
import { ExchangeIcon } from '../../../components/controls/icon/exchange';
import { TrashIcon } from '../../../components/controls/icon/trash';
import { Textfield } from '../../../components/controls/textfield/textfield';
import { Header } from '../../../components/controls/typography/typography';
import { I18nContext } from '../../../components/i18n/i18n-context';
import { localized } from '../../../components/i18n/localized';
import { ModelState } from '../../../components/store/model-state';
import { UMLElementRepository } from '../../../services/uml-element/uml-element-repository';
import { UMLRelationshipRepository } from '../../../services/uml-relationship/uml-relationship-repository';
import { UMLStateTransition, IUMLStateTransition } from './uml-state-transition';
import { ColorButton } from '../../../components/controls/color-button/color-button';
import { StylePane } from '../../../components/style-pane/style-pane';

const Flex = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
`;

type State = { colorOpen: boolean };

type OwnProps = {
  element: UMLStateTransition;
};

type StateProps = {};

type DispatchProps = {
  update: typeof UMLElementRepository.update;
  delete: typeof UMLElementRepository.delete;
  flip: typeof UMLRelationshipRepository.flip;
};

type Props = OwnProps & StateProps & DispatchProps & I18nContext;

class StateTransitionUpdate extends Component<Props, State> {
  state = { colorOpen: false };

  private toggleColor = () => {
    this.setState((state) => ({
      colorOpen: !state.colorOpen,
    }));
  };

  render() {
    const { element } = this.props;

    return (
      <div>
        <section>
          <Flex>
            <Header gutter={false} style={{ flexGrow: 1 }}>
              {this.props.translate('packages.StateDiagram.StateTransition')}
            </Header>
            <ColorButton onClick={this.toggleColor} />
            <Button color="link" onClick={() => this.props.flip(element.id)}>
              <ExchangeIcon />
            </Button>
            <Button color="link" onClick={() => this.props.delete(element.id)}>
              <TrashIcon />
            </Button>
          </Flex>
          <Divider />
        </section>
        <section>
          <Header>Name</Header>
          <Textfield value={element.name} onChange={this.rename} autoFocus />
        </section>
        <section>
          <Header>Params</Header>
          <Textfield value={element.params} onChange={this.updateParams} />
        </section>
        <StylePane
          open={this.state.colorOpen}
          element={element}
          onColorChange={this.props.update}
          lineColor
          textColor
        />
      </div>
    );
  }

  private rename = (name: string) => {
    this.props.update<UMLStateTransition>(this.props.element.id, { name });
  };

  private updateParams = (params: string) => {
    this.props.update<UMLStateTransition>(this.props.element.id, { params });
  };
}

const enhance = compose<ComponentClass<OwnProps>>(
  localized,
  connect<StateProps, DispatchProps, OwnProps, ModelState>(null, {
    update: UMLElementRepository.update,
    delete: UMLElementRepository.delete,
    flip: UMLRelationshipRepository.flip,
  }),
);

export const UMLStateTransitionUpdate = enhance(StateTransitionUpdate); 