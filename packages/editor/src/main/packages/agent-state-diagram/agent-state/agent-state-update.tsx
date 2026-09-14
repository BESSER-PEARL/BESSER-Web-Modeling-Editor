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
import { diagramBridge, AgentGUIInfo } from '../../../services/diagram-bridge';

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
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 6px;
  display: block;
`;

const RadioGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 6px 0;

  label {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 13px;
    cursor: pointer;
  }

  input[type='radio'] {
    width: 15px;
    height: 15px;
    flex-shrink: 0;
    accent-color: ${(props: any) => props.theme.color.primary};
    cursor: pointer;
  }
`;

const DbFieldRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 0;

  & + & {
    border-top: 1px solid ${(props: any) => props.theme.color.gray};
  }

  & > label {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    opacity: 0.55;
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
  gap: 6px;
  padding: 6px 0;
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
  border: 2px solid ${(props: any) => props.theme.color.gray};
  border-left: 4px solid ${(props: any) => props.theme.color.primary}99;
  border-radius: 8px;
  margin-bottom: 18px;
  background: ${(props: any) => props.theme.color.background};
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.07);
  transition: border-color 0.15s, box-shadow 0.15s;
  &:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.11);
  }
  &[data-drag-over='true'] {
    border-color: ${(props: any) => props.theme.color.primary};
    border-left-color: ${(props: any) => props.theme.color.primary};
    background: ${(props: any) => props.theme.color.primary}11;
    box-shadow: 0 2px 8px ${(props: any) => props.theme.color.primary}33;
  }
  &[data-dragging='true'] {
    opacity: 0.4;
  }
`;

const ActionCardHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 7px 8px;
  cursor: default;
  background: ${(props: any) => props.theme.color.backgroundVariant}55;
  border-radius: 7px 7px 0 0;
`;

const DragHandle = styled.span`
  cursor: grab;
  opacity: 0.35;
  font-size: 14px;
  line-height: 1;
  flex-shrink: 0;
  user-select: none;
  &:hover {
    opacity: 0.8;
  }
  &:active {
    cursor: grabbing;
  }
`;

const ActionTypeBadge = styled.span`
  font-size: 16px;
  text-transform: uppercase;
  background: ${(props: any) => props.theme.color.primaryContrast}11;
  color: ${(props: any) => props.theme.color.primaryContrast};
  padding: 2px 8px;
  border-radius: 4px;
  letter-spacing: 0.5px;
  font-weight: 600;
  flex-shrink: 0;
`;

const ActionSummary = styled.span`
  flex: 1;
  font-size: 13px;
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
  opacity: 0.45;
  font-size: 13px;
  line-height: 1;
  flex-shrink: 0;
  border-radius: 3px;
  transition: opacity 0.1s, background 0.1s;
  &:hover {
    opacity: 1;
    background: ${(props: any) => props.theme.color.gray}66;
  }
`;

const ActionBody = styled.div`
  padding: 10px 12px 12px 12px;
  border-top: 1px solid ${(props: any) => props.theme.color.gray};
  background: ${(props: any) => props.theme.color.backgroundVariant}33;
  border-radius: 0 0 7px 7px;

  h1 {
    color: ${(props: any) => props.theme.color.primary};
  }
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
  gap: 8px;
  padding: 5px 0;
  font-size: 13px;
  cursor: pointer;

  input[type='checkbox'] {
    width: 15px;
    height: 15px;
    flex-shrink: 0;
    accent-color: ${(props: any) => props.theme.color.primary};
    cursor: pointer;
  }
`;

const WsWarning = styled.p`
  font-size: 12px;
  margin: 4px 0;
  color: #e04040;
  opacity: 0.85;
`;

const ActionIndex = styled.span`
  font-size: 10px;
  font-weight: 700;
  opacity: 0.35;
  flex-shrink: 0;
  min-width: 14px;
  text-align: center;
`;

const NewActionLabel = styled.div`
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-top: 18px;
  margin-bottom: 6px;
  padding-top: 14px;
  border-top: 2px solid ${(props: any) => props.theme.color.gray};
`;

const VarHint = styled.p`
  font-size: 11px;
  opacity: 0.55;
  margin: 2px 0 4px 0;
  font-style: italic;
`;

const PromptModeRow = styled.div`
  display: flex;
  gap: 4px;
  margin-bottom: 6px;
`;

const PromptModeBtn = styled.button<{ active?: boolean }>`
  flex: 1;
  padding: 5px 8px;
  border-radius: 4px;
  border: 1px solid ${(props: any) => props.theme.color.gray};
  background: ${(props: any) => (props.active ? props.theme.color.primary : 'transparent')};
  color: ${(props: any) => (props.active ? '#fff' : 'inherit')};
  cursor: pointer;
  font-size: 12px;
  font-weight: ${(props: any) => (props.active ? 600 : 400)};
  &:hover:not(:disabled) { opacity: 0.85; }
`;

const StoreInSessionRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 12px;
  padding: 10px;
  border-radius: 6px;
  border: 1px solid ${(props: any) => props.theme.color.gray};
  background: ${(props: any) => props.theme.color.background};
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

const NewActionOptionList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-bottom: 2px;
`;

const NewActionOptionBtn = styled.button<{ active?: boolean; dimmed?: boolean; warn?: boolean }>`
  width: 100%;
  padding: 6px 10px;
  border-radius: 4px;
  border: ${(props: any) =>
    props.dimmed
      ? 'none'
      : props.active
        ? `1px solid ${props.warn ? '#e04040' : props.theme.color.primary}`
        : `1px solid ${props.warn ? '#e0404055' : props.theme.color.gray + '88'}`};
  background: ${(props: any) =>
    props.active
      ? props.dimmed ? '#888888' : props.warn ? '#e04040' : props.theme.color.primary
      : props.theme.color.background};
  color: ${(props: any) =>
    props.active ? '#fff' : props.dimmed ? '#888888' : props.warn ? '#e04040' : props.theme.color.primary};
  cursor: pointer;
  font-size: 12px;
  text-align: left;
  font-weight: ${(props: any) => (props.active ? 600 : 400)};
  transition: opacity 0.1s;
  &:hover {
    opacity: 0.85;
  }
`;

const AddActionButton = styled(Button)`
  && {
    background-color: #28a745;
    border-color: #28a745;
    color: #fff;
  }
  &&:hover {
    background-color: #218838;
    border-color: #1e7e34;
  }
`;

const ActionDesc = styled.p`
  font-size: 11px;
  opacity: 0.65;
  margin: 6px 0 4px 0;
  font-style: italic;
  line-height: 1.4;
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

const PLACEHOLDER_ACTIONS = new Set(['ws_file', 'ws_image', 'ws_dataframe', 'ws_plotly']);

// Maps of reply-type -> i18n key. Resolved via translate() at render time
// (module scope cannot access this.props.translate).
const ACTION_DESCRIPTION_KEYS: Record<string, string> = {
  text: 'packages.AgentDiagram.actionDesc.text',
  llm: 'packages.AgentDiagram.actionDesc.llm',
  llm_chat: 'packages.AgentDiagram.actionDesc.llmChat',
  rag: 'packages.AgentDiagram.actionDesc.rag',
  db_reply: 'packages.AgentDiagram.actionDesc.dbReply',
  web_crawl_llm: 'packages.AgentDiagram.actionDesc.webCrawlLlm',
  ws_markdown: 'packages.AgentDiagram.actionDesc.wsMarkdown',
  ws_html: 'packages.AgentDiagram.actionDesc.wsHtml',
  ws_speech: 'packages.AgentDiagram.actionDesc.wsSpeech',
  ws_options: 'packages.AgentDiagram.actionDesc.wsOptions',
  ws_location: 'packages.AgentDiagram.actionDesc.wsLocation',
  ws_file: 'packages.AgentDiagram.actionDesc.wsFile',
  ws_image: 'packages.AgentDiagram.actionDesc.wsImage',
  ws_dataframe: 'packages.AgentDiagram.actionDesc.wsDataframe',
  ws_plotly: 'packages.AgentDiagram.actionDesc.wsPlotly',
  gui_reply: 'packages.AgentDiagram.actionDesc.guiReply',
};

const PLACEHOLDER_WARNING_KEYS: Record<string, string> = {
  ws_file: 'packages.AgentDiagram.placeholderWarning.wsFile',
  ws_image: 'packages.AgentDiagram.placeholderWarning.wsImage',
  ws_dataframe: 'packages.AgentDiagram.placeholderWarning.wsDataframe',
  ws_plotly: 'packages.AgentDiagram.placeholderWarning.wsPlotly',
};

type ActionSection = 'simple' | 'ai' | 'data';

const SIMPLE_LEFT_COLUMN  = ['text', 'ws_speech', 'ws_options', 'gui_reply', 'ws_location', 'ws_html', 'ws_markdown'];
const SIMPLE_RIGHT_COLUMN = ['ws_file', 'ws_image', 'ws_dataframe', 'ws_plotly'];

const SECTION_ACTION_TYPES: Record<ActionSection, string[]> = {
  simple: [...SIMPLE_LEFT_COLUMN, ...SIMPLE_RIGHT_COLUMN],
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

type MemberSnapshot = {
  replyType: string;
  name: string;
  ragDatabaseName: string;
  prompt: string;
  dbSelectionType: string;
  dbCustomName: string;
  dbQueryMode: string;
  dbOperation: string;
  dbSqlQuery: string;
  llm_name: string;
  system_message: string;
  inputPromptMode: string;
  customInputPrompt: string;
  customInputPromptUseSessionVars: boolean;
  systemPromptUseSessionVars: boolean;
  promptUseSessionVars: boolean;
  storeInSession: string;
  useSessionVars: boolean;
  initial_url: string;
  max_depth: number;
  max_pages: number;
  crawl_format: string;
  base_url_prefix: string;
  run_crawl: boolean;
  no_crawl_error_message: string;
  system_message_prefix: string;
  systemMessagePrefixUseSessionVars: boolean;
  sendReply: boolean;
  ws_message: string;
  ws_audio_speed: number | null;
  ws_options: string;
  ws_latitude: number;
  ws_longitude: number;
  guiId: string;
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
  // Stashes for preserving content when toggling between predefined / custom body modes.
  bodyPredefinedStash: MemberSnapshot[] | null;
  fallbackPredefinedStash: MemberSnapshot[] | null;
  bodyCustomStash: string | null;
  fallbackCustomStash: string | null;
}

// Maps of reply-type -> i18n key for the short action-type labels. Resolved
// via translate() at render time (module scope cannot access this.props.translate).
const ACTION_TYPE_LABEL_KEYS: Record<string, string> = {
  text: 'packages.AgentDiagram.actionTypeLabel.text',
  llm: 'packages.AgentDiagram.actionTypeLabel.llm',
  llm_chat: 'packages.AgentDiagram.actionTypeLabel.llmChat',
  rag: 'packages.AgentDiagram.actionTypeLabel.rag',
  db_reply: 'packages.AgentDiagram.actionTypeLabel.dbReply',
  code: 'packages.AgentDiagram.actionTypeLabel.code',
  web_crawl_llm: 'packages.AgentDiagram.actionTypeLabel.webCrawlLlm',
  ws_markdown: 'packages.AgentDiagram.actionTypeLabel.wsMarkdown',
  ws_html: 'packages.AgentDiagram.actionTypeLabel.wsHtml',
  ws_speech: 'packages.AgentDiagram.actionTypeLabel.wsSpeech',
  ws_options: 'packages.AgentDiagram.actionTypeLabel.wsOptions',
  ws_location: 'packages.AgentDiagram.actionTypeLabel.wsLocation',
  ws_file: 'packages.AgentDiagram.actionTypeLabel.wsFile',
  ws_image: 'packages.AgentDiagram.actionTypeLabel.wsImage',
  ws_dataframe: 'packages.AgentDiagram.actionTypeLabel.wsDataframe',
  ws_plotly: 'packages.AgentDiagram.actionTypeLabel.wsPlotly',
  gui_reply: 'packages.AgentDiagram.actionTypeLabel.guiReply',
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
    bodyPredefinedStash: null,
    fallbackPredefinedStash: null,
    bodyCustomStash: null,
    fallbackCustomStash: null,
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

  // Resolve a reply-type's short label through i18n, falling back to the raw type.
  private actionTypeLabel = (replyType: string): string => {
    const key = ACTION_TYPE_LABEL_KEYS[replyType];
    return key ? this.props.translate(key) : replyType;
  };

  render() {
    const { element, getById, elements } = this.props;
    const children = element.ownedElements.map((id) => getById(id)).filter(notEmpty);
    const bodies = children.filter((c): c is AgentStateMember => c instanceof AgentStateBody);
    const fallbackBodies = children.filter((c): c is AgentStateMember => c instanceof AgentStateFallbackBody);

    const ragDatabaseNames = diagramBridge.getAgentRAGs()
      .map((r) => r.name)
      .filter((n) => n.length > 0);
    const llmEntries = diagramBridge.getAgentLLMs().filter((l) => l.name.length > 0);
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
                {this.props.translate('packages.AgentDiagram.noLlmDefinedInDiagram')}
              </WsWarning>
            )}
            {needsChatLlm && (
              <WsWarning>
                {this.props.translate('packages.AgentDiagram.noLlmDefinedChatComponents')}
              </WsWarning>
            )}
            {needsPlatform && (
              <WsWarning>
                {this.props.translate('packages.AgentDiagram.noWebSocketWarning')}
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
              if (bodyType !== 'predefined') this.switchBodyType('predefined', actions, Clazz, prefix);
            }}
          >
            {this.props.translate('packages.AgentDiagram.predefined')}
          </BodyTypeBtn>
          <BodyTypeBtn
            active={bodyType === 'custom'}
            onClick={() => {
              if (bodyType !== 'custom') this.switchBodyType('custom', actions, Clazz, prefix);
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
        <Button color="primary" onClick={() =>
          this.create(Clazz, 'code')('def body_name(session: Session):\n    pass\n')
        }>
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
    const wsTooltip = this.props.translate('packages.AgentDiagram.requiresWebSocketPlatform');
    const chatTooltip = this.props.translate('packages.AgentDiagram.requiresOpenaiHf');
    const wsColor = hasWebSocketPlatform ? undefined : '#e04040';
    const chatColor = hasCompatibleChatLlm ? undefined : '#e04040';

    return (
      <>
        {actions.length === 0 && (
          <p style={{ fontSize: 12, margin: '4px 0 8px', opacity: 0.6, fontStyle: 'italic' }}>
            {this.props.translate('packages.AgentDiagram.noActionsDefined')}
          </p>
        )}
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
                  title={this.props.translate('packages.AgentDiagram.draggToReorder')}
                  onMouseDown={() => this.setState({ dragArmedKey: cardKey })}
                  onMouseUp={() => this.setState({ dragArmedKey: null })}
                >
                  ⠿
                </DragHandle>
                <ActionTypeBadge style={badgeWarning ? { color: '#e04040', background: '#e0404022' } : undefined}>
                  {this.actionTypeLabel(action.replyType)}
                </ActionTypeBadge>

                <IconBtn
                  style={{ marginLeft: 'auto' }}
                  title={isExpanded ? this.props.translate('packages.AgentDiagram.collapse') : this.props.translate('packages.AgentDiagram.expand')}
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

        <NewActionLabel>{this.props.translate('packages.AgentDiagram.newActionLabel')}</NewActionLabel>
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
        {section === 'simple' ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px' }}>
            <NewActionOptionList>
              {SIMPLE_LEFT_COLUMN.map((type) => {
                const isWarn = WS_REPLY_TYPES.has(type) && !hasWebSocketPlatform;
                return (
                  <NewActionOptionBtn
                    key={type}
                    active={selectedActionType === type}
                    warn={isWarn}
                    onClick={() => setNewActionType(type)}
                  >
                    {this.actionTypeLabel(type)}
                  </NewActionOptionBtn>
                );
              })}
            </NewActionOptionList>
            <NewActionOptionList>
              {SIMPLE_RIGHT_COLUMN.map((type) => (
                <NewActionOptionBtn
                  key={type}
                  active={selectedActionType === type}
                  dimmed
                  onClick={() => setNewActionType(type)}
                >
                  {this.actionTypeLabel(type)}
                </NewActionOptionBtn>
              ))}
            </NewActionOptionList>
          </div>
        ) : (
          <NewActionOptionList>
            {sectionTypes.map((type) => {
              const isWarn = WS_REPLY_TYPES.has(type) && !hasWebSocketPlatform;
              const isChatWarn = type === 'llm_chat' && !hasCompatibleChatLlm;
              return (
                <NewActionOptionBtn
                  key={type}
                  active={selectedActionType === type}
                  warn={isWarn || isChatWarn}
                  onClick={() => setNewActionType(type)}
                >
                  {this.actionTypeLabel(type)}
                </NewActionOptionBtn>
              );
            })}
          </NewActionOptionList>
        )}
        {ACTION_DESCRIPTION_KEYS[selectedActionType] && (
          <ActionDesc>{this.props.translate(ACTION_DESCRIPTION_KEYS[selectedActionType])}</ActionDesc>
        )}
        {PLACEHOLDER_ACTIONS.has(selectedActionType) && PLACEHOLDER_WARNING_KEYS[selectedActionType] && (
          <WsWarning style={{ marginTop: 2, marginBottom: 4 }}>
            ⚠ {this.props.translate(PLACEHOLDER_WARNING_KEYS[selectedActionType])}
          </WsWarning>
        )}
        <div style={{ marginTop: 6 }}>
          <AddActionButton onClick={() => {
            const id = this.addPredefinedAction(Clazz, selectedActionType);
            if (id) {
              const key = prefix === 'body' ? 'collapsedBodyIds' : 'collapsedFallbackIds';
              if (this.state[key].has(id)) {
                const next = new Set(this.state[key]);
                next.delete(id);
                this.setState({ [key]: next } as any);
              }
            }
          }}>
            {`${this.props.translate('packages.AgentDiagram.addAction')} ${this.actionTypeLabel(selectedActionType)}`}
          </AddActionButton>
        </div>
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
          <>
            <Textfield
              outline
              value={action.name}
              onChange={(value) => this.props.update(action.id, { name: value })}
              placeholder={this.props.translate('packages.AgentDiagram.enterReplyMessage')}
            />
            <CheckboxRow style={{ marginTop: 4 }}>
              <input
                type="checkbox"
                checked={action.useSessionVars || false}
                onChange={(e) => this.props.update<AgentStateMember>(action.id, { useSessionVars: e.target.checked })}
              />
              {this.props.translate('packages.AgentDiagram.interpolateSessionVariables')}
            </CheckboxRow>
            {action.useSessionVars && (
              <VarHint>{this.props.translate('packages.AgentDiagram.useSessionValuesHint')}</VarHint>
            )}
          </>
        );
      case 'llm': {
        const llmInputMode = action.inputPromptMode || 'last_user_message';
        return (
          <>
            {llmNames.length === 0 && (
              <WsWarning style={{ marginBottom: 6 }}>
                {this.props.translate('packages.AgentDiagram.noLlmDefined')}
              </WsWarning>
            )}
            {this.renderLlmNameField(action, llmNames, `${fieldId}-llm`)}
            <CheckboxRow style={{ marginTop: 2 }}>
              <input
                type="checkbox"
                checked={action.systemPromptUseSessionVars || false}
                onChange={(e) => this.props.update<AgentStateMember>(action.id, { systemPromptUseSessionVars: e.target.checked })}
              />
              {this.props.translate('packages.AgentDiagram.interpolateVarsSystemMessage')}
            </CheckboxRow>
            <LlmFieldRow style={{ marginTop: 8 }}>
              <Header>{this.props.translate('packages.AgentDiagram.inputSentToLlm')}</Header>
              <PromptModeRow>
                <PromptModeBtn
                  active={llmInputMode === 'last_user_message'}
                  onClick={() => this.props.update<AgentStateMember>(action.id, { inputPromptMode: 'last_user_message', customInputPrompt: '' })}
                >
                  {this.props.translate('packages.AgentDiagram.lastUserMessage')}
                </PromptModeBtn>
                <PromptModeBtn
                  active={llmInputMode === 'custom'}
                  onClick={() => this.props.update<AgentStateMember>(action.id, { inputPromptMode: 'custom' })}
                >
                  {this.props.translate('packages.AgentDiagram.customPrompt')}
                </PromptModeBtn>
              </PromptModeRow>
              {llmInputMode === 'custom' && (
                <>
                  <Textfield
                    outline
                    multiline
                    enterToSubmit={false}
                    value={action.customInputPrompt || ''}
                    onChange={(value) => this.props.update<AgentStateMember>(action.id, { customInputPrompt: value })}
                    placeholder={this.props.translate('packages.AgentDiagram.customPromptExample')}
                  />
                  <VarHint>{this.props.translate('packages.AgentDiagram.useUserMessageAndSessionHint')}</VarHint>
                  <CheckboxRow>
                    <input
                      type="checkbox"
                      checked={action.customInputPromptUseSessionVars || false}
                      onChange={(e) => this.props.update<AgentStateMember>(action.id, { customInputPromptUseSessionVars: e.target.checked })}
                    />
                    {this.props.translate('packages.AgentDiagram.replaceVarsAtRuntime')}
                  </CheckboxRow>
                </>
              )}
            </LlmFieldRow>
            {this.renderStoreInSession(action)}
            {this.renderSendReply(action)}
          </>
        );
      }
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
            <CheckboxRow style={{ marginTop: 2 }}>
              <input
                type="checkbox"
                checked={action.systemPromptUseSessionVars || false}
                onChange={(e) => this.props.update<AgentStateMember>(action.id, { systemPromptUseSessionVars: e.target.checked })}
              />
              {this.props.translate('packages.AgentDiagram.interpolateVarsSystemMessage')}
            </CheckboxRow>
            {this.renderStoreInSession(action)}
            {this.renderSendReply(action)}
          </>
        );
      }
      case 'rag': {
        const ragInputMode = action.inputPromptMode || 'last_user_message';
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
                  value={action.ragDatabaseName && action.ragDatabaseName.length > 0 ? action.ragDatabaseName : '__placeholder__'}
                  onChange={(value) => {
                    const selected = value === '__placeholder__' ? '' : value;
                    this.props.update<AgentStateMember>(action.id, {
                      ragDatabaseName: selected,
                      name: this.getRagDisplayName(selected),
                    });
                  }}
                >
                  {[
                    <Dropdown.Item value="__placeholder__" key="rag-placeholder">{this.props.translate('packages.AgentDiagram.selectRagDatabase')}</Dropdown.Item>,
                    ...ragDatabaseNames.map((name, i) => (
                      <Dropdown.Item key={`rag-${i}-${name}`} value={name}>{name}</Dropdown.Item>
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
                <CheckboxRow style={{ marginTop: 2 }}>
                  <input
                    type="checkbox"
                    checked={action.promptUseSessionVars || false}
                    onChange={(e) => this.props.update<AgentStateMember>(action.id, { promptUseSessionVars: e.target.checked })}
                  />
                  {this.props.translate('packages.AgentDiagram.interpolateVarsInPrompt')}
                </CheckboxRow>
              </LlmFieldRow>
            ) : (
              <p style={{ fontSize: 12, margin: '4px 0', opacity: 0.7 }}>
                {this.props.translate('packages.AgentDiagram.noRagDatabases')}
              </p>
            )}
            <LlmFieldRow style={{ marginTop: 8 }}>
              <Header>{this.props.translate('packages.AgentDiagram.inputSentToRag')}</Header>
              <PromptModeRow>
                <PromptModeBtn
                  active={ragInputMode === 'last_user_message'}
                  onClick={() => this.props.update<AgentStateMember>(action.id, { inputPromptMode: 'last_user_message', customInputPrompt: '' })}
                >
                  {this.props.translate('packages.AgentDiagram.lastUserMessage')}
                </PromptModeBtn>
                <PromptModeBtn
                  active={ragInputMode === 'custom'}
                  onClick={() => this.props.update<AgentStateMember>(action.id, { inputPromptMode: 'custom' })}
                >
                  {this.props.translate('packages.AgentDiagram.customPrompt')}
                </PromptModeBtn>
              </PromptModeRow>
              {ragInputMode === 'custom' && (
                <>
                  <Textfield
                    outline
                    multiline
                    enterToSubmit={false}
                    value={action.customInputPrompt || ''}
                    onChange={(value) => this.props.update<AgentStateMember>(action.id, { customInputPrompt: value })}
                    placeholder={this.props.translate('packages.AgentDiagram.customPromptExample')}
                  />
                  <VarHint>{this.props.translate('packages.AgentDiagram.useUserMessageAndSessionHint')}</VarHint>
                  <CheckboxRow>
                    <input
                      type="checkbox"
                      checked={action.customInputPromptUseSessionVars || false}
                      onChange={(e) => this.props.update<AgentStateMember>(action.id, { customInputPromptUseSessionVars: e.target.checked })}
                    />
                    {this.props.translate('packages.AgentDiagram.replaceVarsAtRuntime')}
                  </CheckboxRow>
                </>
              )}
            </LlmFieldRow>
            {this.renderStoreInSession(action)}
            {this.renderSendReply(action)}
          </>
        );
      }
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
      case 'gui_reply': {
        const guiList: AgentGUIInfo[] = diagramBridge.getAgentGUIs();
        return (
          <LlmFieldRow>
            <Header>{this.props.translate('packages.AgentDiagram.guiHeader')}</Header>
            {guiList.length === 0 ? (
              <p style={{ fontSize: 12, margin: '4px 0', opacity: 0.7 }}>
                {this.props.translate('packages.AgentDiagram.noGuisDefinedAction')}
              </p>
            ) : (
              <Dropdown
                value={(action as any).guiId && (action as any).guiId.length > 0
                  ? (action as any).guiId
                  : '__placeholder__'}
                onChange={(value) => {
                  const selected = value === '__placeholder__' ? '' : value;
                  const selectedGui = guiList.find(g => g.gui_id === selected);
                  this.props.update<AgentStateMember>(action.id, {
                    guiId: selected,
                    name: selectedGui
                      ? `${this.props.translate('packages.AgentDiagram.guiReplyPrefix')} ${selectedGui.name}`
                      : this.props.translate('packages.AgentDiagram.guiReplySelectGui'),
                  } as any);
                }}
              >
                {[
                  <Dropdown.Item value="__placeholder__" key="gui-placeholder">{this.props.translate('packages.AgentDiagram.selectGui')}</Dropdown.Item>,
                  ...guiList.map((g, i) => (
                    <Dropdown.Item key={`gui-${i}`} value={g.gui_id}>{g.name}</Dropdown.Item>
                  )),
                ]}
              </Dropdown>
            )}
          </LlmFieldRow>
        );
      }
      default:
        return null;
    }
  };

  // ─── Summary text for collapsed action cards ─────────────────────────────────

  private getActionSummary = (action: AgentStateMember): string => {
    const name = action.name || '';
    const truncate = (s: string, n = 40) => (s.length > n ? s.slice(0, n) + '…' : s);
    const t = this.props.translate;
    switch (action.replyType) {
      case 'llm':
        return action.llm_name ? `LLM: ${action.llm_name}` : t('packages.AgentDiagram.summaryDefaultLlm');
      case 'llm_chat':
        return action.llm_name ? `Chat: ${action.llm_name}` : t('packages.AgentDiagram.summaryDefaultLlmChat');
      case 'rag':
        return action.ragDatabaseName
          ? `DB: ${action.ragDatabaseName}${action.prompt ? ' (prompt)' : ''}`
          : t('packages.AgentDiagram.summarySelectDatabase');
      case 'web_crawl_llm':
        return action.initial_url
          ? `Crawl: ${truncate(action.initial_url, 30)}${action.run_crawl ? '' : ' ' + t('packages.AgentDiagram.summaryNoCrawl')}`
          : t('packages.AgentDiagram.summarySetUrl');
      case 'ws_markdown':
      case 'ws_html':
        return action.ws_message ? truncate(action.ws_message) : t('packages.AgentDiagram.summaryNoMessage');
      case 'ws_speech':
        return action.ws_message ? truncate(action.ws_message) : t('packages.AgentDiagram.summaryNoMessage');
      case 'ws_options': {
        const opts = (action.ws_options || '').split('\n').filter(Boolean);
        return opts.length ? `${opts.length} ${t('packages.AgentDiagram.optionItems')}` : t('packages.AgentDiagram.noOptions2');
      }
      case 'ws_location':
        return `(${action.ws_latitude ?? 0}, ${action.ws_longitude ?? 0})`;
      case 'ws_file':
        return t('packages.AgentDiagram.summaryPlaceholderFile');
      case 'ws_image':
        return t('packages.AgentDiagram.summaryPlaceholderImage');
      case 'ws_dataframe':
        return t('packages.AgentDiagram.summaryPlaceholderDataframe');
      case 'ws_plotly':
        return t('packages.AgentDiagram.summaryPlaceholderPlot');
      default:
        return truncate(name);
    }
  };

  // ─── Body type switch ─────────────────────────────────────────────────────────

  private snapshotMember = (a: AgentStateMember): MemberSnapshot => ({
    replyType: a.replyType,
    name: a.name,
    ragDatabaseName: a.ragDatabaseName,
    prompt: a.prompt,
    dbSelectionType: a.dbSelectionType,
    dbCustomName: a.dbCustomName,
    dbQueryMode: a.dbQueryMode,
    dbOperation: a.dbOperation,
    dbSqlQuery: a.dbSqlQuery,
    llm_name: a.llm_name,
    system_message: a.system_message,
    inputPromptMode: a.inputPromptMode,
    customInputPrompt: a.customInputPrompt,
    customInputPromptUseSessionVars: a.customInputPromptUseSessionVars,
    systemPromptUseSessionVars: a.systemPromptUseSessionVars,
    promptUseSessionVars: a.promptUseSessionVars,
    storeInSession: a.storeInSession,
    useSessionVars: a.useSessionVars,
    initial_url: a.initial_url,
    max_depth: a.max_depth,
    max_pages: a.max_pages,
    crawl_format: a.crawl_format,
    base_url_prefix: a.base_url_prefix,
    run_crawl: a.run_crawl,
    no_crawl_error_message: a.no_crawl_error_message,
    system_message_prefix: a.system_message_prefix,
    systemMessagePrefixUseSessionVars: a.systemMessagePrefixUseSessionVars,
    sendReply: a.sendReply,
    ws_message: a.ws_message,
    ws_audio_speed: a.ws_audio_speed,
    ws_options: a.ws_options,
    ws_latitude: a.ws_latitude,
    ws_longitude: a.ws_longitude,
    guiId: a.guiId,
  });

  private restoreMember = (
    Clazz: typeof AgentStateBody | typeof AgentStateFallbackBody,
    snap: MemberSnapshot,
  ) => {
    const { replyType, name, ...rest } = snap;
    this.create(Clazz, replyType, rest)(name);
  };

  private switchBodyType = (
    type: 'predefined' | 'custom',
    actions: AgentStateMember[],
    Clazz: typeof AgentStateBody | typeof AgentStateFallbackBody,
    prefix: 'body' | 'fallback',
  ) => {
    const stashKeyPred = prefix === 'body' ? 'bodyPredefinedStash' : 'fallbackPredefinedStash';
    const stashKeyCustom = prefix === 'body' ? 'bodyCustomStash' : 'fallbackCustomStash';

    if (type === 'custom') {
      const predStash = actions.map((a) => this.snapshotMember(a));
      const savedCode = this.state[stashKeyCustom];
      this.setState({ [stashKeyPred]: predStash } as any);
      actions.forEach((a) => this.delete(a.id)());
      this.create(Clazz, 'code')(savedCode ?? 'def body_name(session: Session):\n    pass\n');
    } else {
      const codeAction = actions.find((a) => a.replyType === 'code');
      const savedStash = this.state[stashKeyPred];
      this.setState({ [stashKeyCustom]: codeAction?.name ?? null } as any);
      actions.forEach((a) => this.delete(a.id)());
      if (savedStash && savedStash.length > 0) {
        savedStash.forEach((snap) => this.restoreMember(Clazz, snap));
      }
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
        member.name = this.props.translate('packages.AgentDiagram.enterReplyMessage');
        break;
      case 'llm':
        member.name = this.props.translate('packages.AgentDiagram.llmReplyDefault');
        break;
      case 'llm_chat':
        member.name = this.props.translate('packages.AgentDiagram.llmChatReplyDefault');
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
        member.no_crawl_error_message = this.props.translate('packages.AgentDiagram.noCrawlDataDefault');
        member.system_message_prefix = '';
        member.name = this.props.translate('packages.AgentDiagram.webCrawlLlmSetUrl');
        break;
      case 'ws_markdown':
        member.ws_message = '';
        member.name = this.props.translate('packages.AgentDiagram.markdownEmpty');
        break;
      case 'ws_html':
        member.ws_message = '';
        member.name = this.props.translate('packages.AgentDiagram.htmlEmpty');
        break;
      case 'ws_speech':
        member.ws_message = '';
        member.ws_audio_speed = null;
        member.name = this.props.translate('packages.AgentDiagram.speechEmpty');
        break;
      case 'ws_options':
        member.ws_options = '';
        member.name = this.props.translate('packages.AgentDiagram.optionsNoOptions');
        break;
      case 'ws_location':
        member.ws_latitude = 0;
        member.ws_longitude = 0;
        member.name = this.props.translate('packages.AgentDiagram.locationDefault');
        break;
      case 'ws_file':
        member.name = this.props.translate('packages.AgentDiagram.filePlaceholderName');
        break;
      case 'ws_image':
        member.name = this.props.translate('packages.AgentDiagram.imagePlaceholderName');
        break;
      case 'ws_dataframe':
        member.name = this.props.translate('packages.AgentDiagram.dataframePlaceholderName');
        break;
      case 'ws_plotly':
        member.name = this.props.translate('packages.AgentDiagram.plotlyPlaceholderName');
        break;
      case 'gui_reply':
        (member as any).guiId = '';
        member.name = this.props.translate('packages.AgentDiagram.guiReplySelectGui');
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
      guiId: m.guiId,
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
                  name: v
                    ? v.slice(0, 40)
                    : action.replyType === 'ws_markdown'
                      ? this.props.translate('packages.AgentDiagram.markdownEmpty')
                      : this.props.translate('packages.AgentDiagram.htmlEmpty'),
                })
              }
              placeholder={action.replyType === 'ws_markdown'
                ? this.props.translate('packages.AgentDiagram.markdownPlaceholder')
                : this.props.translate('packages.AgentDiagram.htmlPlaceholder')}
            />
            <CheckboxRow style={{ marginTop: 4 }}>
              <input
                type="checkbox"
                checked={action.useSessionVars || false}
                onChange={(e) => this.props.update<AgentStateMember>(action.id, { useSessionVars: e.target.checked })}
              />
              {this.props.translate('packages.AgentDiagram.interpolateVarsInMessage')}
            </CheckboxRow>
            {action.useSessionVars && (
              <VarHint>{this.props.translate('packages.AgentDiagram.useSessionValuesHint')}</VarHint>
            )}
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
              placeholder={this.props.translate('packages.AgentDiagram.speechPlaceholder')}
            />
            <CheckboxRow style={{ marginTop: 4 }}>
              <input
                type="checkbox"
                checked={action.useSessionVars || false}
                onChange={(e) => this.props.update<AgentStateMember>(action.id, { useSessionVars: e.target.checked })}
              />
              {this.props.translate('packages.AgentDiagram.interpolateVarsInMessage')}
            </CheckboxRow>
            {action.useSessionVars && (
              <VarHint>{this.props.translate('packages.AgentDiagram.useSessionValuesHint')}</VarHint>
            )}
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
                  name: count > 0
                    ? `${this.props.translate('packages.AgentDiagram.optionsItemsCountPrefix')} ${count} ${this.props.translate('packages.AgentDiagram.optionItems')}`
                    : this.props.translate('packages.AgentDiagram.optionsNoOptions'),
                });
              }}
              placeholder={this.props.translate('packages.AgentDiagram.optionsPlaceholder')}
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
          <WsWarning>{this.props.translate('packages.AgentDiagram.placeholderWarning.wsFile')}</WsWarning>
        );
        break;
      case 'ws_image':
        content = (
          <WsWarning>{this.props.translate('packages.AgentDiagram.placeholderWarning.wsImage')}</WsWarning>
        );
        break;
      case 'ws_dataframe':
        content = (
          <WsWarning>{this.props.translate('packages.AgentDiagram.placeholderWarning.wsDataframe')}</WsWarning>
        );
        break;
      case 'ws_plotly':
        content = (
          <WsWarning>{this.props.translate('packages.AgentDiagram.placeholderWarning.wsPlotly')}</WsWarning>
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

  private renderStoreInSession = (action: AgentStateMember): React.ReactNode => (
    <StoreInSessionRow>
      <Header>{this.props.translate('packages.AgentDiagram.storeResultInSession')}</Header>
      <Textfield
        outline
        value={action.storeInSession || ''}
        onChange={(value) => this.props.update<AgentStateMember>(action.id, { storeInSession: value.trim() })}
        placeholder={this.props.translate('packages.AgentDiagram.sessionKeyPlaceholder')}
      />
      {action.storeInSession && (
        <VarHint>
          {`${this.props.translate('packages.AgentDiagram.resultStoredHintPrefix')} {${action.storeInSession}} ${this.props.translate('packages.AgentDiagram.resultStoredHintSuffix')}`}
        </VarHint>
      )}
    </StoreInSessionRow>
  );

  private renderSendReply = (action: AgentStateMember): React.ReactNode => (
    <CheckboxRow style={{ marginTop: 6 }}>
      <input
        type="checkbox"
        checked={action.sendReply !== false}
        onChange={(e) => this.props.update<AgentStateMember>(action.id, { sendReply: e.target.checked })}
      />
      {this.props.translate('packages.AgentDiagram.sendAsAgentReply')}
    </CheckboxRow>
  );

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
              placeholder={this.props.translate('packages.AgentDiagram.sqlQueryPlaceholder')}
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
              <LlmFieldRow style={{ marginTop: 6 }}>
                <Header>{this.props.translate('packages.AgentDiagram.inputSentToDbLlm')}</Header>
                <PromptModeRow>
                  <PromptModeBtn
                    active={(member.inputPromptMode || 'last_user_message') === 'last_user_message'}
                    onClick={() => this.props.update<AgentStateMember>(member.id, { inputPromptMode: 'last_user_message', customInputPrompt: '' })}
                  >
                    {this.props.translate('packages.AgentDiagram.lastUserMessage')}
                  </PromptModeBtn>
                  <PromptModeBtn
                    active={(member.inputPromptMode || 'last_user_message') === 'custom'}
                    onClick={() => this.props.update<AgentStateMember>(member.id, { inputPromptMode: 'custom' })}
                  >
                    {this.props.translate('packages.AgentDiagram.customPrompt')}
                  </PromptModeBtn>
                </PromptModeRow>
                {(member.inputPromptMode || 'last_user_message') === 'custom' && (
                  <>
                    <Textfield
                      outline
                      multiline
                      enterToSubmit={false}
                      value={member.customInputPrompt || ''}
                      onChange={(value) => this.props.update<AgentStateMember>(member.id, { customInputPrompt: value })}
                      placeholder={this.props.translate('packages.AgentDiagram.dbCustomPromptExample')}
                    />
                    <VarHint>{this.props.translate('packages.AgentDiagram.useUserMessageAndSessionHint')}</VarHint>
                    <CheckboxRow>
                      <input
                        type="checkbox"
                        checked={member.customInputPromptUseSessionVars || false}
                        onChange={(e) => this.props.update<AgentStateMember>(member.id, { customInputPromptUseSessionVars: e.target.checked })}
                      />
                      {this.props.translate('packages.AgentDiagram.replaceVarsAtRuntime')}
                    </CheckboxRow>
                  </>
                )}
              </LlmFieldRow>
            </>
          )}
        </DbFieldRow>
        {this.renderStoreInSession(member)}
        {this.renderSendReply(member)}
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
              name: value ? `Crawl: ${value.slice(0, 40)}` : this.props.translate('packages.AgentDiagram.webCrawlLlmSetUrl'),
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
        {member.system_message_prefix && (
          <>
            <CheckboxRow>
              <input
                type="checkbox"
                checked={member.systemMessagePrefixUseSessionVars || false}
                onChange={(e) => this.props.update<AgentStateMember>(member.id, { systemMessagePrefixUseSessionVars: e.target.checked })}
              />
              {this.props.translate('packages.AgentDiagram.interpolateVarsSystemMessagePrefix')}
            </CheckboxRow>
            {member.systemMessagePrefixUseSessionVars && (
              <VarHint>{this.props.translate('packages.AgentDiagram.useSessionValuesHint')}</VarHint>
            )}
          </>
        )}
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
        {this.renderStoreInSession(member)}
        {this.renderSendReply(member)}
      </LlmFieldRow>
    );
  };

  // ─── Utility helpers ──────────────────────────────────────────────────────────

  private getRagDisplayName = (databaseName: string): string => {
    const trimmed = (databaseName || '').trim();
    return trimmed.length
      ? `${this.props.translate('packages.AgentDiagram.ragReplyUsingPrefix')} ${trimmed} ${this.props.translate('packages.AgentDiagram.ragReplyUsingSuffix')}`
      : this.props.translate('packages.AgentDiagram.ragReplySelectDatabase');
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
      dbSelectionType === 'custom'
        ? (customDb.length ? customDb : this.props.translate('packages.AgentDiagram.customDatabase'))
        : this.props.translate('packages.AgentDiagram.defaultDatabase');
    const modeLabel = dbQueryMode === 'sql'
      ? this.props.translate('packages.AgentDiagram.sqlMode')
      : this.props.translate('packages.AgentDiagram.llmQueryMode');
    const opLabel = dbOperation === 'any' ? this.props.translate('packages.AgentDiagram.any') : dbOperation.toUpperCase();
    return `${this.props.translate('packages.AgentDiagram.dbActionUsingPrefix')} ${dbLabel} (${modeLabel}, ${opLabel})`;
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
