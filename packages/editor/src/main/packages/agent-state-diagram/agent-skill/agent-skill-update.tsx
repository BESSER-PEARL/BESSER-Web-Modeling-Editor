import React from 'react';
import { connect } from 'react-redux';
import styled from 'styled-components';
import { Textfield } from '../../../components/controls/textfield/textfield';
import { Header } from '../../../components/controls/typography/typography';
import { ModelState } from '../../../components/store/model-state';
import { UMLElementRepository } from '../../../services/uml-element/uml-element-repository';
import { AgentElementType } from '..';
import { AgentSkill } from './agent-skill';

const Section = styled.section`
  padding: 8px 0;
`;

const Warning = styled.p`
  font-size: 12px;
  margin: 4px 0 8px;
  color: #e04040;
  opacity: 0.85;
`;

type OwnProps = {
  element: AgentSkill;
};

type StateProps = {
  elements: ModelState['elements'];
};

type DispatchProps = {
  update: typeof UMLElementRepository.update;
};

type Props = OwnProps & StateProps & DispatchProps;

const AGENT_STATE_TYPE = (AgentElementType as Record<string, string>).AgentState ?? 'AgentState';

const AgentSkillUpdateComponent: React.FC<Props> = ({ element, update, elements }) => {
  const hasReasoningState = Object.values(elements).some(
    (el: any) => el.type === AGENT_STATE_TYPE && el.stateType === 'reasoning',
  );

  return (
    <div>
      {!hasReasoningState && (
        <Warning>
          ⚠ Skills can only be used by a reasoning state. Add a reasoning state to use this skill.
        </Warning>
      )}
      <Section>
        <Header>Skill name</Header>
        <Textfield value={element.name} onChange={(name) => update<AgentSkill>(element.id, { name })} autoFocus />
      </Section>
      <Section>
        <Header>Description</Header>
        <Textfield
          value={element.description}
          multiline
          enterToSubmit={false}
          placeholder="Optional short description"
          onChange={(description) => update<AgentSkill>(element.id, { description })}
        />
      </Section>
      <Section>
        <Header>Markdown content</Header>
        <Textfield
          value={element.content}
          multiline
          enterToSubmit={false}
          placeholder={'# Skill\n\nInstructions in markdown...'}
          onChange={(content) => update<AgentSkill>(element.id, { content })}
        />
      </Section>
    </div>
  );
};

const enhance = connect<StateProps, DispatchProps, OwnProps, ModelState>(
  (state) => ({ elements: state.elements }),
  { update: UMLElementRepository.update },
);

export const AgentSkillUpdate = enhance(AgentSkillUpdateComponent);
