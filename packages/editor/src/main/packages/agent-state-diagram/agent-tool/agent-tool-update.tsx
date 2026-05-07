import React from 'react';
import { connect } from 'react-redux';
import styled from 'styled-components';
import { Textfield } from '../../../components/controls/textfield/textfield';
import { Header } from '../../../components/controls/typography/typography';
import { ModelState } from '../../../components/store/model-state';
import { UMLElementRepository } from '../../../services/uml-element/uml-element-repository';
import { AgentTool } from './agent-tool';

const Section = styled.section`
  padding: 8px 0;
`;

type OwnProps = {
  element: AgentTool;
};

type StateProps = {};

type DispatchProps = {
  update: typeof UMLElementRepository.update;
};

type Props = OwnProps & StateProps & DispatchProps;

const AgentToolUpdateComponent: React.FC<Props> = ({ element, update }) => (
  <div>
    <Section>
      <Header>Tool name</Header>
      <Textfield value={element.name} onChange={(name) => update<AgentTool>(element.id, { name })} autoFocus />
    </Section>
    <Section>
      <Header>Description</Header>
      <Textfield
        value={element.description}
        multiline
        enterToSubmit={false}
        placeholder="Short description shown to the LLM"
        onChange={(description) => update<AgentTool>(element.id, { description })}
      />
    </Section>
    <Section>
      <Header>Python code</Header>
      <Textfield
        value={element.code}
        multiline
        enterToSubmit={false}
        placeholder={'def tool_name(...):\n    ...'}
        onChange={(code) => update<AgentTool>(element.id, { code })}
      />
    </Section>
  </div>
);

const enhance = connect<StateProps, DispatchProps, OwnProps, ModelState>(null, {
  update: UMLElementRepository.update,
});

export const AgentToolUpdate = enhance(AgentToolUpdateComponent);
