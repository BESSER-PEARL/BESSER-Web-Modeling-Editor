import React, { Component, ComponentClass } from 'react';
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
import { AGENT_LLM_PROVIDERS, NON_CHAT_AGENT_LLM_PROVIDERS } from '../agent-llm/agent-llm';
import { localized } from '../../../components/i18n/localized';
import { ModelState } from '../../../components/store/model-state';
import { StylePane } from '../../../components/style-pane/style-pane';
import { UMLElement } from '../../../services/uml-element/uml-element';
import { UMLElementRepository } from '../../../services/uml-element/uml-element-repository';
import { AsyncDispatch } from '../../../utils/actions/actions';
import { notEmpty } from '../../../utils/not-empty';
import { AgentElementType } from '..';
import { AgentStateBody } from '../agent-state-body/agent-state-body';
import { AgentStateFallbackBody } from '../agent-state-fallback-body/agent-state-fallback-body';
import { AgentState } from './agent-state';
import { AgentStateMember } from '../agent-state/agent-state-member';

import { Controlled as CodeMirror } from 'react-codemirror2';
import 'codemirror/lib/codemirror.css';
import 'codemirror/theme/material.css';
import 'codemirror/mode/python/python';
import { Dropdown } from '../../../components/controls/dropdown/dropdown';
import { LayouterRepository } from '../../../services/layouter/layouter-repository';
import { diagramBridge } from '../../../services/diagram-bridge';

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

const SectionHeader = styled.span`
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  opacity: 0.6;
  margin-bottom: 4px;
  display: block;
`;

const RadioGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 4px 0;
`;

const DbFieldRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 4px 0;

  & + & {
    border-top: 1px solid ${(props: any) => props.theme.color.gray}22;
  }
`;

const ResizableCodeMirrorWrapper = styled.div`
  resize: both;
  overflow: auto;
  min-height: 150px;
  border: 1px solid ${(props) => props.theme.color.gray};
  border-radius: 4px;
  padding: 8px;
  box-sizing: border-box;

  .CodeMirror {
    height: 100% !important;
    width: 100%;
  }
`;

const LlmSelect = styled.select`
  width: 100%;
  height: 30px;
  padding: 0 6px;
  border: 1px solid ${(props) => props.theme.color.gray};
  border-radius: 4px;
  background: transparent;
  color: inherit;
`;

const LlmFieldRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 4px 0;
`;

/* Body-type toggle */
const BodyTypeRow = styled.div`
  display: flex;
  gap: 4px;
  margin-bottom: 8px;
`;

const BodyTypeBtn = styled.button<{ active?: boolean }>`
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

/* Action card */
const ActionCard = styled.div`
  border: 1px solid ${(props: any) => props.theme.color.gray}44;
  border-radius: 4px;
  margin-bottom: 6px;
  background: transparent;
  transition: border-color 0.15s;
  &[data-drag-over='true'] {
    border-color: ${(props: any) => props.theme.color.primary};
    background: ${(props: any) => props.theme.color.primary}11;
  }
  &[data-dragging='true'] {
    opacity: 0.4;
  }
`;

const ActionCardHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 6px;
  cursor: default;
`;

const DragHandle = styled.span`
  cursor: grab;
  opacity: 0.4;
  font-size: 14px;
  line-height: 1;
  flex-shrink: 0;
  user-select: none;
  &:hover {
    opacity: 0.9;
  }
  &:active {
    cursor: grabbing;
  }
`;

const ActionTypeBadge = styled.span`
  font-size: 10px;
  text-transform: uppercase;
  background: ${(props: any) => props.theme.color.gray}22;
  padding: 2px 5px;
  border-radius: 3px;
  letter-spacing: 0.4px;
  flex-shrink: 0;
`;

const ActionSummary = styled.span`
  flex: 1;
  font-size: 12px;
  opacity: 0.75;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const IconBtn = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 4px;
  opacity: 0.55;
  font-size: 13px;
  line-height: 1;
  flex-shrink: 0;
  &:hover {
    opacity: 1;
  }
`;

const ActionBody = styled.div`
  padding: 0 8px 8px 8px;
  border-top: 1px solid ${(props: any) => props.theme.color.gray}22;
`;

const AddActionRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
`;

const ToggleLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-size: 13px;
  padding: 2px 0;
`;

const CheckboxRow = styled.label`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 0;
`;

const WsWarning = styled.p`
  font-size: 12px;
  margin: 4px 0;
  color: #e04040;
  opacity: 0.85;
`;

const NewActionLabel = styled.div`
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  opacity: 0.55;
  margin-top: 8px;
  margin-bottom: 4px;
`;

const SectionTabRow = styled.div`
  display: flex;
  gap: 3px;
  margin-bottom: 6px;
`;

const SectionTab = styled.button<{ active?: boolean }>`
  flex: 1;
  padding: 3px 6px;
  border-radius: 3px;
  border: 1px solid ${(props: any) => props.theme.color.gray}66;
  background: ${(props: any) => (props.active ? props.theme.color.primary : 'transparent')};
  color: ${(props: any) => (props.active ? '#fff' : 'inherit')};
  cursor: pointer;
  font-size: 11px;
  white-space: nowrap;
  &:hover:not(:disabled) {
    opacity: 0.85;
  }
`;

const WS_REPLY_TYPES = new Set([
  'ws_markdown',
  'ws_html',
  'ws_speech',
  'ws_options',
  'ws_location',
  'ws_file',
  'ws_image',
  'ws_dataframe',
  'ws_plotly',
]);

type ActionSection = 'simple' | 'ai' | 'data';

const SECTION_ACTION_TYPES: Record<ActionSection, string[]> = {
  simple: [
    'text',
    'ws_markdown',
    'ws_html',
    'ws_speech',
    'ws_options',
    'ws_location',
    'ws_file',
    'ws_image',
    'ws_dataframe',
    'ws_plotly',
  ],
  ai: ['llm', 'llm_chat'],
  data: ['rag', 'db_reply', 'web_crawl_llm'],
};

const ALL_ACTION_TYPES = [...SECTION_ACTION_TYPES.simple, ...SECTION_ACTION_TYPES.ai, ...SECTION_ACTION_TYPES.data];

// ─── Types ────────────────────────────────────────────────────────────────────

interface OwnProps {
  element: AgentState;
}

type StateProps = {
  elements: ModelState['elements'];
};

interface DispatchProps {
  create: typeof UMLElementRepository.create;
  update: typeof UMLElementRepository.update;
  remove: typeof UMLElementRepository.delete;
  getById: (id: string) => UMLElement | null;
  layout: typeof LayouterRepository.layout;
}

type Props = OwnProps & StateProps & DispatchProps & I18nContext;

type DbReplyValues = {
  dbSelectionType: string;
  dbCustomName: string;
  dbQueryMode: string;
  dbOperation: string;
  dbSqlQuery: string;
};

interface State {
  colorOpen: boolean;
  newBodyActionType: string;
  newFallbackActionType: string;
  newBodyActionSection: ActionSection;
  newFallbackActionSection: ActionSection;
  // Actions are shown expanded (in edit mode) by default. We track which ones
  // the user has explicitly collapsed rather than which are expanded, so freshly
  // loaded agents and newly added actions reveal their editor without a click.
  collapsedBodyIds: Set<string>;
  collapsedFallbackIds: Set<string>;
  draggingIndex: number | null;
  draggingPrefix: string | null;
  dragOverIndex: number | null;
  dragOverPrefix: string | null;
  // Which card, if any, has drag armed. Dragging is only enabled once the
  // mouse is pressed on that card's drag handle — so clicking inside a text
  // field selects/positions the cursor normally instead of starting a drag.
  dragArmedKey: string | null;
}

const ACTION_TYPE_LABELS: Record<string, string> = {
  text: 'Text',
  llm: 'LLM',
  llm_chat: 'LLM Chat',
  rag: 'RAG',
  db_reply: 'SQL Query',
  code: 'Python Code',
  web_crawl_llm: 'Web Crawl + LLM',
  ws_markdown: 'Markdown',
  ws_html: 'HTML',
  ws_speech: 'Speech',
  ws_options: 'Options',
  ws_location: 'Location',
  ws_file: 'File',
  ws_image: 'Image',
  ws_dataframe: 'Dataframe',
  ws_plotly: 'Plotly',
};

const enhance = compose<ComponentClass<OwnProps>>(
  localized,
  connect<StateProps, DispatchProps, OwnProps, ModelState>((state) => ({ elements: state.elements }), {
    create: UMLElementRepository.create,
    update: UMLElementRepository.update,
    remove: UMLElementRepository.delete,
    getById: UMLElementRepository.getById as any as AsyncDispatch<typeof UMLElementRepository.getById>,
    layout: LayouterRepository.layout,
  }),
);

class StateUpdate extends Component<Props, State> {
  state: State = {
    colorOpen: false,
    newBodyActionType: 'text',
    newFallbackActionType: 'text',
    newBodyActionSection: 'simple',
    newFallbackActionSection: 'simple',
    collapsedBodyIds: new Set(),
    collapsedFallbackIds: new Set(),
    draggingIndex: null,
    draggingPrefix: null,
    dragOverIndex: null,
    dragOverPrefix: null,
    dragArmedKey: null,
  };

  private layoutTimer: ReturnType<typeof setTimeout> | null = null;

  componentWillUnmount() {
    if (this.layoutTimer) clearTimeout(this.layoutTimer);
  }

  private scheduleLayout = () => {
    if (this.layoutTimer) clearTimeout(this.layoutTimer);
    this.layoutTimer = setTimeout(() => {
      this.props.layout();
      this.layoutTimer = null;
    }, 300);
  };

  private toggleColor = () => this.setState((s) => ({ colorOpen: !s.colorOpen }));

  render() {
    const { element, getById, elements } = this.props;
    const children = element.ownedElements.map((id) => getById(id)).filter(notEmpty);
    const bodies = children.filter((c): c is AgentStateMember => c instanceof AgentStateBody);
    const fallbackBodies = children.filter((c): c is AgentStateMember => c instanceof AgentStateFallbackBody);

    const ragDatabaseNames = Array.from(
      new Set(
        Object.values(elements)
          .filter((el: any) => el.type === AgentElementType.AgentRagElement && typeof el.name === 'string')
          .map((el: any) => el.name.trim())
          .filter((n) => n.length > 0),
      ),
    );
    const AGENT_LLM_TYPE = (AgentElementType as Record<string, string>).AgentLLM ?? 'AgentLLM';
    const llmEntries = Array.from(
      new Map(
        Object.values(elements)
          .filter((el: any) => el.type === AGENT_LLM_TYPE && typeof el.name === 'string')
          .map((el: any) => {
            const name = String(el.name).trim();
            return [name, { name, provider: String((el as any).provider || '').toLowerCase() } as const];
          })
          .filter(([name]) => name.length > 0),
      ).values(),
    );
    const llmNames = llmEntries.map((entry) => entry.name);
    const llmProviderByName = llmEntries.reduce<Record<string, string>>((acc, entry) => {
      acc[entry.name] = entry.provider;
      return acc;
    }, {});
    const hasCompatibleChatLlm = llmEntries.some((entry) => this.isChatCompatibleProvider(entry.provider));

    const hasWebSocketPlatform = diagramBridge.getAgentPlatform() === 'websocket';

    const stateType = element.stateType ?? 'standard';
    const fallbackEnabled = element.fallbackBodyEnabled !== false;

    // ─── Quality warnings ────────────────────────────────────────────────────
    const allBodyActions = [...bodies, ...fallbackBodies];
    const LLM_ACTION_TYPES = new Set(['llm', 'llm_chat', 'rag', 'web_crawl_llm']);
    const needsLlm =
      llmNames.length === 0 &&
      (stateType === 'reasoning' ||
        allBodyActions.some(
          (a) =>
            LLM_ACTION_TYPES.has(a.replyType) ||
            (a.replyType === 'db_reply' && (a.dbQueryMode || 'llm_query') === 'llm_query'),
        ));
    const needsPlatform = !hasWebSocketPlatform && allBodyActions.some((a) => WS_REPLY_TYPES.has(a.replyType));
    const needsChatLlm = !hasCompatibleChatLlm && allBodyActions.some((a) => a.replyType === 'llm_chat');

    return (
      <div>
        {/* Name / color / delete */}
        <Section>
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
        </Section>

        {/* State type selector */}
        <Section>
          <SectionHeader>{this.props.translate('packages.AgentDiagram.stateType')}</SectionHeader>
          <Dropdown
            value={stateType}
            onChange={(value) => this.props.update<AgentState>(element.id, { stateType: value } as any)}
          >
            {[
              <Dropdown.Item key="standard" value="standard">
                {this.props.translate('packages.AgentDiagram.standard')}
              </Dropdown.Item>,
              <Dropdown.Item key="reasoning" value="reasoning">
                {this.props.translate('packages.AgentDiagram.reasoning')}
              </Dropdown.Item>,
            ]}
          </Dropdown>
        </Section>

        {/* Quality warnings */}
        {(needsLlm || needsPlatform || needsChatLlm) && (
          <Section>
            <Divider />
            {needsLlm && (
              <WsWarning>
                ⚠ No LLM is defined in the diagram, but this state requires one. Add an LLM in the Agent Configuration.
              </WsWarning>
            )}
            {needsChatLlm && (
              <WsWarning>
                ⚠ LLM Chat requires an OpenAI or Hugging Face LLM, but none are defined. Add a compatible LLM in the
                Agent Configuration.
              </WsWarning>
            )}
            {needsPlatform && (
              <WsWarning>
                ⚠ This state has WebSocket reply actions, but the platform is not set to WebSocket. Change the platform
                in Agent Configuration.
              </WsWarning>
            )}
          </Section>
        )}

        {/* Reasoning config */}
        {stateType === 'reasoning' && this.renderReasoningConfig(element, llmNames)}

        {/* Body / fallback — standard only */}
        {stateType === 'standard' && (
          <>
            <Section>
              <Divider />
            </Section>
            <Section>
              <SectionHeader>{this.props.translate('packages.AgentDiagram.body')}</SectionHeader>
              {this.renderBodySection(
                bodies,
                AgentStateBody,
                ragDatabaseNames,
                llmNames,
                llmProviderByName,
                hasCompatibleChatLlm,
                hasWebSocketPlatform,
                'body',
              )}
            </Section>

            <Section>
              <Divider />
            </Section>
            <Section>
              <ToggleLabel>
                <input
                  type="checkbox"
                  checked={fallbackEnabled}
                  onChange={(e) => {
                    this.props.update<AgentState>(element.id, { fallbackBodyEnabled: e.target.checked } as any);
                    if (!e.target.checked) fallbackBodies.forEach((fb) => this.delete(fb.id)());
                  }}
                />
                {this.props.translate('packages.AgentDiagram.enableFallbackBody')}
              </ToggleLabel>
              {fallbackEnabled && (
                <>
                  <SectionHeader style={{ marginTop: 8 }}>
                    {this.props.translate('packages.AgentDiagram.fallbackBody')}
                  </SectionHeader>
                  {this.renderBodySection(
                    fallbackBodies,
                    AgentStateFallbackBody,
                    ragDatabaseNames,
                    llmNames,
                    llmProviderByName,
                    hasCompatibleChatLlm,
                    hasWebSocketPlatform,
                    'fallback',
                  )}
                </>
              )}
            </Section>
          </>
        )}
      </div>
    );
  }

  // ─── Reasoning config ────────────────────────────────────────────────────────

  private renderReasoningConfig = (element: AgentState, llmNames: string[]) => (
    <>
      <Section>
        <Divider />
      </Section>
      <Section>
        <Header>{this.props.translate('packages.AgentDiagram.llmName')}</Header>
        <LlmSelect
          value={element.llm_name || ''}
          onChange={(e) => this.props.update<AgentState>(element.id, { llm_name: e.target.value } as any)}
        >
          <option value="">{this.props.translate('packages.AgentDiagram.selectPlaceholder')}</option>
          {llmNames.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </LlmSelect>
      </Section>
      <Section>
        <Header>{this.props.translate('packages.AgentDiagram.maxSteps')}</Header>
        <Textfield
          value={element.max_steps ?? 8}
          onChange={(value) => {
            const parsed = parseInt(String(value), 10);
            this.props.update<AgentState>(element.id, { max_steps: Number.isNaN(parsed) ? 8 : parsed } as any);
          }}
        />
      </Section>
      <Section>
        <CheckboxRow>
          <input
            type="checkbox"
            checked={element.enable_task_planning !== false}
            onChange={(e) =>
              this.props.update<AgentState>(element.id, { enable_task_planning: e.target.checked } as any)
            }
          />
          {this.props.translate('packages.AgentDiagram.enableTaskPlanning')}
        </CheckboxRow>
        <CheckboxRow>
          <input
            type="checkbox"
            checked={element.stream_steps !== false}
            onChange={(e) => this.props.update<AgentState>(element.id, { stream_steps: e.target.checked } as any)}
          />
          {this.props.translate('packages.AgentDiagram.streamSteps')}
        </CheckboxRow>
      </Section>
      <Section>
        <Header>{this.props.translate('packages.AgentDiagram.systemPrompt')}</Header>
        <Textfield
          value={element.system_prompt || ''}
          multiline
          enterToSubmit={false}
          placeholder={this.props.translate('packages.AgentDiagram.optionalSystemPromptPrefix')}
          onChange={(system_prompt) => this.props.update<AgentState>(element.id, { system_prompt } as any)}
        />
      </Section>
      <Section>
        <Header>{this.props.translate('packages.AgentDiagram.fallbackMessage')}</Header>
        <Textfield
          value={element.fallback_message || ''}
          multiline
          enterToSubmit={false}
          placeholder={this.props.translate('packages.AgentDiagram.messageReturnedIfReasoningFails')}
          onChange={(fallback_message) => this.props.update<AgentState>(element.id, { fallback_message } as any)}
        />
      </Section>
    </>
  );

  // ─── Body section (predefined / custom toggle + action list) ─────────────────

  private renderBodySection = (
    actions: AgentStateMember[],
    Clazz: typeof AgentStateBody | typeof AgentStateFallbackBody,
    ragDatabaseNames: string[],
    llmNames: string[],
    llmProviderByName: Record<string, string>,
    hasCompatibleChatLlm: boolean,
    hasWebSocketPlatform: boolean,
    prefix: 'body' | 'fallback',
  ) => {
    const isCustom = actions.some((a) => a.replyType === 'code');
    const bodyType = isCustom ? 'custom' : 'predefined';

    return (
      <>
        <BodyTypeRow>
          <BodyTypeBtn
            active={bodyType === 'predefined'}
            onClick={() => {
              if (bodyType !== 'predefined') this.switchBodyType('predefined', actions, Clazz);
            }}
          >
            {this.props.translate('packages.AgentDiagram.predefined')}
          </BodyTypeBtn>
          <BodyTypeBtn
            active={bodyType === 'custom'}
            onClick={() => {
              if (bodyType !== 'custom') this.switchBodyType('custom', actions, Clazz);
            }}
          >
            {this.props.translate('packages.AgentDiagram.customPython')}
          </BodyTypeBtn>
        </BodyTypeRow>

        {bodyType === 'custom'
          ? this.renderCustomBody(actions, Clazz)
          : this.renderPredefinedBody(
              actions,
              Clazz,
              ragDatabaseNames,
              llmNames,
              llmProviderByName,
              hasCompatibleChatLlm,
              hasWebSocketPlatform,
              prefix,
            )}
      </>
    );
  };

  private renderCustomBody = (
    actions: AgentStateMember[],
    Clazz: typeof AgentStateBody | typeof AgentStateFallbackBody,
  ) => {
    const codeAction = actions.find((a) => a.replyType === 'code');
    if (!codeAction) {
      return (
        <Button
          color="primary"
          onClick={() => this.create(Clazz, 'code')("def body_name(session: 'Session'):\n    pass\n")}
        >
          {this.props.translate('packages.AgentDiagram.initializePythonCode')}
        </Button>
      );
    }
    return (
      <ResizableCodeMirrorWrapper>
        <CodeMirror
          value={codeAction.name}
          options={{ mode: 'python', theme: 'material', lineNumbers: true, tabSize: 4, indentWithTabs: true }}
          onBeforeChange={(_e, _d, value) => {
            this.props.update(codeAction.id, { name: value });
            this.scheduleLayout();
          }}
          onChange={(_e, _d, value) => {
            if (value.trim()) this.props.update(codeAction.id, { name: value });
          }}
        />
      </ResizableCodeMirrorWrapper>
    );
  };

  private renderPredefinedBody = (
    actions: AgentStateMember[],
    Clazz: typeof AgentStateBody | typeof AgentStateFallbackBody,
    ragDatabaseNames: string[],
    llmNames: string[],
    llmProviderByName: Record<string, string>,
    hasCompatibleChatLlm: boolean,
    hasWebSocketPlatform: boolean,
    prefix: 'body' | 'fallback',
  ) => {
    const section: ActionSection =
      prefix === 'body' ? this.state.newBodyActionSection : this.state.newFallbackActionSection;
    const setSection = (s: ActionSection) => {
      const firstOfSection = SECTION_ACTION_TYPES[s][0];
      if (prefix === 'body') this.setState({ newBodyActionSection: s, newBodyActionType: firstOfSection });
      else this.setState({ newFallbackActionSection: s, newFallbackActionType: firstOfSection });
    };

    const sectionTypes = SECTION_ACTION_TYPES[section];
    const newActionType = prefix === 'body' ? this.state.newBodyActionType : this.state.newFallbackActionType;
    const selectedActionType = sectionTypes.includes(newActionType) ? newActionType : sectionTypes[0];
    const setNewActionType = (v: string) =>
      prefix === 'body' ? this.setState({ newBodyActionType: v }) : this.setState({ newFallbackActionType: v });

    const collapsedIds = prefix === 'body' ? this.state.collapsedBodyIds : this.state.collapsedFallbackIds;
    const wsTooltip = 'Requires WebSocketPlatform. Shown in red as a reminder — add it to dismiss.';
    const chatTooltip = 'Requires an OpenAI or Hugging Face LLM. Shown in red as a reminder.';
    const wsColor = hasWebSocketPlatform ? undefined : '#e04040';
    const chatColor = hasCompatibleChatLlm ? undefined : '#e04040';

    return (
      <>
        {actions.map((action, index) => {
          const isExpanded = !collapsedIds.has(action.id);
          const isDraggingOver = this.state.dragOverIndex === index && this.state.dragOverPrefix === prefix;
          const isDragging = this.state.draggingIndex === index && this.state.draggingPrefix === prefix;
          const badgeWarning =
            (WS_REPLY_TYPES.has(action.replyType) && !hasWebSocketPlatform) ||
            (action.replyType === 'llm_chat' && !hasCompatibleChatLlm) ||
            (llmNames.length === 0 &&
              (action.replyType === 'llm' ||
                action.replyType === 'rag' ||
                action.replyType === 'web_crawl_llm' ||
                (action.replyType === 'db_reply' && (action.dbQueryMode || 'llm_query') === 'llm_query')));

          const cardKey = `${prefix}-${index}`;

          return (
            <ActionCard
              key={action.id}
              draggable={this.state.dragArmedKey === cardKey}
              data-drag-over={isDraggingOver ? 'true' : 'false'}
              data-dragging={isDragging ? 'true' : 'false'}
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', String(index));
                e.dataTransfer.effectAllowed = 'move';
                this.setState({ draggingIndex: index, draggingPrefix: prefix });
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (this.state.dragOverIndex !== index || this.state.dragOverPrefix !== prefix) {
                  this.setState({ dragOverIndex: index, dragOverPrefix: prefix });
                }
              }}
              onDragLeave={() => {
                this.setState({ dragOverIndex: null, dragOverPrefix: null });
              }}
              onDrop={(e) => {
                e.preventDefault();
                const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
                // Only reorder within the same section. Without this guard a card
                // dragged from the body list and dropped on the fallback list (or
                // vice versa) calls swapActions with an index from the other list,
                // dereferencing an out-of-range member and crashing.
                if (
                  this.state.draggingPrefix === prefix &&
                  !Number.isNaN(fromIndex) &&
                  fromIndex !== index &&
                  fromIndex < actions.length
                ) {
                  this.swapActions(actions, fromIndex, index);
                }
                this.setState({
                  draggingIndex: null,
                  draggingPrefix: null,
                  dragOverIndex: null,
                  dragOverPrefix: null,
                  dragArmedKey: null,
                });
              }}
              onDragEnd={() => {
                this.setState({
                  draggingIndex: null,
                  draggingPrefix: null,
                  dragOverIndex: null,
                  dragOverPrefix: null,
                  dragArmedKey: null,
                });
              }}
            >
              <ActionCardHeader>
                <DragHandle
                  title="Drag to reorder"
                  onMouseDown={() => this.setState({ dragArmedKey: cardKey })}
                  onMouseUp={() => this.setState({ dragArmedKey: null })}
                >
                  ⠿
                </DragHandle>
                <ActionTypeBadge style={badgeWarning ? { color: '#e04040' } : undefined}>
                  {ACTION_TYPE_LABELS[action.replyType] ?? action.replyType}
                </ActionTypeBadge>
                <ActionSummary title={action.name}>{this.getActionSummary(action)}</ActionSummary>
                <IconBtn
                  title={
                    isExpanded
                      ? this.props.translate('packages.AgentDiagram.collapse')
                      : this.props.translate('packages.AgentDiagram.expand')
                  }
                  onClick={() => this.toggleExpand(action.id, prefix)}
                >
                  {isExpanded ? '▲' : '✎'}
                </IconBtn>
                <IconBtn
                  title={this.props.translate('packages.AgentDiagram.deleteAction')}
                  onClick={this.delete(action.id)}
                >
                  <TrashIcon />
                </IconBtn>
              </ActionCardHeader>
              {isExpanded && (
                <ActionBody>
                  {this.renderActionEditor(
                    action,
                    Clazz,
                    ragDatabaseNames,
                    llmNames,
                    llmProviderByName,
                    `${prefix}-${index}`,
                    hasWebSocketPlatform,
                    hasCompatibleChatLlm,
                  )}
                </ActionBody>
              )}
            </ActionCard>
          );
        })}

        <NewActionLabel>{this.props.translate('packages.AgentDiagram.newActionLabel') || 'New action'}</NewActionLabel>
        <SectionTabRow>
          <SectionTab active={section === 'simple'} onClick={() => setSection('simple')}>
            {this.props.translate('packages.AgentDiagram.simpleReplies')}
          </SectionTab>
          <SectionTab active={section === 'ai'} onClick={() => setSection('ai')}>
            {this.props.translate('packages.AgentDiagram.aiReplies')}
          </SectionTab>
          <SectionTab active={section === 'data'} onClick={() => setSection('data')}>
            {this.props.translate('packages.AgentDiagram.dataQuery')}
          </SectionTab>
        </SectionTabRow>
        <AddActionRow>
          <LlmSelect
            value={selectedActionType}
            onChange={(e) => setNewActionType(e.target.value)}
            style={
              WS_REPLY_TYPES.has(selectedActionType)
                ? { color: wsColor }
                : selectedActionType === 'llm_chat'
                  ? { color: chatColor }
                  : undefined
            }
          >
            {section === 'simple' && (
              <>
                <option value="text">{ACTION_TYPE_LABELS['text']}</option>
                <option value="ws_markdown" title={wsTooltip} style={{ color: wsColor }}>
                  {ACTION_TYPE_LABELS['ws_markdown']}
                </option>
                <option value="ws_html" title={wsTooltip} style={{ color: wsColor }}>
                  {ACTION_TYPE_LABELS['ws_html']}
                </option>
                <option value="ws_speech" title={wsTooltip} style={{ color: wsColor }}>
                  {ACTION_TYPE_LABELS['ws_speech']}
                </option>
                <option value="ws_options" title={wsTooltip} style={{ color: wsColor }}>
                  {ACTION_TYPE_LABELS['ws_options']}
                </option>
                <option value="ws_location" title={wsTooltip} style={{ color: wsColor }}>
                  {ACTION_TYPE_LABELS['ws_location']}
                </option>
                <option value="ws_file" title={wsTooltip} style={{ color: wsColor }}>
                  {ACTION_TYPE_LABELS['ws_file']}
                </option>
                <option value="ws_image" title={wsTooltip} style={{ color: wsColor }}>
                  {ACTION_TYPE_LABELS['ws_image']}
                </option>
                <option value="ws_dataframe" title={wsTooltip} style={{ color: wsColor }}>
                  {ACTION_TYPE_LABELS['ws_dataframe']}
                </option>
                <option value="ws_plotly" title={wsTooltip} style={{ color: wsColor }}>
                  {ACTION_TYPE_LABELS['ws_plotly']}
                </option>
              </>
            )}
            {section === 'ai' && (
              <>
                <option value="llm">{ACTION_TYPE_LABELS['llm']}</option>
                <option value="llm_chat" title={chatTooltip} style={{ color: chatColor }}>
                  {ACTION_TYPE_LABELS['llm_chat']}
                </option>
              </>
            )}
            {section === 'data' && (
              <>
                <option value="rag">{ACTION_TYPE_LABELS['rag']}</option>
                <option value="db_reply">{ACTION_TYPE_LABELS['db_reply']}</option>
                <option value="web_crawl_llm">{ACTION_TYPE_LABELS['web_crawl_llm']}</option>
              </>
            )}
          </LlmSelect>
          <Button
            color="primary"
            onClick={() => {
              const id = this.addPredefinedAction(Clazz, selectedActionType);
              // New actions are expanded by default; make sure a stale collapsed
              // entry (e.g. from a previously deleted action reusing state) can't
              // hide the freshly created one.
              if (id) {
                const key = prefix === 'body' ? 'collapsedBodyIds' : 'collapsedFallbackIds';
                if (this.state[key].has(id)) {
                  const next = new Set(this.state[key]);
                  next.delete(id);
                  this.setState({ [key]: next } as any);
                }
              }
            }}
          >
            {this.props.translate('packages.AgentDiagram.add')}
          </Button>
        </AddActionRow>
      </>
    );
  };

  // ─── Action editor (inline, shown when expanded) ──────────────────────────────

  private renderActionEditor = (
    action: AgentStateMember,
    Clazz: typeof AgentStateBody | typeof AgentStateFallbackBody,
    ragDatabaseNames: string[],
    llmNames: string[],
    llmProviderByName: Record<string, string>,
    fieldId: string,
    hasWebSocketPlatform: boolean,
    hasCompatibleChatLlm: boolean,
  ): React.ReactNode => {
    switch (action.replyType) {
      case 'text':
        return (
          <Textfield
            outline
            value={action.name}
            onChange={(value) => this.props.update(action.id, { name: value })}
            placeholder="Enter reply message"
          />
        );
      case 'llm':
        return (
          <>
            {llmNames.length === 0 && (
              <WsWarning style={{ marginBottom: 6 }}>
                {this.props.translate('packages.AgentDiagram.noLlmDefined')}
              </WsWarning>
            )}
            {this.renderLlmNameField(action, llmNames, `${fieldId}-llm`)}
          </>
        );
      case 'llm_chat': {
        const selectedProvider = action.llm_name ? llmProviderByName[action.llm_name] : '';
        const hasIncompatibleSelection = Boolean(
          action.llm_name && selectedProvider && !this.isChatCompatibleProvider(selectedProvider),
        );
        return (
          <>
            {!hasCompatibleChatLlm && (
              <WsWarning style={{ marginBottom: 6 }}>
                {this.props.translate('packages.AgentDiagram.noLlmDefinedChat')}
              </WsWarning>
            )}
            {this.renderLlmNameField(action, llmNames, `${fieldId}-llm-chat`, {
              warning: hasIncompatibleSelection
                ? this.props.translate('packages.AgentDiagram.warningIncompatibleProvider')
                : undefined,
            })}
          </>
        );
      }
      case 'rag':
        return (
          <>
            {llmNames.length === 0 && (
              <WsWarning style={{ marginBottom: 6 }}>
                {this.props.translate('packages.AgentDiagram.noLlmDefinedRag')}
              </WsWarning>
            )}
            {ragDatabaseNames.length ? (
              <LlmFieldRow>
                <Header>{this.props.translate('packages.AgentDiagram.ragDatabase')}</Header>
                <Dropdown
                  value={
                    action.ragDatabaseName && action.ragDatabaseName.length > 0
                      ? action.ragDatabaseName
                      : '__placeholder__'
                  }
                  onChange={(value) => {
                    const selected = value === '__placeholder__' ? '' : value;
                    this.props.update<AgentStateMember>(action.id, {
                      ragDatabaseName: selected,
                      name: this.getRagDisplayName(selected),
                    });
                  }}
                >
                  {[
                    <Dropdown.Item value="__placeholder__" key="rag-placeholder">
                      {this.props.translate('packages.AgentDiagram.selectRagDatabase')}
                    </Dropdown.Item>,
                    ...ragDatabaseNames.map((name, i) => (
                      <Dropdown.Item key={`rag-${i}-${name}`} value={name}>
                        {name}
                      </Dropdown.Item>
                    )),
                  ]}
                </Dropdown>
                <Header style={{ marginTop: 6 }}>{this.props.translate('packages.AgentDiagram.prompt')}</Header>
                <Textfield
                  outline
                  multiline
                  enterToSubmit={false}
                  value={action.prompt || ''}
                  onChange={(value) => this.props.update<AgentStateMember>(action.id, { prompt: value })}
                  placeholder={this.props.translate('packages.AgentDiagram.optionalPromptPassed')}
                />
              </LlmFieldRow>
            ) : (
              <p style={{ fontSize: 12, margin: '4px 0', opacity: 0.7 }}>
                {this.props.translate('packages.AgentDiagram.noRagDatabases')}
              </p>
            )}
          </>
        );
      case 'db_reply':
        return this.renderDbReplyEditor(action, Clazz, llmNames);
      case 'web_crawl_llm':
        return this.renderWebCrawlLlmEditor(action, llmNames);
      case 'ws_markdown':
      case 'ws_html':
      case 'ws_speech':
      case 'ws_options':
      case 'ws_location':
      case 'ws_file':
      case 'ws_image':
      case 'ws_dataframe':
      case 'ws_plotly':
        return this.renderWebSocketReplyEditor(action, hasWebSocketPlatform);
      default:
        return null;
    }
  };

  // ─── Summary text for collapsed action cards ─────────────────────────────────

  private getActionSummary = (action: AgentStateMember): string => {
    const name = action.name || '';
    const truncate = (s: string, n = 40) => (s.length > n ? s.slice(0, n) + '…' : s);
    switch (action.replyType) {
      case 'llm':
        return action.llm_name ? `LLM: ${action.llm_name}` : '(default LLM)';
      case 'llm_chat':
        return action.llm_name ? `Chat: ${action.llm_name}` : '(default LLM chat)';
      case 'rag':
        return action.ragDatabaseName
          ? `DB: ${action.ragDatabaseName}${action.prompt ? ' (prompt)' : ''}`
          : '(select database)';
      case 'web_crawl_llm':
        return action.initial_url
          ? `Crawl: ${truncate(action.initial_url, 30)}${action.run_crawl ? '' : ' (no crawl)'}`
          : '(set URL)';
      case 'ws_markdown':
      case 'ws_html':
        return action.ws_message ? truncate(action.ws_message) : '(no message)';
      case 'ws_speech':
        return action.ws_message ? truncate(action.ws_message) : '(no message)';
      case 'ws_options': {
        const opts = (action.ws_options || '').split('\n').filter(Boolean);
        return opts.length ? `${opts.length} option(s)` : '(no options)';
      }
      case 'ws_location':
        return `(${action.ws_latitude ?? 0}, ${action.ws_longitude ?? 0})`;
      case 'ws_file':
        return '(placeholder: file)';
      case 'ws_image':
        return '(placeholder: image)';
      case 'ws_dataframe':
        return '(placeholder: dataframe)';
      case 'ws_plotly':
        return '(placeholder: plot)';
      default:
        return truncate(name);
    }
  };

  // ─── Body type switch ─────────────────────────────────────────────────────────

  private switchBodyType = (
    type: 'predefined' | 'custom',
    actions: AgentStateMember[],
    Clazz: typeof AgentStateBody | typeof AgentStateFallbackBody,
  ) => {
    actions.forEach((a) => this.delete(a.id)());
    if (type === 'custom') {
      this.create(Clazz, 'code')("def body_name(session: 'Session'):\n    pass\n");
    }
  };

  // ─── Add predefined action (returns a stable reference for auto-expand) ───────

  private addPredefinedAction = (
    Clazz: typeof AgentStateBody | typeof AgentStateFallbackBody,
    replyType: string,
  ): string | null => {
    const member = new Clazz();
    member.replyType = replyType;
    switch (replyType) {
      case 'text':
        member.name = 'Enter reply message';
        break;
      case 'llm':
        member.name = 'LLM Reply';
        break;
      case 'llm_chat':
        member.name = 'LLM Chat Reply';
        break;
      case 'rag': {
        member.ragDatabaseName = '';
        member.prompt = '';
        member.name = this.getRagDisplayName('');
        break;
      }
      case 'db_reply': {
        const defaults = this.getDefaultDbReplyValues();
        Object.assign(member, defaults);
        member.name = this.getDbDisplayName(
          defaults.dbSelectionType,
          defaults.dbCustomName,
          defaults.dbQueryMode,
          defaults.dbOperation,
        );
        break;
      }
      case 'web_crawl_llm':
        member.initial_url = '';
        member.max_depth = 2;
        member.max_pages = 20;
        member.crawl_format = 'markdown';
        member.base_url_prefix = '';
        member.run_crawl = true;
        member.no_crawl_error_message = 'No web crawl data is available yet.';
        member.system_message_prefix = '';
        member.name = 'Web Crawl + LLM (set URL)';
        break;
      case 'ws_markdown':
        member.ws_message = '';
        member.name = 'Markdown (empty)';
        break;
      case 'ws_html':
        member.ws_message = '';
        member.name = 'HTML (empty)';
        break;
      case 'ws_speech':
        member.ws_message = '';
        member.ws_audio_speed = null;
        member.name = 'Speech (empty)';
        break;
      case 'ws_options':
        member.ws_options = '';
        member.name = 'Options (no options)';
        break;
      case 'ws_location':
        member.ws_latitude = 0;
        member.ws_longitude = 0;
        member.name = 'Location (0, 0)';
        break;
      case 'ws_file':
        member.name = 'File (placeholder)';
        break;
      case 'ws_image':
        member.name = 'Image (placeholder)';
        break;
      case 'ws_dataframe':
        member.name = 'Dataframe (placeholder)';
        break;
      case 'ws_plotly':
        member.name = 'Plotly (placeholder)';
        break;
      default:
        member.name = replyType;
    }
    this.props.create(member, this.props.element.id);
    return member.id;
  };

  // ─── Expand / collapse ────────────────────────────────────────────────────────

  private toggleExpand = (id: string, prefix: 'body' | 'fallback') => {
    const key = prefix === 'body' ? 'collapsedBodyIds' : 'collapsedFallbackIds';
    const current: Set<string> = this.state[key];
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.setState({ [key]: next } as any);
  };

  // ─── Swap (drag-and-drop backing) ─────────────────────────────────────────────

  private swapActions = (actions: AgentStateMember[], indexA: number, indexB: number) => {
    const a = actions[indexA];
    const b = actions[indexB];
    const fieldsOf = (m: AgentStateMember) => ({
      name: m.name,
      replyType: m.replyType,
      ragDatabaseName: m.ragDatabaseName,
      prompt: m.prompt,
      dbSelectionType: m.dbSelectionType,
      dbCustomName: m.dbCustomName,
      dbQueryMode: m.dbQueryMode,
      dbOperation: m.dbOperation,
      dbSqlQuery: m.dbSqlQuery,
      llm_name: m.llm_name,
      system_message: m.system_message,
      initial_url: m.initial_url,
      max_depth: m.max_depth,
      max_pages: m.max_pages,
      crawl_format: m.crawl_format,
      base_url_prefix: m.base_url_prefix,
      run_crawl: m.run_crawl,
      no_crawl_error_message: m.no_crawl_error_message,
      system_message_prefix: m.system_message_prefix,
      ws_message: m.ws_message,
      ws_audio_speed: m.ws_audio_speed,
      ws_options: m.ws_options,
      ws_latitude: m.ws_latitude,
      ws_longitude: m.ws_longitude,
    });
    this.props.update<AgentStateMember>(a.id, fieldsOf(b));
    this.props.update<AgentStateMember>(b.id, fieldsOf(a));
  };

  // ─── WebSocket reply editor ───────────────────────────────────────────────────

  private renderWebSocketReplyEditor = (action: AgentStateMember, hasWebSocketPlatform: boolean): React.ReactNode => {
    const platformWarning = !hasWebSocketPlatform ? (
      <WsWarning style={{ marginBottom: 6 }}>
        {this.props.translate('packages.AgentDiagram.requiresWebSocketWarning')}
      </WsWarning>
    ) : null;

    let content: React.ReactNode = null;
    switch (action.replyType) {
      case 'ws_markdown':
      case 'ws_html':
        content = (
          <LlmFieldRow>
            <Header>{this.props.translate('packages.AgentDiagram.message')}</Header>
            <Textfield
              outline
              multiline
              enterToSubmit={false}
              value={action.ws_message || ''}
              onChange={(v) =>
                this.props.update<AgentStateMember>(action.id, {
                  ws_message: v,
                  name: v ? v.slice(0, 40) : `${ACTION_TYPE_LABELS[action.replyType]} (empty)`,
                })
              }
              placeholder={action.replyType === 'ws_markdown' ? '**Bold**, *italic*, etc.' : '<p>HTML content</p>'}
            />
          </LlmFieldRow>
        );
        break;
      case 'ws_speech':
        content = (
          <LlmFieldRow>
            <Header>{this.props.translate('packages.AgentDiagram.message')}</Header>
            <Textfield
              outline
              multiline
              enterToSubmit={false}
              value={action.ws_message || ''}
              onChange={(v) => this.props.update<AgentStateMember>(action.id, { ws_message: v })}
              placeholder="Text to convert to speech"
            />
            <Header style={{ marginTop: 6 }}>{this.props.translate('packages.AgentDiagram.audioSpeedOptional')}</Header>
            <Textfield
              outline
              value={action.ws_audio_speed ?? ''}
              onChange={(v) => {
                const parsed = parseFloat(String(v));
                this.props.update<AgentStateMember>(action.id, {
                  ws_audio_speed: String(v) === '' || isNaN(parsed) ? null : parsed,
                });
              }}
              placeholder={this.props.translate('packages.AgentDiagram.default')}
            />
          </LlmFieldRow>
        );
        break;
      case 'ws_options':
        content = (
          <LlmFieldRow>
            <Header>{this.props.translate('packages.AgentDiagram.optionsOnePerLine')}</Header>
            <Textfield
              outline
              multiline
              enterToSubmit={false}
              value={action.ws_options || ''}
              onChange={(v) => {
                const count = v.split('\n').filter(Boolean).length;
                this.props.update<AgentStateMember>(action.id, {
                  ws_options: v,
                  name: count > 0 ? `Options: ${count} item(s)` : 'Options (no options)',
                });
              }}
              placeholder={'Yes\nNo\nMaybe'}
            />
          </LlmFieldRow>
        );
        break;
      case 'ws_location':
        content = (
          <LlmFieldRow>
            <DbFieldRow>
              <label>{this.props.translate('packages.AgentDiagram.latitude')}</label>
              <Textfield
                outline
                value={String(action.ws_latitude ?? 0)}
                onChange={(v) => {
                  const p = parseFloat(String(v).replace(',', '.'));
                  if (!isNaN(p)) this.props.update<AgentStateMember>(action.id, { ws_latitude: p });
                }}
                placeholder={this.props.translate('packages.AgentDiagram.eg48')}
              />
            </DbFieldRow>
            <DbFieldRow>
              <label>{this.props.translate('packages.AgentDiagram.longitude')}</label>
              <Textfield
                outline
                value={String(action.ws_longitude ?? 0)}
                onChange={(v) => {
                  const p = parseFloat(String(v).replace(',', '.'));
                  if (!isNaN(p)) this.props.update<AgentStateMember>(action.id, { ws_longitude: p });
                }}
                placeholder={this.props.translate('packages.AgentDiagram.eg23')}
              />
            </DbFieldRow>
          </LlmFieldRow>
        );
        break;
      case 'ws_file':
        content = (
          <WsWarning>
            The generated code contains a placeholder. You must assign a <code>baf.types.File</code> object to{' '}
            <code>reply_file_obj</code> before this state is reached.
          </WsWarning>
        );
        break;
      case 'ws_image':
        content = (
          <WsWarning>
            The generated code contains a placeholder. You must assign a <code>numpy.ndarray</code> image to{' '}
            <code>reply_image_arr</code> before this state is reached.
          </WsWarning>
        );
        break;
      case 'ws_dataframe':
        content = (
          <WsWarning>
            The generated code contains a placeholder. You must assign a <code>pandas.DataFrame</code>
            to <code>reply_df</code> before this state is reached.
          </WsWarning>
        );
        break;
      case 'ws_plotly':
        content = (
          <WsWarning>
            The generated code contains a placeholder. You must assign a <code>plotly.graph_objs.Figure</code>
            to <code>reply_plot</code> before this state is reached.
          </WsWarning>
        );
        break;
      default:
        break;
    }
    return (
      <>
        {platformWarning}
        {content}
      </>
    );
  };

  // ─── Helper renderers ─────────────────────────────────────────────────────────

  private renderLlmNameField = (
    member: AgentStateMember,
    llmNames: string[],
    fieldId: string,
    options?: { warning?: string },
  ) => this.renderLlmNameFieldWithOptions(member, llmNames, fieldId, options);

  private renderLlmNameFieldWithOptions = (
    member: AgentStateMember,
    llmNames: string[],
    fieldId: string,
    options?: { warning?: string },
  ) => (
    <LlmFieldRow>
      <Header>{this.props.translate('packages.AgentDiagram.llm')}</Header>
      <LlmSelect
        id={fieldId}
        value={member.llm_name || ''}
        onChange={(e) => this.props.update<AgentStateMember>(member.id, { llm_name: e.target.value })}
      >
        <option value="">{this.props.translate('packages.AgentDiagram.selectPlaceholder')}</option>
        {llmNames.map((n) => (
          <option key={`${fieldId}-${n}`} value={n}>
            {n}
          </option>
        ))}
      </LlmSelect>
      {options?.warning && <p style={{ fontSize: 12, margin: '4px 0', opacity: 0.7 }}>{options.warning}</p>}
      <Header style={{ marginTop: 6 }}>{this.props.translate('packages.AgentDiagram.systemMessage')}</Header>
      <Textfield
        outline
        value={member.system_message || ''}
        onChange={(value) => this.props.update<AgentStateMember>(member.id, { system_message: value })}
        placeholder={this.props.translate('packages.AgentDiagram.youAreHelpfulAssistant')}
      />
    </LlmFieldRow>
  );

  // Derived from the canonical list rather than re-listed, so a newly added
  // provider is chat-capable by default and only the genuine exceptions
  // (huggingface_api, replicate) have to be declared.
  private isChatCompatibleProvider = (provider: string): boolean =>
    (AGENT_LLM_PROVIDERS as readonly string[]).includes(provider) &&
    !NON_CHAT_AGENT_LLM_PROVIDERS.includes(provider);

  private renderDbReplyEditor = (
    member: AgentStateMember | undefined,
    Clazz: typeof AgentStateBody | typeof AgentStateFallbackBody,
    llmNames: string[] = [],
  ) => {
    if (!member) {
      return (
        <>
          <p>{this.props.translate('packages.AgentDiagram.configuringDatabaseAction')}</p>
          <Button
            color="primary"
            onClick={() => {
              const defaults = this.getDefaultDbReplyValues();
              this.create(
                Clazz,
                'db_reply',
                defaults,
              )(
                this.getDbDisplayName(
                  defaults.dbSelectionType,
                  defaults.dbCustomName,
                  defaults.dbQueryMode,
                  defaults.dbOperation,
                ),
              );
            }}
          >
            {this.props.translate('packages.AgentDiagram.initializeDatabaseAction')}
          </Button>
        </>
      );
    }

    const dbSelectionType = member.dbSelectionType || 'default';
    const dbQueryMode = member.dbQueryMode || 'llm_query';
    const dbOperation = member.dbOperation || 'any';

    return (
      <>
        <DbFieldRow>
          <label>{this.props.translate('packages.AgentDiagram.selectDatabase')}</label>
          <Dropdown
            value={dbSelectionType}
            onChange={(value) => {
              const next = value === 'custom' ? 'custom' : 'default';
              this.updateDbReply(member, {
                dbSelectionType: next,
                dbCustomName: next === 'default' ? '' : member.dbCustomName,
              });
            }}
          >
            {[
              <Dropdown.Item value="default" key="db-default">
                {this.props.translate('packages.AgentDiagram.defaultUsingAppDb')}
              </Dropdown.Item>,
              <Dropdown.Item value="custom" key="db-custom">
                {this.props.translate('packages.AgentDiagram.custom')}
              </Dropdown.Item>,
            ]}
          </Dropdown>
          {dbSelectionType === 'custom' && (
            <Textfield
              outline
              placeholder={this.props.translate('packages.AgentDiagram.customDatabaseName')}
              value={member.dbCustomName || ''}
              onChange={(value) => this.updateDbReply(member, { dbCustomName: value })}
            />
          )}
        </DbFieldRow>
        <DbFieldRow>
          <label>{this.props.translate('packages.AgentDiagram.dbOperation')}</label>
          <Dropdown
            value={dbOperation}
            onChange={(value) => {
              const ops = ['any', 'select', 'insert', 'update', 'delete'];
              this.updateDbReply(member, { dbOperation: ops.includes(value) ? value : 'any' });
            }}
          >
            {[
              <Dropdown.Item value="any" key="op-any">
                {this.props.translate('packages.AgentDiagram.any')}
              </Dropdown.Item>,
              <Dropdown.Item value="select" key="op-select">
                {this.props.translate('packages.AgentDiagram.select')}
              </Dropdown.Item>,
              <Dropdown.Item value="insert" key="op-insert">
                {this.props.translate('packages.AgentDiagram.insert')}
              </Dropdown.Item>,
              <Dropdown.Item value="update" key="op-update">
                {this.props.translate('packages.AgentDiagram.update')}
              </Dropdown.Item>,
              <Dropdown.Item value="delete" key="op-delete">
                {this.props.translate('packages.AgentDiagram.delete')}
              </Dropdown.Item>,
            ]}
          </Dropdown>
        </DbFieldRow>
        <DbFieldRow>
          <RadioGroup>
            <label>
              <input
                type="radio"
                name={`dbQueryMode-${member.id}`}
                value="llm_query"
                checked={dbQueryMode === 'llm_query'}
                onChange={() => this.updateDbReply(member, { dbQueryMode: 'llm_query', dbSqlQuery: '' })}
              />
              {this.props.translate('packages.AgentDiagram.llmQuery')}
            </label>
            <label>
              <input
                type="radio"
                name={`dbQueryMode-${member.id}`}
                value="sql"
                checked={dbQueryMode === 'sql'}
                onChange={() => this.updateDbReply(member, { dbQueryMode: 'sql' })}
              />
              {this.props.translate('packages.AgentDiagram.sql')}
            </label>
          </RadioGroup>
          {dbQueryMode === 'sql' ? (
            <Textfield
              outline
              multiline
              enterToSubmit={false}
              placeholder="SELECT * FROM table_name"
              value={member.dbSqlQuery || ''}
              onChange={(value) => this.updateDbReply(member, { dbSqlQuery: value })}
            />
          ) : (
            <>
              {llmNames.length === 0 && (
                <WsWarning style={{ marginBottom: 6 }}>
                  {this.props.translate('packages.AgentDiagram.noLlmQueryMode')}
                </WsWarning>
              )}
              <p>{this.props.translate('packages.AgentDiagram.answerWillBeGenerated')}</p>
              {this.renderLlmNameField(member, llmNames, `db-llm-${member.id}`)}
            </>
          )}
        </DbFieldRow>
      </>
    );
  };

  private renderWebCrawlLlmEditor = (member: AgentStateMember, llmNames: string[]) => {
    const crawl_format = member.crawl_format || 'markdown';
    return (
      <LlmFieldRow>
        {llmNames.length === 0 && (
          <WsWarning style={{ marginBottom: 6 }}>
            {this.props.translate('packages.AgentDiagram.noLlmDefinedWeb')}
          </WsWarning>
        )}
        <Header>{this.props.translate('packages.AgentDiagram.initialUrl')}</Header>
        <Textfield
          outline
          value={member.initial_url || ''}
          onChange={(value) => {
            this.props.update<AgentStateMember>(member.id, {
              initial_url: value,
              name: value ? `Crawl: ${value.slice(0, 40)}` : 'Web Crawl + LLM (set URL)',
            });
          }}
          placeholder={this.props.translate('packages.AgentDiagram.httpsExample')}
        />
        <Header style={{ marginTop: 6 }}>{this.props.translate('packages.AgentDiagram.baseUrlPrefixOptional')}</Header>
        <Textfield
          outline
          value={member.base_url_prefix || ''}
          onChange={(value) => this.props.update<AgentStateMember>(member.id, { base_url_prefix: value })}
          placeholder={this.props.translate('packages.AgentDiagram.baseUrlPrefixExample')}
        />
        <DbFieldRow style={{ marginTop: 6 }}>
          <label>{this.props.translate('packages.AgentDiagram.maxDepth')}</label>
          <Textfield
            outline
            value={member.max_depth ?? 2}
            onChange={(value) => {
              const parsed = parseInt(String(value), 10);
              this.props.update<AgentStateMember>(member.id, { max_depth: Number.isNaN(parsed) ? 2 : parsed });
            }}
          />
        </DbFieldRow>
        <DbFieldRow>
          <label>{this.props.translate('packages.AgentDiagram.maxPages')}</label>
          <Textfield
            outline
            value={member.max_pages ?? 20}
            onChange={(value) => {
              const parsed = parseInt(String(value), 10);
              this.props.update<AgentStateMember>(member.id, { max_pages: Number.isNaN(parsed) ? 20 : parsed });
            }}
          />
        </DbFieldRow>
        <Header style={{ marginTop: 6 }}>{this.props.translate('packages.AgentDiagram.crawlFormat')}</Header>
        <LlmSelect
          value={crawl_format}
          onChange={(e) => this.props.update<AgentStateMember>(member.id, { crawl_format: e.target.value })}
        >
          <option value="markdown">{this.props.translate('packages.AgentDiagram.markdown')}</option>
          <option value="text">{this.props.translate('packages.AgentDiagram.plainText')}</option>
          <option value="html">{this.props.translate('packages.AgentDiagram.html')}</option>
        </LlmSelect>
        <CheckboxRow style={{ marginTop: 6 }}>
          <input
            type="checkbox"
            checked={member.run_crawl !== false}
            onChange={(e) => this.props.update<AgentStateMember>(member.id, { run_crawl: e.target.checked })}
          />
          {this.props.translate('packages.AgentDiagram.runCrawl')}
        </CheckboxRow>
        {member.run_crawl === false && (
          <>
            <Header style={{ marginTop: 6 }}>
              {this.props.translate('packages.AgentDiagram.noCrawlErrorMessage')}
            </Header>
            <Textfield
              outline
              value={member.no_crawl_error_message || ''}
              onChange={(value) => this.props.update<AgentStateMember>(member.id, { no_crawl_error_message: value })}
              placeholder={this.props.translate('packages.AgentDiagram.noCrawlErrorDefault')}
            />
          </>
        )}
        <Header style={{ marginTop: 6 }}>
          {this.props.translate('packages.AgentDiagram.systemMessagePrefixOptional')}
        </Header>
        <Textfield
          outline
          multiline
          enterToSubmit={false}
          value={member.system_message_prefix || ''}
          onChange={(value) => this.props.update<AgentStateMember>(member.id, { system_message_prefix: value })}
          placeholder={this.props.translate('packages.AgentDiagram.useFollowingWebpageContent')}
        />
        <Header style={{ marginTop: 6 }}>{this.props.translate('packages.AgentDiagram.llm')}</Header>
        <LlmSelect
          value={member.llm_name || ''}
          onChange={(e) => this.props.update<AgentStateMember>(member.id, { llm_name: e.target.value })}
        >
          <option value="">{this.props.translate('packages.AgentDiagram.selectPlaceholder')}</option>
          {llmNames.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </LlmSelect>
      </LlmFieldRow>
    );
  };

  // ─── Utility helpers ──────────────────────────────────────────────────────────

  private getRagDisplayName = (databaseName: string): string => {
    const trimmed = (databaseName || '').trim();
    return trimmed.length ? `RAG reply using ${trimmed} database` : 'RAG reply (select database)';
  };

  private getDefaultDbReplyValues = (): DbReplyValues => ({
    dbSelectionType: 'default',
    dbCustomName: '',
    dbQueryMode: 'llm_query',
    dbOperation: 'any',
    dbSqlQuery: '',
  });

  private getDbDisplayName = (
    dbSelectionType: string,
    dbCustomName: string,
    dbQueryMode: string,
    dbOperation: string,
  ): string => {
    const customDb = (dbCustomName || '').trim();
    const dbLabel =
      dbSelectionType === 'custom' ? (customDb.length ? customDb : 'custom database') : 'Default database';
    const modeLabel = dbQueryMode === 'sql' ? 'SQL' : 'LLM query';
    const opLabel = dbOperation === 'any' ? 'Any' : dbOperation.toUpperCase();
    return `DB action using ${dbLabel} (${modeLabel}, ${opLabel})`;
  };

  private updateDbReply = (member: AgentStateMember, values: Partial<AgentStateMember>) => {
    const dbSelectionType = values.dbSelectionType ?? member.dbSelectionType ?? 'default';
    const dbCustomName = values.dbCustomName ?? member.dbCustomName ?? '';
    const dbQueryMode = values.dbQueryMode ?? member.dbQueryMode ?? 'llm_query';
    const dbOperation = values.dbOperation ?? member.dbOperation ?? 'any';
    this.props.update<AgentStateMember>(member.id, {
      ...values,
      name: this.getDbDisplayName(dbSelectionType, dbCustomName, dbQueryMode, dbOperation),
    });
  };

  private create =
    (
      Clazz: typeof AgentStateBody | typeof AgentStateFallbackBody,
      replyType: string,
      initialValues?: Partial<AgentStateMember>,
    ) =>
    (value: string) => {
      const member = new Clazz();
      member.name = value;
      member.replyType = replyType;
      if (initialValues) Object.assign(member, initialValues);
      this.props.create(member, this.props.element.id);
    };

  private rename = (id: string) => (value: string) => this.props.update(id, { name: value });

  private delete = (id: string) => () => this.props.remove(id);
}

export const AgentStateUpdate = enhance(StateUpdate);
