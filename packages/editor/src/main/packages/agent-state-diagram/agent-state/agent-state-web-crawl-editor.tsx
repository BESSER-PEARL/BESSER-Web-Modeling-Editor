// Editor of the web-crawl + LLM reply action.
import React from 'react';
import { Textfield } from '../../../components/controls/textfield/textfield';
import { Header } from '../../../components/controls/typography/typography';
import { ActionEditorContext, renderSendReply, renderStoreInSession } from './agent-state-action-fields';
import { AgentStateMember } from './agent-state-member';
import { CheckboxRow, DbFieldRow, LlmFieldRow, LlmSelect, VarHint, WsWarning } from './agent-state-update-styles';

export const renderWebCrawlLlmEditor = (
  ctx: ActionEditorContext,
  member: AgentStateMember,
  llmNames: string[],
): React.ReactNode => {
  const { translate, update } = ctx;
  const crawl_format = member.crawl_format || 'markdown';
  return (
    <LlmFieldRow>
      {llmNames.length === 0 && (
        <WsWarning style={{ marginBottom: 6 }}>
          {translate('packages.AgentDiagram.noLlmDefinedWeb')}
        </WsWarning>
      )}
      <Header>{translate('packages.AgentDiagram.initialUrl')}</Header>
      <Textfield
        outline
        value={member.initial_url || ''}
        onChange={(value) => {
          update<AgentStateMember>(member.id, {
            initial_url: value,
            name: value
              ? `${translate('packages.AgentDiagram.webCrawlNamePrefix')} ${value.slice(0, 40)}`
              : translate('packages.AgentDiagram.webCrawlLlmSetUrl'),
          });
        }}
        placeholder={translate('packages.AgentDiagram.httpsExample')}
      />
      <Header style={{ marginTop: 6 }}>{translate('packages.AgentDiagram.baseUrlPrefixOptional')}</Header>
      <Textfield
        outline
        value={member.base_url_prefix || ''}
        onChange={(value) => update<AgentStateMember>(member.id, { base_url_prefix: value })}
        placeholder={translate('packages.AgentDiagram.baseUrlPrefixExample')}
      />
      <DbFieldRow style={{ marginTop: 6 }}>
        <label>{translate('packages.AgentDiagram.maxDepth')}</label>
        <Textfield
          outline
          value={member.max_depth ?? 2}
          onChange={(value) => {
            const parsed = parseInt(String(value), 10);
            update<AgentStateMember>(member.id, { max_depth: Number.isNaN(parsed) ? 2 : parsed });
          }}
        />
      </DbFieldRow>
      <DbFieldRow>
        <label>{translate('packages.AgentDiagram.maxPages')}</label>
        <Textfield
          outline
          value={member.max_pages ?? 20}
          onChange={(value) => {
            const parsed = parseInt(String(value), 10);
            update<AgentStateMember>(member.id, { max_pages: Number.isNaN(parsed) ? 20 : parsed });
          }}
        />
      </DbFieldRow>
      <Header style={{ marginTop: 6 }}>{translate('packages.AgentDiagram.crawlFormat')}</Header>
      <LlmSelect
        value={crawl_format}
        onChange={(e) => update<AgentStateMember>(member.id, { crawl_format: e.target.value })}
      >
        <option value="markdown">{translate('packages.AgentDiagram.markdown')}</option>
        <option value="text">{translate('packages.AgentDiagram.plainText')}</option>
        <option value="html">{translate('packages.AgentDiagram.html')}</option>
      </LlmSelect>
      <CheckboxRow style={{ marginTop: 6 }}>
        <input
          type="checkbox"
          checked={member.run_crawl !== false}
          onChange={(e) => update<AgentStateMember>(member.id, { run_crawl: e.target.checked })}
        />
        {translate('packages.AgentDiagram.runCrawl')}
      </CheckboxRow>
      {member.run_crawl === false && (
        <>
          <Header style={{ marginTop: 6 }}>
            {translate('packages.AgentDiagram.noCrawlErrorMessage')}
          </Header>
          <Textfield
            outline
            value={member.no_crawl_error_message || ''}
            onChange={(value) => update<AgentStateMember>(member.id, { no_crawl_error_message: value })}
            placeholder={translate('packages.AgentDiagram.noCrawlErrorDefault')}
          />
        </>
      )}
      <Header style={{ marginTop: 6 }}>
        {translate('packages.AgentDiagram.systemMessagePrefixOptional')}
      </Header>
      <Textfield
        outline
        multiline
        enterToSubmit={false}
        value={member.system_message_prefix || ''}
        onChange={(value) => update<AgentStateMember>(member.id, { system_message_prefix: value })}
        placeholder={translate('packages.AgentDiagram.useFollowingWebpageContent')}
      />
      {member.system_message_prefix && (
        <>
          <CheckboxRow>
            <input
              type="checkbox"
              checked={member.systemMessagePrefixUseSessionVars || false}
              onChange={(e) => update<AgentStateMember>(member.id, { systemMessagePrefixUseSessionVars: e.target.checked })}
            />
            {translate('packages.AgentDiagram.interpolateVarsSystemMessagePrefix')}
          </CheckboxRow>
          {member.systemMessagePrefixUseSessionVars && (
            <VarHint>{translate('packages.AgentDiagram.useSessionValuesHint')}</VarHint>
          )}
        </>
      )}
      <Header style={{ marginTop: 6 }}>{translate('packages.AgentDiagram.llm')}</Header>
      <LlmSelect
        value={member.llm_name || ''}
        onChange={(e) => update<AgentStateMember>(member.id, { llm_name: e.target.value })}
      >
        <option value="">{translate('packages.AgentDiagram.selectPlaceholder')}</option>
        {llmNames.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </LlmSelect>
      {renderStoreInSession(ctx, member)}
      {renderSendReply(ctx, member)}
    </LlmFieldRow>
  );
};
