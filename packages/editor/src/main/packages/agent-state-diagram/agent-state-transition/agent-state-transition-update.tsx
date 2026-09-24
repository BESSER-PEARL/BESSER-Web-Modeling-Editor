import React, { Component, ComponentClass } from 'react';
import { connect } from 'react-redux';
import { compose } from 'redux';
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
import { NEW_TRANSITION_PREDEFINED_TYPE } from './agent-state-transition';
import {
  CUSTOM_CONDITION_TEMPLATE,
  CUSTOM_EVENTS,
  PREDEFINED_TRANSITIONS,
} from './agent-state-transition-update-constants';
import {
  ConditionActions,
  ConditionRow,
  Flex,
  OptionBtn,
  OptionDesc,
  OptionList,
  OptionSeparator,
  RemoveButton,
  ResizableCodeMirrorWrapper,
  Section,
  SectionHeader,
  TypeToggleBtn,
  TypeToggleRow,
} from './agent-state-transition-update-styles';

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
      predefinedType: element.predefinedType || NEW_TRANSITION_PREDEFINED_TYPE,
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

    const activePredefined = element.predefinedType || NEW_TRANSITION_PREDEFINED_TYPE;
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
                          })
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
                          })
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
