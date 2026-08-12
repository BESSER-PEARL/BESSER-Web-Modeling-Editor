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

const PREDEFINED_TRANSITIONS = [
  {
    value: 'auto',
    label: 'Auto',
    description: 'Fires automatically when the state body finishes executing, without waiting for any user input.',
  },
  {
    value: 'when_intent_matched',
    label: 'Intent Matched',
    description: "Fires when the user's message is classified as matching a specific intent.",
  },
  {
    value: 'when_no_intent_matched',
    label: 'No Intent Matched',
    description: "Fires when none of the defined intents match the user's message.",
  },
  {
    value: 'when_variable_operation_matched',
    label: 'Variable Operation Matched',
    description: 'Fires when a session variable satisfies a comparison condition (e.g. score > 10).',
  },
  {
    value: 'when_file_received',
    label: 'File Received',
    description: 'Fires when the user sends a file upload. Optionally restrict to specific file types.',
  },
  {
    value: 'when_form_submitted',
    label: 'Form Submitted',
    description: 'Fires when the user submits a GUI form. Optionally target a specific form.',
  },
] as const;

const CUSTOM_EVENTS = [
  {
    value: 'None',
    label: 'None',
    description: 'No event required. The transition fires without waiting for any event.',
  },
  {
    value: 'DummyEvent',
    label: 'DummyEvent',
    description: 'A placeholder event used for testing. Does not correspond to any real user action.',
  },
  {
    value: 'WildcardEvent',
    label: 'WildcardEvent',
    description: 'Matches any incoming event. Useful as a catch-all transition.',
  },
  {
    value: 'ReceiveMessageEvent',
    label: 'ReceiveMessageEvent',
    description: 'Fires when any message is received from the user, regardless of type.',
  },
  {
    value: 'ReceiveTextEvent',
    label: 'ReceiveTextEvent',
    description: 'Fires when a plain text message is received from the user.',
  },
  {
    value: 'ReceiveJSONEvent',
    label: 'ReceiveJSONEvent',
    description: 'Fires when a JSON-structured message is received from the user.',
  },
  {
    value: 'ReceiveFileEvent',
    label: 'ReceiveFileEvent',
    description: 'Fires when the user sends a file.',
  },
  {
    value: 'GUIEvent',
    label: 'GUIEvent',
    description: 'Fires when the user interacts with a GUI component (e.g. clicks a button or submits a form).',
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
          <SectionHeader>Transition Type</SectionHeader>
          <TypeToggleRow>
            <TypeToggleBtn
              active={!isCustomTransition}
              onClick={() => this.handleTransitionTypeChange('predefined')}
            >
              Predefined
            </TypeToggleBtn>
            <TypeToggleBtn
              active={isCustomTransition}
              onClick={() => this.handleTransitionTypeChange('custom')}
            >
              Custom
            </TypeToggleBtn>
          </TypeToggleRow>

          {/* ── Predefined transitions ──────────────────────── */}
          {!isCustomTransition && (
            <>
              <SectionHeader style={{ marginTop: 10 }}>Condition</SectionHeader>
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
                    {t.label}
                  </OptionBtn>
                ))}
              </OptionList>

              {activePredefinedInfo && (
                <OptionDesc>{activePredefinedInfo.description}</OptionDesc>
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
                        <Dropdown.Item value="__placeholder__" key="intent-placeholder">Select intent</Dropdown.Item>,
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
                        placeholder="Variable"
                      />
                      <Dropdown
                        value={element.operator || '__placeholder__'}
                        onChange={(value) =>
                          this.props.update<AgentStateTransition>(element.id, {
                            operator: value === '__placeholder__' ? '' : value,
                          })
                        }
                      >
                        <Dropdown.Item value="__placeholder__">Select operator</Dropdown.Item>
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
                        placeholder="Target value"
                      />
                    </div>
                  )}

                  {activePredefined === 'when_file_received' && (
                    <Textfield
                      value={element.fileType || ''}
                      onChange={(value) =>
                        this.props.update<AgentStateTransition>(element.id, { fileType: value })
                      }
                      placeholder="File types, e.g. pdf, txt, json"
                    />
                  )}

                  {activePredefined === 'when_form_submitted' && (() => {
                    const formGuis = diagramBridge.getAgentGUIs().filter((g) => g.is_form);
                    return formGuis.length === 0 ? (
                      <p style={{ fontSize: 12, margin: '4px 0', opacity: 0.7 }}>
                        No form GUIs defined. Create one with "is_form = True" in the Components page.
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
                        <Dropdown.Item value="__any__">Any form submission</Dropdown.Item>
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
              <SectionHeader style={{ marginTop: 10 }}>Event</SectionHeader>
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
                <OptionDesc>{activeEventInfo.description}</OptionDesc>
              )}

              {/* GUIEvent GUI selector */}
              {hasEventParams && (() => {
                const allGuis = diagramBridge.getAgentGUIs();
                return (
                  <>
                    <OptionSeparator />
                    <SectionHeader>GUI (message_id)</SectionHeader>
                    {allGuis.length === 0 ? (
                      <p style={{ fontSize: 12, margin: '4px 0', opacity: 0.7 }}>
                        No GUIs defined. Create one in the Components page.
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
                        <Dropdown.Item value="__any__">Any GUI interaction</Dropdown.Item>
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
              <SectionHeader>Conditions</SectionHeader>
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
                      Remove
                    </RemoveButton>
                  </ConditionActions>
                </ConditionRow>
              ))}
              <div style={{ marginTop: '8px' }}>
                <Button color="primary" onClick={this.addCustomCondition}>Add condition</Button>
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
