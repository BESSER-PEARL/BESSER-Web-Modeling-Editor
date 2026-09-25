// Field groups reused by several action editors of the agent state property panel.
import React from 'react';
import { Textfield } from '../../../components/controls/textfield/textfield';
import { Header } from '../../../components/controls/typography/typography';
import { UMLElementRepository } from '../../../services/uml-element/uml-element-repository';
import { Translate } from './agent-state-update-constants';
import { AgentStateMember } from './agent-state-member';
import { CheckboxRow, LlmFieldRow, LlmSelect, StoreInSessionRow, VarHint } from './agent-state-update-styles';

/** What every action editor needs from the property panel. */
export interface ActionEditorContext {
  translate: Translate;
  update: typeof UMLElementRepository.update;
}

export const renderLlmNameField = (
  ctx: ActionEditorContext,
  member: AgentStateMember,
  llmNames: string[],
  fieldId: string,
  options?: { warning?: string },
): React.ReactNode => {
  const { translate, update } = ctx;
  return (
    <LlmFieldRow>
      <Header>{translate('packages.AgentDiagram.llm')}</Header>
      <LlmSelect
        id={fieldId}
        value={member.llm_name || ''}
        onChange={(e) => update<AgentStateMember>(member.id, { llm_name: e.target.value })}
      >
        <option value="">{translate('packages.AgentDiagram.selectPlaceholder')}</option>
        {llmNames.map((n) => (
          <option key={`${fieldId}-${n}`} value={n}>
            {n}
          </option>
        ))}
      </LlmSelect>
      {options?.warning && <p style={{ fontSize: 12, margin: '4px 0', opacity: 0.7 }}>{options.warning}</p>}
      <Header style={{ marginTop: 6 }}>{translate('packages.AgentDiagram.systemMessage')}</Header>
      <Textfield
        outline
        value={member.system_message || ''}
        onChange={(value) => update<AgentStateMember>(member.id, { system_message: value })}
        placeholder={translate('packages.AgentDiagram.youAreHelpfulAssistant')}
      />
    </LlmFieldRow>
  );
};

export const renderStoreInSession = (ctx: ActionEditorContext, action: AgentStateMember): React.ReactNode => {
  const { translate, update } = ctx;
  return (
    <StoreInSessionRow>
      <Header>{translate('packages.AgentDiagram.storeResultInSession')}</Header>
      <Textfield
        outline
        value={action.storeInSession || ''}
        onChange={(value) => update<AgentStateMember>(action.id, { storeInSession: value.trim() })}
        placeholder={translate('packages.AgentDiagram.sessionKeyPlaceholder')}
      />
      {action.storeInSession && (
        <VarHint>
          {`${translate('packages.AgentDiagram.resultStoredHintPrefix')} {${action.storeInSession}} ${translate('packages.AgentDiagram.resultStoredHintSuffix')}`}
        </VarHint>
      )}
    </StoreInSessionRow>
  );
};

export const renderSendReply = (ctx: ActionEditorContext, action: AgentStateMember): React.ReactNode => {
  const { translate, update } = ctx;
  return (
    <CheckboxRow style={{ marginTop: 6 }}>
      <input
        type="checkbox"
        checked={action.sendReply !== false}
        onChange={(e) => update<AgentStateMember>(action.id, { sendReply: e.target.checked })}
      />
      {translate('packages.AgentDiagram.sendAsAgentReply')}
    </CheckboxRow>
  );
};
