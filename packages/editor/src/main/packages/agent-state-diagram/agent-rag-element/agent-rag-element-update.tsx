import React from 'react';
import { connect } from 'react-redux';
import styled from 'styled-components';
import { Textfield } from '../../../components/controls/textfield/textfield';
import { Header } from '../../../components/controls/typography/typography';
import { ModelState } from '../../../components/store/model-state';
import { UMLElementRepository } from '../../../services/uml-element/uml-element-repository';
import { AgentRagElement } from './agent-rag-element';
import { AgentElementType } from '..';

const AGENT_LLM_TYPE = (AgentElementType as Record<string, string>).AgentLLM ?? 'AgentLLM';

type OwnProps = {
  element: AgentRagElement;
};

type StateProps = {
  elements: ModelState['elements'];
};

type DispatchProps = {
  update: typeof UMLElementRepository.update;
};

type Props = OwnProps & StateProps & DispatchProps;

const Section = styled.section`
  padding: 8px 0;
`;

const Select = styled.select`
  width: 100%;
  height: 30px;
  padding: 0 6px;
  border: 1px solid ${(props) => props.theme.color.gray};
  border-radius: 4px;
  background: transparent;
  color: inherit;
`;

const AgentRagElementUpdateComponent: React.FC<Props> = ({ element, update, elements }) => {
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
        <Header>Name of RAG DB</Header>
        <Textfield value={element.name} onChange={(name) => update(element.id, { name })} autoFocus />
      </Section>
      <Section>
        <Header>LLM</Header>
        <Select
          value={element.llm_name || ''}
          onChange={(event) => update<AgentRagElement>(element.id, { llm_name: event.target.value })}
        >
          <option value="">(use default)</option>
          {llmNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </Select>
      </Section>
    </div>
  );
};

const enhance = connect<StateProps, DispatchProps, OwnProps, ModelState>(
  (state) => ({ elements: state.elements }),
  {
    update: UMLElementRepository.update,
  },
);

export const AgentRagElementUpdate = enhance(AgentRagElementUpdateComponent);
