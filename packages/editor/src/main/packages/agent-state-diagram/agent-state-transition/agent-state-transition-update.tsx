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
import { diagramBridge } from '../../../services/diagram-bridge';
import { ColorButton } from '../../../components/controls/color-button/color-button';
import { StylePane } from '../../../components/style-pane/style-pane';
import { Dropdown } from '../../../components/controls/dropdown/dropdown';
import { Controlled as CodeMirror } from 'react-codemirror2';
import 'codemirror/lib/codemirror.css';
import 'codemirror/theme/material.css';
import 'codemirror/mode/python/python';

// ─── Styled components ────────────────────────────────────────────────────────

const Flex = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
`;

const Section = styled.section`
  padding: 8px 0;
`;

const SectionHeader = styled(Header)`
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  opacity: 0.6;
  margin-bottom: 4px;
`;

/* Predefined / Custom toggle — same style as state body type toggle */
const TypeToggleRow = styled.div`
  display: flex;
  gap: 4px;
  margin-bottom: 8px;
`;

const TypeToggleBtn = styled.button<{ active?: boolean }>`
  flex: 1;
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid ${(props) => props.theme.color.gray}88;
  background: ${(props) => (props.active ? props.theme.color.primary : 'transparent')};
  color: ${(props) => (props.active ? '#fff' : 'inherit')};
  cursor: pointer;
  font-size: 12px;
  &:hover:not(:disabled) {
    opacity: 0.85;
  }
`;

/* Option list buttons */
const OptionList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-bottom: 2px;
`;

const OptionBtn = styled.button<{ active?: boolean }>`
  width: 100%;
  padding: 6px 10px;
  border-radius: 4px;
  border: 1px solid ${(props) => (props.active ? props.theme.color.primary : props.theme.color.gray + '88')};
  background: ${(props) => (props.active ? props.theme.color.primary : props.theme.color.background)};
  color: ${(props) => (props.active ? '#fff' : props.theme.color.primary)};
  cursor: pointer;
  font-size: 12px;
  text-align: left;
  font-weight: ${(props) => (props.active ? 600 : 400)};
  transition: opacity 0.1s;
  &:hover {
    opacity: 0.85;
  }
`;

const OptionDesc = styled.p`
  font-size: 11px;
  opacity: 0.65;
  margin: 6px 0 4px 0;
  font-style: italic;
  line-height: 1.4;
`;

const OptionSeparator = styled.hr`
  border: none;
  border-top: 1px solid ${(props) => props.theme.color.gray}44;
  margin: 10px 0 8px;
`;

const ConditionRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 0 8px;

  & + & {
    border-top: 1px solid ${(props) => props.theme.color.gray}44;
    margin-top: 8px;
  }
`;

const ConditionActions = styled.div`
  display: flex;
  gap: 4px;
`;

const RemoveButton = styled(Button)`
  && {
    background-color: #dc3545;
    border-color: #dc3545;
    color: #fff;
  }
  &&:hover {
    background-color: #c82333;
    border-color: #bd2130;
  }
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

// ─── Static data ──────────────────────────────────────────────────────────────

// These arrays live at module scope, so they cannot call this.props.translate.
// Instead they hold i18n KEYS, resolved at render time. `value` is used in
// logic (persisted on the model / matched in code) and is NEVER translated.
// The custom-event labels are technical identifiers (DummyEvent, GUIEvent, …)
// used as the display label AND stored value, so they intentionally stay in
// English; only the descriptions are translated.
const PREDEFINED_TRANSITIONS = [
  {
    value: 'auto',
    labelKey: 'packages.AgentDiagram.transitionLabel.auto',
    descriptionKey: 'packages.AgentDiagram.transitionDesc.auto',
  },
  {
    value: 'when_intent_matched',
    labelKey: 'packages.AgentDiagram.transitionLabel.intentMatched',
    descriptionKey: 'packages.AgentDiagram.transitionDesc.intentMatched',
  },
  {
    value: 'when_no_intent_matched',
    labelKey: 'packages.AgentDiagram.transitionLabel.noIntentMatched',
    descriptionKey: 'packages.AgentDiagram.transitionDesc.noIntentMatched',
  },
  {
    value: 'when_variable_operation_matched',
    labelKey: 'packages.AgentDiagram.transitionLabel.variableOperationMatched',
    descriptionKey: 'packages.AgentDiagram.transitionDesc.variableOperationMatched',
  },
  {
    value: 'when_file_received',
    labelKey: 'packages.AgentDiagram.transitionLabel.fileReceived',
    descriptionKey: 'packages.AgentDiagram.transitionDesc.fileReceived',
  },
  {
    value: 'when_form_submitted',
    labelKey: 'packages.AgentDiagram.transitionLabel.formSubmitted',
    descriptionKey: 'packages.AgentDiagram.transitionDesc.formSubmitted',
  },
] as const;

const CUSTOM_EVENTS = [
  {
    value: 'None',
    label: 'None',
    descriptionKey: 'packages.AgentDiagram.customEventDesc.none',
  },
  {
    value: 'DummyEvent',
    label: 'DummyEvent',
    descriptionKey: 'packages.AgentDiagram.customEventDesc.dummyEvent',
  },
  {
    value: 'WildcardEvent',
    label: 'WildcardEvent',
    descriptionKey: 'packages.AgentDiagram.customEventDesc.wildcardEvent',
  },
  {
    value: 'ReceiveMessageEvent',
    label: 'ReceiveMessageEvent',
    descriptionKey: 'packages.AgentDiagram.customEventDesc.receiveMessageEvent',
  },
  {
    value: 'ReceiveTextEvent',
    label: 'ReceiveTextEvent',
    descriptionKey: 'packages.AgentDiagram.customEventDesc.receiveTextEvent',
  },
  {
    value: 'ReceiveJSONEvent',
    label: 'ReceiveJSONEvent',
    descriptionKey: 'packages.AgentDiagram.customEventDesc.receiveJsonEvent',
  },
  {
    value: 'ReceiveFileEvent',
    label: 'ReceiveFileEvent',
    descriptionKey: 'packages.AgentDiagram.customEventDesc.receiveFileEvent',
  },
  {
    value: 'GUIEvent',
    label: 'GUIEvent',
    descriptionKey: 'packages.AgentDiagram.customEventDesc.guiEvent',
  },
] as const;

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

// ─── Component types ──────────────────────────────────────────────────────────

type State = {
  colorOpen: boolean;
};

type OwnProps = {
  element: AgentStateTransition;
};

type StateProps = {};

type DispatchProps = {
  update: typeof UMLElementRepository.update;
  delete: typeof UMLElementRepository.delete;
  flip: typeof UMLRelationshipRepository.flip;
};

type Props = OwnProps & StateProps & DispatchProps & I18nContext;

// ─── Component ────────────────────────────────────────────────────────────────

class AgentStateTransitionUpdateClass extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      colorOpen: false,
    };
  }

  private toggleColor = () => {
    this.setState((state) => ({ colorOpen: !state.colorOpen }));
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
      predefinedType: element.predefinedType || 'auto',
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
    const nextConditions = [...this.ensureCustomConditions(element.conditions)].filter((_, i) => i !== index);
    this.props.update<AgentStateTransition>(element.id, {
      transitionType: 'custom',
      conditions: nextConditions,
    });
  };

  render() {
    const { element } = this.props;
    const isCustomTransition = this.isCustomTransition(element);
    const customConditions = this.ensureCustomConditions(element.conditions);

    const intentNames: string[] = diagramBridge.getAgentIntents().map((i) => i.name).filter(Boolean);

    const activePredefined = element.predefinedType || 'auto';
    const activePredefinedInfo = PREDEFINED_TRANSITIONS.find((t) => t.value === activePredefined);

    const activeEvent = element.event || 'WildcardEvent';
    const activeEventInfo = CUSTOM_EVENTS.find((e) => e.value === activeEvent);

    const hasParams = !isCustomTransition && ['when_intent_matched', 'when_variable_operation_matched', 'when_file_received', 'when_form_submitted'].includes(activePredefined);
    const hasEventParams = isCustomTransition && activeEvent === 'GUIEvent';

    return (
      <div>
        {/* ── Header ─────────────────────────────────────────── */}
        <Section>
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
        </Section>

        {/* ── Predefined / Custom toggle ──────────────────────── */}
        <Section>
          <SectionHeader>{this.props.translate('popup.agent.transition.type')}</SectionHeader>
          <TypeToggleRow>
            <TypeToggleBtn
              active={!isCustomTransition}
              onClick={() => this.handleTransitionTypeChange('predefined')}
            >
              {this.props.translate('popup.agent.transition.predefined')}
            </TypeToggleBtn>
            <TypeToggleBtn
              active={isCustomTransition}
              onClick={() => this.handleTransitionTypeChange('custom')}
            >
              {this.props.translate('popup.agent.transition.custom')}
            </TypeToggleBtn>
          </TypeToggleRow>

          {/* ── Predefined transitions ──────────────────────── */}
          {!isCustomTransition && (
            <>
              <SectionHeader style={{ marginTop: 10 }}>{this.props.translate('popup.agent.transition.condition')}</SectionHeader>
              <OptionList>
                {PREDEFINED_TRANSITIONS.map((t) => (
                  <OptionBtn
                    key={t.value}
                    active={activePredefined === t.value}
                    onClick={() =>
                      this.props.update<AgentStateTransition>(element.id, {
                        transitionType: 'predefined',
                        predefinedType: t.value,
                      })
                    }
                  >
                    {this.props.translate(t.labelKey)}
                  </OptionBtn>
                ))}
              </OptionList>

              {activePredefinedInfo && (
                <OptionDesc>{this.props.translate(activePredefinedInfo.descriptionKey)}</OptionDesc>
              )}

              {/* Parameters for predefined types that have them */}
              {hasParams && (
                <>
                  <OptionSeparator />

                  {activePredefined === 'when_intent_matched' && (
                    <Dropdown
                      value={element.intentName || '__placeholder__'}
                      onChange={(value) =>
                        this.props.update<AgentStateTransition>(element.id, {
                          intentName: value === '__placeholder__' ? '' : value,
                        })
                      }
                    >
                      {[
                        <Dropdown.Item value="__placeholder__" key="intent-placeholder">{this.props.translate('popup.agent.transition.selectIntent')}</Dropdown.Item>,
                        ...intentNames.map((name, idx) => (
                          <Dropdown.Item key={idx} value={name}>{name}</Dropdown.Item>
                        )),
                      ]}
                    </Dropdown>
                  )}

                  {activePredefined === 'when_variable_operation_matched' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <Textfield
                        value={element.variable || ''}
                        onChange={(value) =>
                          this.props.update<AgentStateTransition>(element.id, { variable: value })
                        }
                        placeholder={this.props.translate('popup.agent.transition.variablePlaceholder')}
                      />
                      <Dropdown
                        value={element.operator || '__placeholder__'}
                        onChange={(value) =>
                          this.props.update<AgentStateTransition>(element.id, {
                            operator: value === '__placeholder__' ? '' : value,
                          })
                        }
                      >
                        <Dropdown.Item value="__placeholder__">{this.props.translate('popup.agent.transition.selectOperator')}</Dropdown.Item>
                        <Dropdown.Item value="<">&lt;</Dropdown.Item>
                        <Dropdown.Item value="<=">&le;</Dropdown.Item>
                        <Dropdown.Item value="==">==</Dropdown.Item>
                        <Dropdown.Item value=">=">&ge;</Dropdown.Item>
                        <Dropdown.Item value=">">&gt;</Dropdown.Item>
                        <Dropdown.Item value="!=">!=</Dropdown.Item>
                      </Dropdown>
                      <Textfield
                        value={element.targetValue || ''}
                        onChange={(value) =>
                          this.props.update<AgentStateTransition>(element.id, { targetValue: value })
                        }
                        placeholder={this.props.translate('popup.agent.transition.targetValuePlaceholder')}
                      />
                    </div>
                  )}

                  {activePredefined === 'when_file_received' && (
                    <Textfield
                      value={element.fileType || ''}
                      onChange={(value) =>
                        this.props.update<AgentStateTransition>(element.id, { fileType: value })
                      }
                      placeholder={this.props.translate('popup.agent.transition.fileTypesPlaceholder')}
                    />
                  )}

                  {activePredefined === 'when_form_submitted' && (() => {
                    const formGuis = diagramBridge.getAgentGUIs().filter((g) => g.is_form);
                    return formGuis.length === 0 ? (
                      <p style={{ fontSize: 12, margin: '4px 0', opacity: 0.7 }}>
                        {this.props.translate('popup.agent.transition.noFormGuis')}
                      </p>
                    ) : (
                      <Dropdown
                        value={element.formGuiId || '__any__'}
                        onChange={(value) =>
                          this.props.update<AgentStateTransition>(element.id, {
                            formGuiId: value === '__any__' ? '' : value,
                          } as any)
                        }
                      >
                        <Dropdown.Item value="__any__">{this.props.translate('popup.agent.transition.anyFormSubmission')}</Dropdown.Item>
                        {formGuis.map((g, i) => (
                          <Dropdown.Item key={`fg-${i}`} value={g.gui_id}>{g.gui_id}</Dropdown.Item>
                        ))}
                      </Dropdown>
                    );
                  })()}
                </>
              )}
            </>
          )}

          {/* ── Custom transitions ──────────────────────────── */}
          {isCustomTransition && (
            <>
              <SectionHeader style={{ marginTop: 10 }}>{this.props.translate('popup.agent.transition.event')}</SectionHeader>
              <OptionList>
                {CUSTOM_EVENTS.map((e) => (
                  <OptionBtn
                    key={e.value}
                    active={activeEvent === e.value}
                    onClick={() =>
                      this.props.update<AgentStateTransition>(element.id, {
                        transitionType: 'custom',
                        event: e.value as CustomTransitionEvent,
                      })
                    }
                  >
                    {e.label}
                  </OptionBtn>
                ))}
              </OptionList>

              {activeEventInfo && (
                <OptionDesc>{this.props.translate(activeEventInfo.descriptionKey)}</OptionDesc>
              )}

              {/* GUIEvent GUI selector */}
              {hasEventParams && (() => {
                const allGuis = diagramBridge.getAgentGUIs();
                return (
                  <>
                    <OptionSeparator />
                    <SectionHeader>{this.props.translate('popup.agent.transition.guiMessageId')}</SectionHeader>
                    {allGuis.length === 0 ? (
                      <p style={{ fontSize: 12, margin: '4px 0', opacity: 0.7 }}>
                        {this.props.translate('popup.agent.transition.noGuis')}
                      </p>
                    ) : (
                      <Dropdown
                        value={element.guiEventGuiId || '__any__'}
                        onChange={(value) =>
                          this.props.update<AgentStateTransition>(element.id, {
                            guiEventGuiId: value === '__any__' ? '' : value,
                          } as any)
                        }
                      >
                        <Dropdown.Item value="__any__">{this.props.translate('popup.agent.transition.anyGuiInteraction')}</Dropdown.Item>
                        {allGuis.map((g, i) => (
                          <Dropdown.Item key={`guie-${i}`} value={g.gui_id}>{g.gui_id}</Dropdown.Item>
                        ))}
                      </Dropdown>
                    )}
                  </>
                );
              })()}

              {/* Conditions */}
              <OptionSeparator style={{ marginTop: hasEventParams ? 16 : 10 }} />
              <SectionHeader>{this.props.translate('popup.agent.transition.conditions')}</SectionHeader>
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
                      onBeforeChange={(_editor, _data, value) => {
                        this.updateCustomCondition(index, value);
                      }}
                    />
                  </ResizableCodeMirrorWrapper>
                  <ConditionActions>
                    <RemoveButton onClick={() => this.removeCustomCondition(index)}>
                      {this.props.translate('common.remove')}
                    </RemoveButton>
                  </ConditionActions>
                </ConditionRow>
              ))}
              <div style={{ marginTop: '8px' }}>
                <Button color="primary" onClick={this.addCustomCondition}>{this.props.translate('popup.agent.transition.addCondition')}</Button>
              </div>
            </>
          )}
        </Section>

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
    () => ({}),
    {
      update: UMLElementRepository.update,
      delete: UMLElementRepository.delete,
      flip: UMLRelationshipRepository.flip,
    }
  ),
);

export const AgentStateTransitionUpdate = enhance(AgentStateTransitionUpdateClass);
