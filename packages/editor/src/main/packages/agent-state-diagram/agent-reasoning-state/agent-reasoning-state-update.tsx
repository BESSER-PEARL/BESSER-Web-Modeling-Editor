import React, { ComponentClass } from 'react';
import { connect } from 'react-redux';
import { compose } from 'redux';
import styled from 'styled-components';
import { Textfield } from '../../../components/controls/textfield/textfield';
import { Header } from '../../../components/controls/typography/typography';
import { I18nContext } from '../../../components/i18n/i18n-context';
import { localized } from '../../../components/i18n/localized';
import { ModelState } from '../../../components/store/model-state';
import { UMLElementRepository } from '../../../services/uml-element/uml-element-repository';
import { AgentReasoningState } from './agent-reasoning-state';
import { AgentElementType } from '..';

const AGENT_LLM_TYPE = (AgentElementType as Record<string, string>).AgentLLM ?? 'AgentLLM';

const Section = styled.section`
  padding: 8px 0;
`;

const CheckboxRow = styled.label`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 0;
`;

type OwnProps = {
  element: AgentReasoningState;
};

type StateProps = {
  elements: ModelState['elements'];
};

type DispatchProps = {
  update: typeof UMLElementRepository.update;
};

type Props = OwnProps & StateProps & DispatchProps & I18nContext;

const Select = styled.select`
  width: 100%;
  height: 30px;
  padding: 0 6px;
  border: 1px solid ${(props) => props.theme.color.gray};
  border-radius: 4px;
  background: transparent;
  color: inherit;
`;

const AgentReasoningStateUpdateComponent: React.FC<Props> = ({ element, update, elements, translate }) => {
  const llmNames = Array.from(
    new Set(
      Object.values(elements)
        .filter((el: any) => el.type === AGENT_LLM_TYPE && typeof el.name === 'string')
        .map((el: any) => el.name.trim())
        .filter((name: string) => name.length > 0),
    ),
  );

  return (
  <div>
    <Section>
      <Header>{translate('popup.agent.reasoning.name')}</Header>
      <Textfield
        value={element.name}
        onChange={(name) => update<AgentReasoningState>(element.id, { name })}
        autoFocus
      />
    </Section>
    <Section>
      <Header>{translate('popup.agent.reasoning.llmName')}</Header>
      <Select
        value={element.llm_name || ''}
        onChange={(event) => update<AgentReasoningState>(element.id, { llm_name: event.target.value })}
      >
        <option value="">{translate('popup.agent.llm.useDefault')}</option>
        {llmNames.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </Select>
    </Section>
    <Section>
      <Header>{translate('popup.agent.reasoning.maxSteps')}</Header>
      <Textfield
        value={element.max_steps}
        onChange={(value) => {
          const parsed = typeof value === 'number' ? value : parseInt(String(value), 10);
          update<AgentReasoningState>(element.id, { max_steps: Number.isNaN(parsed) ? 0 : parsed });
        }}
      />
    </Section>
    <Section>
      <CheckboxRow>
        <input
          type="checkbox"
          checked={element.enable_task_planning}
          onChange={(e) => update<AgentReasoningState>(element.id, { enable_task_planning: e.target.checked })}
        />
        {translate('popup.agent.reasoning.enablePlanning')}
      </CheckboxRow>
      <CheckboxRow>
        <input
          type="checkbox"
          checked={element.stream_steps}
          onChange={(e) => update<AgentReasoningState>(element.id, { stream_steps: e.target.checked })}
        />
        {translate('popup.agent.reasoning.streamSteps')}
      </CheckboxRow>
    </Section>
    <Section>
      <Header>{translate('popup.agent.reasoning.systemPrompt')}</Header>
      <Textfield
        value={element.system_prompt}
        multiline
        enterToSubmit={false}
        placeholder={translate('popup.agent.reasoning.systemPromptPlaceholder')}
        onChange={(system_prompt) => update<AgentReasoningState>(element.id, { system_prompt })}
      />
    </Section>
    <Section>
      <Header>{translate('popup.agent.reasoning.fallback')}</Header>
      <Textfield
        value={element.fallback_message}
        multiline
        enterToSubmit={false}
        placeholder={translate('popup.agent.reasoning.fallbackPlaceholder')}
        onChange={(fallback_message) => update<AgentReasoningState>(element.id, { fallback_message })}
      />
    </Section>
  </div>
  );
};

const enhance = compose<ComponentClass<OwnProps>>(
  localized,
  connect<StateProps, DispatchProps, OwnProps, ModelState>(
    (state) => ({ elements: state.elements }),
    {
      update: UMLElementRepository.update,
    },
  ),
);

export const AgentReasoningStateUpdate = enhance(AgentReasoningStateUpdateComponent);
