// Inline editor of one action of an agent state body, dispatching on the action's reply type.
import React from 'react';
import { Dropdown } from '../../../components/controls/dropdown/dropdown';
import { Textfield } from '../../../components/controls/textfield/textfield';
import { Header } from '../../../components/controls/typography/typography';
import { AgentGUIInfo, diagramBridge } from '../../../services/diagram-bridge';
import {
  ActionEditorContext,
  renderLlmNameField,
  renderSendReply,
  renderStoreInSession,
} from './agent-state-action-fields';
import { renderDbReplyEditor } from './agent-state-db-reply-editor';
import { AgentStateMember } from './agent-state-member';
import { getRagDisplayName, isChatCompatibleProvider } from './agent-state-update-constants';
import { CheckboxRow, LlmFieldRow, PromptModeBtn, PromptModeRow, VarHint, WsWarning } from './agent-state-update-styles';
import { renderWebCrawlLlmEditor } from './agent-state-web-crawl-editor';
import { renderWebSocketReplyEditor } from './agent-state-ws-reply-editor';

export interface ActionEditorOptions {
  ragDatabaseNames: string[];
  llmNames: string[];
  llmProviderByName: Record<string, string>;
  fieldId: string;
  hasWebSocketPlatform: boolean;
  hasCompatibleChatLlm: boolean;
  /** Creates a database action with default values (used by the uninitialized DB editor). */
  onInitializeDb: () => void;
}

export const renderActionEditor = (
  ctx: ActionEditorContext,
  action: AgentStateMember,
  {
    ragDatabaseNames,
    llmNames,
    llmProviderByName,
    fieldId,
    hasWebSocketPlatform,
    hasCompatibleChatLlm,
    onInitializeDb,
  }: ActionEditorOptions,
): React.ReactNode => {
  const { translate, update } = ctx;
  switch (action.replyType) {
    case 'text':
      return (
        <>
          <Textfield
            outline
            value={action.name}
            onChange={(value) => update(action.id, { name: value })}
            placeholder={translate('packages.AgentDiagram.enterReplyMessage')}
          />
          <CheckboxRow style={{ marginTop: 4 }}>
            <input
              type="checkbox"
              checked={action.useSessionVars || false}
              onChange={(e) => update<AgentStateMember>(action.id, { useSessionVars: e.target.checked })}
            />
            {translate('packages.AgentDiagram.interpolateSessionVariables')}
          </CheckboxRow>
          {action.useSessionVars && (
            <VarHint>{translate('packages.AgentDiagram.useSessionValuesHint')}</VarHint>
          )}
        </>
      );
    case 'llm': {
      const llmInputMode = action.inputPromptMode || 'last_user_message';
      return (
        <>
          {llmNames.length === 0 && (
            <WsWarning style={{ marginBottom: 6 }}>
              {translate('packages.AgentDiagram.noLlmDefined')}
            </WsWarning>
          )}
          {renderLlmNameField(ctx, action, llmNames, `${fieldId}-llm`)}
          <CheckboxRow style={{ marginTop: 2 }}>
            <input
              type="checkbox"
              checked={action.systemPromptUseSessionVars || false}
              onChange={(e) => update<AgentStateMember>(action.id, { systemPromptUseSessionVars: e.target.checked })}
            />
            {translate('packages.AgentDiagram.interpolateVarsSystemMessage')}
          </CheckboxRow>
          <LlmFieldRow style={{ marginTop: 8 }}>
            <Header>{translate('packages.AgentDiagram.inputSentToLlm')}</Header>
            <PromptModeRow>
              <PromptModeBtn
                active={llmInputMode === 'last_user_message'}
                onClick={() => update<AgentStateMember>(action.id, { inputPromptMode: 'last_user_message', customInputPrompt: '' })}
              >
                {translate('packages.AgentDiagram.lastUserMessage')}
              </PromptModeBtn>
              <PromptModeBtn
                active={llmInputMode === 'custom'}
                onClick={() => update<AgentStateMember>(action.id, { inputPromptMode: 'custom' })}
              >
                {translate('packages.AgentDiagram.customPrompt')}
              </PromptModeBtn>
            </PromptModeRow>
            {llmInputMode === 'custom' && (
              <>
                <Textfield
                  outline
                  multiline
                  enterToSubmit={false}
                  value={action.customInputPrompt || ''}
                  onChange={(value) => update<AgentStateMember>(action.id, { customInputPrompt: value })}
                  placeholder={translate('packages.AgentDiagram.customPromptExample')}
                />
                <VarHint>{translate('packages.AgentDiagram.useUserMessageAndSessionHint')}</VarHint>
                <CheckboxRow>
                  <input
                    type="checkbox"
                    checked={action.customInputPromptUseSessionVars || false}
                    onChange={(e) => update<AgentStateMember>(action.id, { customInputPromptUseSessionVars: e.target.checked })}
                  />
                  {translate('packages.AgentDiagram.replaceVarsAtRuntime')}
                </CheckboxRow>
              </>
            )}
          </LlmFieldRow>
          {renderStoreInSession(ctx, action)}
          {renderSendReply(ctx, action)}
        </>
      );
    }
    case 'llm_chat': {
      const selectedProvider = action.llm_name ? llmProviderByName[action.llm_name] : '';
      const hasIncompatibleSelection = Boolean(
        action.llm_name && selectedProvider && !isChatCompatibleProvider(selectedProvider),
      );
      return (
        <>
          {!hasCompatibleChatLlm && (
            <WsWarning style={{ marginBottom: 6 }}>
              {translate('packages.AgentDiagram.noLlmDefinedChat')}
            </WsWarning>
          )}
          {renderLlmNameField(ctx, action, llmNames, `${fieldId}-llm-chat`, {
            warning: hasIncompatibleSelection
              ? translate('packages.AgentDiagram.warningIncompatibleProvider')
              : undefined,
          })}
          <CheckboxRow style={{ marginTop: 2 }}>
            <input
              type="checkbox"
              checked={action.systemPromptUseSessionVars || false}
              onChange={(e) => update<AgentStateMember>(action.id, { systemPromptUseSessionVars: e.target.checked })}
            />
            {translate('packages.AgentDiagram.interpolateVarsSystemMessage')}
          </CheckboxRow>
          {renderStoreInSession(ctx, action)}
          {renderSendReply(ctx, action)}
        </>
      );
    }
    case 'rag': {
      const ragInputMode = action.inputPromptMode || 'last_user_message';
      return (
        <>
          {llmNames.length === 0 && (
            <WsWarning style={{ marginBottom: 6 }}>
              {translate('packages.AgentDiagram.noLlmDefinedRag')}
            </WsWarning>
          )}
          {ragDatabaseNames.length ? (
            <LlmFieldRow>
              <Header>{translate('packages.AgentDiagram.ragDatabase')}</Header>
              <Dropdown
                value={action.ragDatabaseName && action.ragDatabaseName.length > 0 ? action.ragDatabaseName : '__placeholder__'}
                onChange={(value) => {
                  const selected = value === '__placeholder__' ? '' : value;
                  update<AgentStateMember>(action.id, {
                    ragDatabaseName: selected,
                    name: getRagDisplayName(translate, selected),
                  });
                }}
              >
                {[
                  <Dropdown.Item value="__placeholder__" key="rag-placeholder">{translate('packages.AgentDiagram.selectRagDatabase')}</Dropdown.Item>,
                  ...ragDatabaseNames.map((name, i) => (
                    <Dropdown.Item key={`rag-${i}-${name}`} value={name}>{name}</Dropdown.Item>
                  )),
                ]}
              </Dropdown>
              <Header style={{ marginTop: 6 }}>{translate('packages.AgentDiagram.prompt')}</Header>
              <Textfield
                outline
                multiline
                enterToSubmit={false}
                value={action.prompt || ''}
                onChange={(value) => update<AgentStateMember>(action.id, { prompt: value })}
                placeholder={translate('packages.AgentDiagram.optionalPromptPassed')}
              />
              <CheckboxRow style={{ marginTop: 2 }}>
                <input
                  type="checkbox"
                  checked={action.promptUseSessionVars || false}
                  onChange={(e) => update<AgentStateMember>(action.id, { promptUseSessionVars: e.target.checked })}
                />
                {translate('packages.AgentDiagram.interpolateVarsInPrompt')}
              </CheckboxRow>
            </LlmFieldRow>
          ) : (
            <p style={{ fontSize: 12, margin: '4px 0', opacity: 0.7 }}>
              {translate('packages.AgentDiagram.noRagDatabases')}
            </p>
          )}
          <LlmFieldRow style={{ marginTop: 8 }}>
            <Header>{translate('packages.AgentDiagram.inputSentToRag')}</Header>
            <PromptModeRow>
              <PromptModeBtn
                active={ragInputMode === 'last_user_message'}
                onClick={() => update<AgentStateMember>(action.id, { inputPromptMode: 'last_user_message', customInputPrompt: '' })}
              >
                {translate('packages.AgentDiagram.lastUserMessage')}
              </PromptModeBtn>
              <PromptModeBtn
                active={ragInputMode === 'custom'}
                onClick={() => update<AgentStateMember>(action.id, { inputPromptMode: 'custom' })}
              >
                {translate('packages.AgentDiagram.customPrompt')}
              </PromptModeBtn>
            </PromptModeRow>
            {ragInputMode === 'custom' && (
              <>
                <Textfield
                  outline
                  multiline
                  enterToSubmit={false}
                  value={action.customInputPrompt || ''}
                  onChange={(value) => update<AgentStateMember>(action.id, { customInputPrompt: value })}
                  placeholder={translate('packages.AgentDiagram.customPromptExample')}
                />
                <VarHint>{translate('packages.AgentDiagram.useUserMessageAndSessionHint')}</VarHint>
                <CheckboxRow>
                  <input
                    type="checkbox"
                    checked={action.customInputPromptUseSessionVars || false}
                    onChange={(e) => update<AgentStateMember>(action.id, { customInputPromptUseSessionVars: e.target.checked })}
                  />
                  {translate('packages.AgentDiagram.replaceVarsAtRuntime')}
                </CheckboxRow>
              </>
            )}
          </LlmFieldRow>
          {renderStoreInSession(ctx, action)}
          {renderSendReply(ctx, action)}
        </>
      );
    }
    case 'db_reply':
      return renderDbReplyEditor(ctx, action, onInitializeDb, llmNames);
    case 'web_crawl_llm':
      return renderWebCrawlLlmEditor(ctx, action, llmNames);
    case 'ws_markdown':
    case 'ws_html':
    case 'ws_speech':
    case 'ws_options':
    case 'ws_location':
    case 'ws_file':
    case 'ws_image':
    case 'ws_dataframe':
    case 'ws_plotly':
      return renderWebSocketReplyEditor(ctx, action, hasWebSocketPlatform);
    case 'gui_reply': {
      const guiList: AgentGUIInfo[] = diagramBridge.getAgentGUIs();
      return (
        <LlmFieldRow>
          <Header>{translate('packages.AgentDiagram.guiHeader')}</Header>
          {guiList.length === 0 ? (
            <p style={{ fontSize: 12, margin: '4px 0', opacity: 0.7 }}>
              {translate('packages.AgentDiagram.noGuisDefinedAction')}
            </p>
          ) : (
            <Dropdown
              value={(action as any).guiId && (action as any).guiId.length > 0
                ? (action as any).guiId
                : '__placeholder__'}
              onChange={(value) => {
                const selected = value === '__placeholder__' ? '' : value;
                const selectedGui = guiList.find(g => g.gui_id === selected);
                update<AgentStateMember>(action.id, {
                  guiId: selected,
                  name: selectedGui
                    ? `${translate('packages.AgentDiagram.guiReplyPrefix')} ${selectedGui.name}`
                    : translate('packages.AgentDiagram.guiReplySelectGui'),
                } as any);
              }}
            >
              {[
                <Dropdown.Item value="__placeholder__" key="gui-placeholder">{translate('packages.AgentDiagram.selectGui')}</Dropdown.Item>,
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
