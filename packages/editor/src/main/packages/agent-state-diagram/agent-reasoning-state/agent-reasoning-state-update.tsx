import React from 'react';
import { connect } from 'react-redux';
import styled from 'styled-components';
import { Textfield } from '../../../components/controls/textfield/textfield';
import { Header } from '../../../components/controls/typography/typography';
import { ModelState } from '../../../components/store/model-state';
import { UMLElementRepository } from '../../../services/uml-element/uml-element-repository';
import { AgentReasoningState } from './agent-reasoning-state';

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

type StateProps = {};

type DispatchProps = {
  update: typeof UMLElementRepository.update;
};

type Props = OwnProps & StateProps & DispatchProps;

const AgentReasoningStateUpdateComponent: React.FC<Props> = ({ element, update }) => (
  <div>
    <Section>
      <Header>State name</Header>
      <Textfield
        value={element.name}
        onChange={(name) => update<AgentReasoningState>(element.id, { name })}
        autoFocus
      />
    </Section>
    <Section>
      <Header>LLM name</Header>
      <Textfield
        value={element.llm_name}
        placeholder="Name of an LLM configured on the agent"
        onChange={(llm_name) => update<AgentReasoningState>(element.id, { llm_name })}
      />
    </Section>
    <Section>
      <Header>Max steps</Header>
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
        Enable task planning
      </CheckboxRow>
      <CheckboxRow>
        <input
          type="checkbox"
          checked={element.stream_steps}
          onChange={(e) => update<AgentReasoningState>(element.id, { stream_steps: e.target.checked })}
        />
        Stream steps
      </CheckboxRow>
    </Section>
    <Section>
      <Header>System prompt</Header>
      <Textfield
        value={element.system_prompt}
        multiline
        enterToSubmit={false}
        placeholder="Optional system prompt prefix for this state"
        onChange={(system_prompt) => update<AgentReasoningState>(element.id, { system_prompt })}
      />
    </Section>
    <Section>
      <Header>Fallback message</Header>
      <Textfield
        value={element.fallback_message}
        multiline
        enterToSubmit={false}
        placeholder="Message returned if the reasoning loop fails"
        onChange={(fallback_message) => update<AgentReasoningState>(element.id, { fallback_message })}
      />
    </Section>
  </div>
);

const enhance = connect<StateProps, DispatchProps, OwnProps, ModelState>(null, {
  update: UMLElementRepository.update,
});

export const AgentReasoningStateUpdate = enhance(AgentReasoningStateUpdateComponent);
