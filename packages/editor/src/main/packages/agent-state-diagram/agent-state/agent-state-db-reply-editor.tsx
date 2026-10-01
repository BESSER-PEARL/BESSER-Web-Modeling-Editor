// Editor of the database reply action (default / custom DB, LLM query or raw SQL).
import React from 'react';
import { Button } from '../../../components/controls/button/button';
import { Dropdown } from '../../../components/controls/dropdown/dropdown';
import { Textfield } from '../../../components/controls/textfield/textfield';
import { Header } from '../../../components/controls/typography/typography';
import {
  ActionEditorContext,
  renderLlmNameField,
  renderSendReply,
  renderStoreInSession,
} from './agent-state-action-fields';
import { AgentStateMember } from './agent-state-member';
import { getDbDisplayName } from './agent-state-update-constants';
import {
  CheckboxRow,
  DbFieldRow,
  LlmFieldRow,
  PromptModeBtn,
  PromptModeRow,
  RadioGroup,
  VarHint,
  WsWarning,
} from './agent-state-update-styles';

/** Update DB-reply fields and keep the member's display name in sync. */
export const updateDbReply = (ctx: ActionEditorContext, member: AgentStateMember, values: Partial<AgentStateMember>) => {
  const dbSelectionType = values.dbSelectionType ?? member.dbSelectionType ?? 'default';
  const dbCustomName = values.dbCustomName ?? member.dbCustomName ?? '';
  const dbQueryMode = values.dbQueryMode ?? member.dbQueryMode ?? 'llm_query';
  const dbOperation = values.dbOperation ?? member.dbOperation ?? 'any';
  ctx.update<AgentStateMember>(member.id, {
    ...values,
    name: getDbDisplayName(ctx.translate, dbSelectionType, dbCustomName, dbQueryMode, dbOperation),
  });
};

export const renderDbReplyEditor = (
  ctx: ActionEditorContext,
  member: AgentStateMember | undefined,
  onInitialize: () => void,
  llmNames: string[] = [],
): React.ReactNode => {
  const { translate, update } = ctx;
  if (!member) {
    return (
      <>
        <p>{translate('packages.AgentDiagram.configuringDatabaseAction')}</p>
        <Button
          color="primary"
          onClick={onInitialize}
        >
          {translate('packages.AgentDiagram.initializeDatabaseAction')}
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
        <label>{translate('packages.AgentDiagram.selectDatabase')}</label>
        <Dropdown
          value={dbSelectionType}
          onChange={(value) => {
            const next = value === 'custom' ? 'custom' : 'default';
            updateDbReply(ctx, member, {
              dbSelectionType: next,
              dbCustomName: next === 'default' ? '' : member.dbCustomName,
            });
          }}
        >
          {[
            <Dropdown.Item value="default" key="db-default">
              {translate('packages.AgentDiagram.defaultUsingAppDb')}
            </Dropdown.Item>,
            <Dropdown.Item value="custom" key="db-custom">
              {translate('packages.AgentDiagram.custom')}
            </Dropdown.Item>,
          ]}
        </Dropdown>
        {dbSelectionType === 'custom' && (
          <Textfield
            outline
            placeholder={translate('packages.AgentDiagram.customDatabaseName')}
            value={member.dbCustomName || ''}
            onChange={(value) => updateDbReply(ctx, member, { dbCustomName: value })}
          />
        )}
      </DbFieldRow>
      <DbFieldRow>
        <label>{translate('packages.AgentDiagram.dbOperation')}</label>
        <Dropdown
          value={dbOperation}
          onChange={(value) => {
            const ops = ['any', 'select', 'insert', 'update', 'delete'];
            updateDbReply(ctx, member, { dbOperation: ops.includes(value) ? value : 'any' });
          }}
        >
          {[
            <Dropdown.Item value="any" key="op-any">
              {translate('packages.AgentDiagram.any')}
            </Dropdown.Item>,
            <Dropdown.Item value="select" key="op-select">
              {translate('packages.AgentDiagram.select')}
            </Dropdown.Item>,
            <Dropdown.Item value="insert" key="op-insert">
              {translate('packages.AgentDiagram.insert')}
            </Dropdown.Item>,
            <Dropdown.Item value="update" key="op-update">
              {translate('packages.AgentDiagram.update')}
            </Dropdown.Item>,
            <Dropdown.Item value="delete" key="op-delete">
              {translate('packages.AgentDiagram.delete')}
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
              onChange={() => updateDbReply(ctx, member, { dbQueryMode: 'llm_query', dbSqlQuery: '' })}
            />
            {translate('packages.AgentDiagram.llmQuery')}
          </label>
          <label>
            <input
              type="radio"
              name={`dbQueryMode-${member.id}`}
              value="sql"
              checked={dbQueryMode === 'sql'}
              onChange={() => updateDbReply(ctx, member, { dbQueryMode: 'sql' })}
            />
            {translate('packages.AgentDiagram.sql')}
          </label>
        </RadioGroup>
        {dbQueryMode === 'sql' ? (
          <Textfield
            outline
            multiline
            enterToSubmit={false}
            placeholder={translate('packages.AgentDiagram.sqlQueryPlaceholder')}
            value={member.dbSqlQuery || ''}
            onChange={(value) => updateDbReply(ctx, member, { dbSqlQuery: value })}
          />
        ) : (
          <>
            {llmNames.length === 0 && (
              <WsWarning style={{ marginBottom: 6 }}>
                {translate('packages.AgentDiagram.noLlmQueryMode')}
              </WsWarning>
            )}
            <p>{translate('packages.AgentDiagram.answerWillBeGenerated')}</p>
            {renderLlmNameField(ctx, member, llmNames, `db-llm-${member.id}`)}
            <LlmFieldRow style={{ marginTop: 6 }}>
              <Header>{translate('packages.AgentDiagram.inputSentToDbLlm')}</Header>
              <PromptModeRow>
                <PromptModeBtn
                  active={(member.inputPromptMode || 'last_user_message') === 'last_user_message'}
                  onClick={() => update<AgentStateMember>(member.id, { inputPromptMode: 'last_user_message', customInputPrompt: '' })}
                >
                  {translate('packages.AgentDiagram.lastUserMessage')}
                </PromptModeBtn>
                <PromptModeBtn
                  active={(member.inputPromptMode || 'last_user_message') === 'custom'}
                  onClick={() => update<AgentStateMember>(member.id, { inputPromptMode: 'custom' })}
                >
                  {translate('packages.AgentDiagram.customPrompt')}
                </PromptModeBtn>
              </PromptModeRow>
              {(member.inputPromptMode || 'last_user_message') === 'custom' && (
                <>
                  <Textfield
                    outline
                    multiline
                    enterToSubmit={false}
                    value={member.customInputPrompt || ''}
                    onChange={(value) => update<AgentStateMember>(member.id, { customInputPrompt: value })}
                    placeholder={translate('packages.AgentDiagram.dbCustomPromptExample')}
                  />
                  <VarHint>{translate('packages.AgentDiagram.useUserMessageAndSessionHint')}</VarHint>
                  <CheckboxRow>
                    <input
                      type="checkbox"
                      checked={member.customInputPromptUseSessionVars || false}
                      onChange={(e) => update<AgentStateMember>(member.id, { customInputPromptUseSessionVars: e.target.checked })}
                    />
                    {translate('packages.AgentDiagram.replaceVarsAtRuntime')}
                  </CheckboxRow>
                </>
              )}
            </LlmFieldRow>
          </>
        )}
      </DbFieldRow>
      {renderStoreInSession(ctx, member)}
      {renderSendReply(ctx, member)}
    </>
  );
};
