import React, { Component, ComponentClass } from 'react';
import { connect } from 'react-redux';
import { compose } from 'redux';
import { Button } from '../../../components/controls/button/button';
import { ColorButton } from '../../../components/controls/color-button/color-button';
import { Divider } from '../../../components/controls/divider/divider';
import { TrashIcon } from '../../../components/controls/icon/trash';
import { Textfield } from '../../../components/controls/textfield/textfield';
import { I18nContext } from '../../../components/i18n/i18n-context';
import { localized } from '../../../components/i18n/localized';
import { ModelState } from '../../../components/store/model-state';
import { StylePane } from '../../../components/style-pane/style-pane';
import { UMLElement } from '../../../services/uml-element/uml-element';
import { UMLElementRepository } from '../../../services/uml-element/uml-element-repository';
import { AsyncDispatch } from '../../../utils/actions/actions';
import { notEmpty } from '../../../utils/not-empty';
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
import { ActionEditorContext } from './agent-state-action-fields';
import { renderActionEditor } from './agent-state-action-editor';
import { renderNewActionPicker } from './agent-state-new-action-picker';
import { renderReasoningConfig } from './agent-state-reasoning-config';
import {
  ACTION_TYPE_LABEL_KEYS,
  ActionSection,
  AgentStateMemberClass,
  DEFAULT_PYTHON_BODY,
  getDbDisplayName,
  getDefaultDbReplyValues,
  getRagDisplayName,
  isChatCompatibleProvider,
  MemberSnapshot,
  SECTION_ACTION_TYPES,
  snapshotMember,
  WS_REPLY_TYPES,
} from './agent-state-update-constants';
import {
  ActionBody,
  ActionCard,
  ActionCardHeader,
  ActionTypeBadge,
  BodyTypeBtn,
  BodyTypeRow,
  DragHandle,
  Flex,
  IconBtn,
  ResizableCodeMirrorWrapper,
  Section,
  SectionHeader,
  ToggleLabel,
  WsWarning,
} from './agent-state-update-styles';

// Property panel of an agent state. The per-action editors, the "new action" picker, the
// reasoning settings, the styled components and the static tables live in sibling
// agent-state-*.ts(x) modules; this file keeps the stateful parts (body lists, drag & drop
// reordering, predefined/custom switching, action creation).

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

  private get ctx(): ActionEditorContext {
    return { translate: this.props.translate, update: this.props.update };
  }
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
    const hasCompatibleChatLlm = llmEntries.some((entry) => isChatCompatibleProvider(entry.provider));

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
        {stateType === 'reasoning' && renderReasoningConfig(this.ctx, element, llmNames)}

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

  // ─── Body section (predefined / custom toggle + action list) ─────────────────

  private renderBodySection = (
    actions: AgentStateMember[],
    Clazz: AgentStateMemberClass,
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
    Clazz: AgentStateMemberClass,
  ) => {
    const codeAction = actions.find((a) => a.replyType === 'code');
    if (!codeAction) {
      return (
        <Button color="primary" onClick={() =>
          this.create(Clazz, 'code')(DEFAULT_PYTHON_BODY)
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
    Clazz: AgentStateMemberClass,
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
                  {renderActionEditor(this.ctx, action, {
                    ragDatabaseNames,
                    llmNames,
                    llmProviderByName,
                    fieldId: `${prefix}-${index}`,
                    hasWebSocketPlatform,
                    hasCompatibleChatLlm,
                    onInitializeDb: () => this.createDefaultDbAction(Clazz),
                  })}
                </ActionBody>
              )}
            </ActionCard>
          );
        })}

        {renderNewActionPicker({
          translate: this.props.translate,
          actionTypeLabel: this.actionTypeLabel,
          section,
          setSection,
          sectionTypes,
          selectedActionType,
          setNewActionType,
          hasWebSocketPlatform,
          hasCompatibleChatLlm,
          onAdd: () => {
            const id = this.addPredefinedAction(Clazz, selectedActionType);
            if (id) {
              const key = prefix === 'body' ? 'collapsedBodyIds' : 'collapsedFallbackIds';
              if (this.state[key].has(id)) {
                const next = new Set(this.state[key]);
                next.delete(id);
                this.setState({ [key]: next } as any);
              }
            }
          },
        })}
      </>
    );
  };


  // ─── Body type switch ─────────────────────────────────────────────────────────


  private restoreMember = (
    Clazz: AgentStateMemberClass,
    snap: MemberSnapshot,
  ) => {
    const { replyType, name, ...rest } = snap;
    this.create(Clazz, replyType, rest)(name);
  };

  private switchBodyType = (
    type: 'predefined' | 'custom',
    actions: AgentStateMember[],
    Clazz: AgentStateMemberClass,
    prefix: 'body' | 'fallback',
  ) => {
    const stashKeyPred = prefix === 'body' ? 'bodyPredefinedStash' : 'fallbackPredefinedStash';
    const stashKeyCustom = prefix === 'body' ? 'bodyCustomStash' : 'fallbackCustomStash';

    if (type === 'custom') {
      const predStash = actions.map((a) => snapshotMember(a));
      const savedCode = this.state[stashKeyCustom];
      this.setState({ [stashKeyPred]: predStash } as any);
      actions.forEach((a) => this.delete(a.id)());
      this.create(Clazz, 'code')(savedCode ?? DEFAULT_PYTHON_BODY);
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
    Clazz: AgentStateMemberClass,
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
        member.name = getRagDisplayName(this.props.translate, '');
        break;
      }
      case 'db_reply': {
        const defaults = getDefaultDbReplyValues();
        Object.assign(member, defaults);
        member.name = getDbDisplayName(
          this.props.translate,
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

  private createDefaultDbAction = (Clazz: AgentStateMemberClass) => {
    const defaults = getDefaultDbReplyValues();
    this.create(
      Clazz,
      'db_reply',
      defaults,
    )(
      getDbDisplayName(
        this.props.translate,
        defaults.dbSelectionType,
        defaults.dbCustomName,
        defaults.dbQueryMode,
        defaults.dbOperation,
      ),
    );
  };

  private create =
    (
      Clazz: AgentStateMemberClass,
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