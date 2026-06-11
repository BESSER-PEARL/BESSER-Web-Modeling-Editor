import React from 'react';
import { connect } from 'react-redux';
import styled from 'styled-components';
import { Textfield } from '../../../components/controls/textfield/textfield';
import { Header } from '../../../components/controls/typography/typography';
import { ModelState } from '../../../components/store/model-state';
import { UMLElementRepository } from '../../../services/uml-element/uml-element-repository';
import { AgentSkill } from './agent-skill';

const Section = styled.section`
  padding: 8px 0;
`;

type OwnProps = {
  element: AgentSkill;
};

type StateProps = {};

type DispatchProps = {
  update: typeof UMLElementRepository.update;
};

type Props = OwnProps & StateProps & DispatchProps;

const AgentSkillUpdateComponent: React.FC<Props> = ({ element, update }) => (
  <div>
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

const enhance = connect<StateProps, DispatchProps, OwnProps, ModelState>(null, {
  update: UMLElementRepository.update,
});

export const AgentSkillUpdate = enhance(AgentSkillUpdateComponent);
