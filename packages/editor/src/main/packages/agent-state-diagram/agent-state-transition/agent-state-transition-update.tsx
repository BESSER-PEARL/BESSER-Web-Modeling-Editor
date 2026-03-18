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
import { AgentStateTransition, CustomTransitionEvent } from './agent-state-transition';
import { ColorButton } from '../../../components/controls/color-button/color-button';
import { StylePane } from '../../../components/style-pane/style-pane';
import { Dropdown } from '../../../components/controls/dropdown/dropdown';
import { Controlled as CodeMirror } from 'react-codemirror2';
import 'codemirror/lib/codemirror.css';
import 'codemirror/theme/material.css';
import 'codemirror/mode/python/python';

const Flex = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
`;

const ConditionsHeader = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
`;

const ConditionRow = styled.div`
  margin-bottom: 12px;
`;

const ConditionActions = styled.div`
  display: flex;
  gap: 4px;
  margin-top: 4px;
`;

const ResizableCodeMirrorWrapper = styled.div`
  resize: both;
  overflow: auto;
  min-height: 220px;
  border: 1px solid ${(props) => props.theme.color.gray};
  border-radius: 4px;
  padding: 8px;
  box-sizing: border-box;

  .CodeMirror {
    height: 100% !important;
    width: 100%;
  }
`;

const CUSTOM_CONDITION_TEMPLATE = `def condition(session: 'Session', params: dict) -> bool:
    """Boolean function

    Args:
        session (Session): the current user session
        params (dict): the function parameters

    Returns:
        bool: True or False
    """
    if session.get('x') > 10:
        return True
    else:
        return False`;

type State = {
  colorOpen: boolean;
};

type OwnProps = {
  element: AgentStateTransition;
};

type StateProps = {
  elements: { [id: string]: any };
};

type DispatchProps = {
  update: typeof UMLElementRepository.update;
  delete: typeof UMLElementRepository.delete;
  flip: typeof UMLRelationshipRepository.flip;
};

type Props = OwnProps & StateProps & DispatchProps & I18nContext;

class AgentStateTransitionUpdateClass extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      colorOpen: false,
    };
  }

  private toggleColor = () => {
    this.setState((state) => ({
      colorOpen: !state.colorOpen,
    }));
  };

  private isCustomTransition = (element: AgentStateTransition) =>
    element.transitionType === 'custom';

  private ensureCustomConditions = (conditions?: string[]) =>
    conditions || [];

  private handleTransitionTypeChange = (value: string) => {
    const { element } = this.props;
    if (value === 'custom') {
      this.props.update<AgentStateTransition>(element.id, {
        transitionType: 'custom',
        event: element.event || 'WildcardEvent',
        conditions: element.conditions || [],
      });
      return;
    }

    this.props.update<AgentStateTransition>(element.id, {
      transitionType: 'predefined',
      predefinedType: element.predefinedType || 'when_intent_matched',
    });
  };

  private updateCustomCondition = (index: number, value: string) => {
    const { element } = this.props;
    const nextConditions = [...this.ensureCustomConditions(element.conditions)];
    nextConditions[index] = value;
    this.props.update<AgentStateTransition>(element.id, {
      transitionType: 'custom',
      conditions: nextConditions,
    });
  };

  private addCustomCondition = () => {
    const { element } = this.props;
    const nextConditions = [...this.ensureCustomConditions(element.conditions), CUSTOM_CONDITION_TEMPLATE];
    this.props.update<AgentStateTransition>(element.id, {
      transitionType: 'custom',
      conditions: nextConditions,
    });
  };

  private removeCustomCondition = (index: number) => {
    const { element } = this.props;
    const currentConditions = [...this.ensureCustomConditions(element.conditions)];
    const nextConditions = currentConditions.filter((_, conditionIndex) => conditionIndex !== index);

    this.props.update<AgentStateTransition>(element.id, {
      transitionType: 'custom',
      conditions: nextConditions,
    });
  };


  render() {
    const { element, elements } = this.props;
    const isCustomTransition = this.isCustomTransition(element);
    const customConditions = this.ensureCustomConditions(element.conditions);

    // Get intent names from current model state instead of localStorage
    const intentNames: string[] = Object.values(elements)
      .filter((el: any) => el.type === "AgentIntent" && typeof el.name === "string")
      .map((el: any) => el.name);

    return (
      <div>
        <section>
          <Flex>
            <Header gutter={false} style={{ flexGrow: 1 }}>
              {this.props.translate('packages.AgentDiagram.StateTransition')}
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
        </section>
        <section>
          <Header>Transition Type</Header>
          <Dropdown
            value={isCustomTransition ? 'custom' : 'predefined'}
            onChange={this.handleTransitionTypeChange}
          >
            <Dropdown.Item value="predefined">Predefined transition</Dropdown.Item>
            <Dropdown.Item value="custom">Custom transition</Dropdown.Item>
          </Dropdown>

          {!isCustomTransition && (
            <React.Fragment>
              <Header>Condition</Header>
              <Dropdown
                value={element.predefinedType || 'when_intent_matched'}
                onChange={value =>
                  this.props.update<AgentStateTransition>(element.id, {
                    transitionType: 'predefined',
                    predefinedType: value,
                  })
                }
              >
                <Dropdown.Item value="when_intent_matched">When Intent Matched</Dropdown.Item>
                <Dropdown.Item value="when_no_intent_matched">When No Intent Matched</Dropdown.Item>
                <Dropdown.Item value="when_variable_operation_matched">Variable Operation Matched</Dropdown.Item>
                <Dropdown.Item value="when_file_received">File Received</Dropdown.Item>
                <Dropdown.Item value="auto">Auto Transition</Dropdown.Item>
              </Dropdown>
              {element.predefinedType === "when_intent_matched" && (
                <Dropdown
                  value={element.intentName || '__placeholder__'}
                  onChange={value =>
                    this.props.update<AgentStateTransition>(element.id, { intentName: value === '__placeholder__' ? '' : value })
                  }
                >
                  {[
                    <Dropdown.Item value="__placeholder__" key="intent-placeholder">Select intent</Dropdown.Item>,
                    ...intentNames.map((name, idx) => (
                      <Dropdown.Item key={idx} value={name}>
                        {name}
                      </Dropdown.Item>
                    ))
                  ]}
                </Dropdown>
              )}
              {element.predefinedType === "when_variable_operation_matched" && (
                <React.Fragment>
                  <Textfield
                    value={element.variable || ""}
                    onChange={value =>
                      this.props.update<AgentStateTransition>(element.id, { variable: value })
                    }
                    placeholder="Variable"
                    style={{ marginBottom: "8px" }}
                  />
                  <Dropdown
                    value={element.operator || '=='}
                    onChange={value =>
                      this.props.update<AgentStateTransition>(element.id, { operator: value })
                    }
                  >
                    <Dropdown.Item value="<">&lt;</Dropdown.Item>
                    <Dropdown.Item value="<=">&le;</Dropdown.Item>
                    <Dropdown.Item value="==">==</Dropdown.Item>
                    <Dropdown.Item value=">=">&ge;</Dropdown.Item>
                    <Dropdown.Item value=">">&gt;</Dropdown.Item>
                    <Dropdown.Item value="!=">!=</Dropdown.Item>
                  </Dropdown>
                  <Textfield
                    value={element.targetValue || ""}
                    onChange={value =>
                      this.props.update<AgentStateTransition>(element.id, { targetValue: value })
                    }
                    placeholder="Target value"
                  />
                </React.Fragment>
              )}
              {element.predefinedType === "when_file_received" && (
                <Dropdown
                  value={element.fileType || '__placeholder__'}
                  onChange={value =>
                    this.props.update<AgentStateTransition>(element.id, { fileType: value === '__placeholder__' ? '' : value })
                  }
                >
                  {[
                    <Dropdown.Item value="__placeholder__" key="filetype-placeholder">Select file type</Dropdown.Item>,
                    <Dropdown.Item value="PDF" key="pdf">PDF</Dropdown.Item>,
                    <Dropdown.Item value="TXT" key="txt">TXT</Dropdown.Item>,
                    <Dropdown.Item value="JSON" key="json">JSON</Dropdown.Item>
                  ]}
                </Dropdown>
              )}
            </React.Fragment>
          )}

          {isCustomTransition && (
            <React.Fragment>
              <Header>Event</Header>
              <Dropdown
                value={element.event || 'WildcardEvent'}
                onChange={(value) =>
                  this.props.update<AgentStateTransition>(element.id, {
                    transitionType: 'custom',
                    event: value as CustomTransitionEvent,
                  })
                }
              >
                <Dropdown.Item value="None">None</Dropdown.Item>
                <Dropdown.Item value="DummyEvent">DummyEvent</Dropdown.Item>
                <Dropdown.Item value="WildcardEvent">WildcardEvent</Dropdown.Item>
                <Dropdown.Item value="ReceiveMessageEvent">ReceiveMessageEvent</Dropdown.Item>
                <Dropdown.Item value="ReceiveTextEvent">ReceiveTextEvent</Dropdown.Item>
                <Dropdown.Item value="ReceiveJSONEvent">ReceiveJSONEvent</Dropdown.Item>
                <Dropdown.Item value="ReceiveFileEvent">ReceiveFileEvent</Dropdown.Item>
              </Dropdown>

              <ConditionsHeader>
                <Header>Conditions</Header>
                <Button onClick={this.addCustomCondition}>Add condition</Button>
              </ConditionsHeader>
              {customConditions.map((conditionCode, index) => (
                <ConditionRow key={`custom-condition-${index}`}>
                  <ResizableCodeMirrorWrapper>
                    <CodeMirror
                      value={conditionCode}
                      options={{
                        mode: 'python',
                        theme: 'material',
                        lineNumbers: true,
                        tabSize: 4,
                        indentWithTabs: true,
                      }}
                      onBeforeChange={(editor, data, value) => {
                        this.updateCustomCondition(index, value);
                      }}
                    />
                  </ResizableCodeMirrorWrapper>
                  <ConditionActions>
                    <Button color="link" onClick={() => this.removeCustomCondition(index)}>
                      Remove
                    </Button>
                  </ConditionActions>
                </ConditionRow>
              ))}
            </React.Fragment>
          )}
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
}

const enhance = compose<ComponentClass<OwnProps>>(
  localized,
  connect<StateProps, DispatchProps, OwnProps, ModelState>(
    (state) => ({
      elements: state.elements,
    }),
    {
      update: UMLElementRepository.update,
      delete: UMLElementRepository.delete,
      flip: UMLRelationshipRepository.flip,
    }
  ),
);

export const AgentStateTransitionUpdate = enhance(AgentStateTransitionUpdateClass);
