import React, { Component, ComponentClass, createRef } from 'react';
import { connect } from 'react-redux';
import { compose } from 'redux';
import styled from 'styled-components';
import { Button } from '../../../components/controls/button/button';
import { ColorButton } from '../../../components/controls/color-button/color-button';
import { Divider } from '../../../components/controls/divider/divider';
import { TrashIcon } from '../../../components/controls/icon/trash';
import { Textfield } from '../../../components/controls/textfield/textfield';
import { Header } from '../../../components/controls/typography/typography';
import { I18nContext } from '../../../components/i18n/i18n-context';
import { localized } from '../../../components/i18n/localized';
import { ModelState } from '../../../components/store/model-state';
import { StylePane } from '../../../components/style-pane/style-pane';
import { UMLElement } from '../../../services/uml-element/uml-element';
import { UMLElementRepository } from '../../../services/uml-element/uml-element-repository';
import { AsyncDispatch } from '../../../utils/actions/actions';
import { notEmpty } from '../../../utils/not-empty';
import { AgentIntentBody } from '../agent-intent-body/agent-intent-body';
import { AgentIntent } from './agent-intent';
import AgentIntentUpdate from '../agent-intent-body/agent-intent-body-update';

const Flex = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
`;

interface OwnProps {
  element: AgentIntent;
}

type StateProps = {};

interface DispatchProps {
  create: typeof UMLElementRepository.create;
  update: typeof UMLElementRepository.update;
  delete: typeof UMLElementRepository.delete;
  getById: (id: string) => UMLElement | null;
}

type Props = OwnProps & StateProps & DispatchProps & I18nContext;

interface State {
  colorOpen: boolean;
  fieldToFocus?: Textfield<string> | null;
}

const getInitialState = (): State => ({
  colorOpen: false,
});

const enhance = compose<ComponentClass<OwnProps>>(
  localized,
  connect<StateProps, DispatchProps, OwnProps, ModelState>(null, {
    create: UMLElementRepository.create,
    update: UMLElementRepository.update,
    delete: UMLElementRepository.delete,
    getById: UMLElementRepository.getById as any as AsyncDispatch<typeof UMLElementRepository.getById>,
  }),
);

class StateUpdate extends Component<Props, State> {
  state = getInitialState();
  newFallbackBodyField = createRef<Textfield<string>>();
  newBodyField = createRef<Textfield<string>>();

  private toggleColor = () => {
    this.setState((state) => ({
      colorOpen: !state.colorOpen,
    }));
  };

  componentDidUpdate(prevProps: Readonly<Props>, prevState: Readonly<{}>, snapshot?: any) {
    if (this.state.fieldToFocus) {
      this.state.fieldToFocus.focus();
      this.setState({ fieldToFocus: undefined });
    }
  }

  render() {
    const { element, getById } = this.props;
    const children = element.ownedElements.map((id) => getById(id)).filter(notEmpty);
    const bodies = children.filter((child) => child instanceof AgentIntentBody);
    const bodyRefs: (Textfield<string> | null)[] = [];


    return (
      <div>
        <section>
          Intent Name
          <Flex>
            <Textfield value={element.name} onChange={this.rename(element.id)} autoFocus />
            <ColorButton onClick={this.toggleColor} />
            <Button color="link" tabIndex={-1} onClick={this.delete(element.id)}>
              <TrashIcon />
            </Button>
          </Flex>
          <StylePane
            open={this.state.colorOpen}
            element={element}
            onColorChange={this.props.update}
            fillColor
            lineColor
            textColor
          />
          <Divider />
        </section>
        <section>
          Training Sentences
          <Header>{this.props.translate('popup.bodies')}</Header>
          {bodies.map((body, index) => (
            <AgentIntentUpdate
              id={body.id}
              key={body.id}
              value={body.name}
              onChange={this.props.update}
              onSubmitKeyUp={() =>
                index === bodies.length - 1
                  ? this.newBodyField.current?.focus()
                  : this.setState({
                      fieldToFocus: bodyRefs[index + 1],
                    })
              }
              onDelete={this.delete}
              onRefChange={(ref) => (bodyRefs[index] = ref)}
              element={body}
            />
          ))}
          <Textfield
            ref={this.newBodyField}
            outline
            value=""
            onSubmit={this.create(AgentIntentBody)}
            onSubmitKeyUp={(key: string, value: string) => {
              if (value) {
                this.setState({
                  fieldToFocus: this.newBodyField.current,
                });
              } else {

              }
            }}
            onKeyDown={(event) => {
              if (event.key === 'Tab' && event.currentTarget.value) {
                event.preventDefault();
                event.currentTarget.blur();
                this.setState({
                  fieldToFocus: this.newBodyField.current,
                });
              }
            }}
          />
        </section>
        
      </div>
    );
  }

  private create = (Clazz: typeof AgentIntentBody) => (value: string) => {
    const { element, create } = this.props;
    const member = new Clazz();
    member.name = value;
    create(member, element.id);
  };

  private rename = (id: string) => (value: string) => {
    this.props.update(id, { name: value });
  };

  private delete = (id: string) => () => {
    this.props.delete(id);
  };
}

export const AgentIntentBodyUpdate = enhance(StateUpdate);