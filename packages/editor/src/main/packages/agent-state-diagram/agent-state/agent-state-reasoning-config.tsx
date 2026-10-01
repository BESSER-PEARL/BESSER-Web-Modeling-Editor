// Settings of a reasoning agent state (LLM, step budget, planning, prompts).
import React from 'react';
import { Divider } from '../../../components/controls/divider/divider';
import { Textfield } from '../../../components/controls/textfield/textfield';
import { Header } from '../../../components/controls/typography/typography';
import { ActionEditorContext } from './agent-state-action-fields';
import { AgentState } from './agent-state';
import { CheckboxRow, LlmSelect, Section } from './agent-state-update-styles';

export const renderReasoningConfig = (
  ctx: ActionEditorContext,
  element: AgentState,
  llmNames: string[],
): React.ReactNode => {
  const { translate, update } = ctx;
  return (
    <>
      <Section>
        <Divider />
      </Section>
      <Section>
        <Header>{translate('packages.AgentDiagram.llmName')}</Header>
        <LlmSelect
          value={element.llm_name || ''}
          onChange={(e) => update<AgentState>(element.id, { llm_name: e.target.value } as any)}
        >
          <option value="">{translate('packages.AgentDiagram.selectPlaceholder')}</option>
          {llmNames.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </LlmSelect>
      </Section>
      <Section>
        <Header>{translate('packages.AgentDiagram.maxSteps')}</Header>
        <Textfield
          value={element.max_steps ?? 8}
          onChange={(value) => {
            const parsed = parseInt(String(value), 10);
            update<AgentState>(element.id, { max_steps: Number.isNaN(parsed) ? 8 : parsed } as any);
          }}
        />
      </Section>
      <Section>
        <CheckboxRow>
          <input
            type="checkbox"
            checked={element.enable_task_planning !== false}
            onChange={(e) =>
              update<AgentState>(element.id, { enable_task_planning: e.target.checked } as any)
            }
          />
          {translate('packages.AgentDiagram.enableTaskPlanning')}
        </CheckboxRow>
        <CheckboxRow>
          <input
            type="checkbox"
            checked={element.stream_steps !== false}
            onChange={(e) => update<AgentState>(element.id, { stream_steps: e.target.checked } as any)}
          />
          {translate('packages.AgentDiagram.streamSteps')}
        </CheckboxRow>
      </Section>
      <Section>
        <Header>{translate('packages.AgentDiagram.systemPrompt')}</Header>
        <Textfield
          value={element.system_prompt || ''}
          multiline
          enterToSubmit={false}
          placeholder={translate('packages.AgentDiagram.optionalSystemPromptPrefix')}
          onChange={(system_prompt) => update<AgentState>(element.id, { system_prompt } as any)}
        />
      </Section>
      <Section>
        <Header>{translate('packages.AgentDiagram.fallbackMessage')}</Header>
        <Textfield
          value={element.fallback_message || ''}
          multiline
          enterToSubmit={false}
          placeholder={translate('packages.AgentDiagram.messageReturnedIfReasoningFails')}
          onChange={(fallback_message) => update<AgentState>(element.id, { fallback_message } as any)}
        />
      </Section>
    </>
  );
};
