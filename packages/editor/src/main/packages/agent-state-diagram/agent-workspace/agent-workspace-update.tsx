import React from 'react';
import { connect } from 'react-redux';
import styled from 'styled-components';
import { Textfield } from '../../../components/controls/textfield/textfield';
import { Header } from '../../../components/controls/typography/typography';
import { ModelState } from '../../../components/store/model-state';
import { UMLElementRepository } from '../../../services/uml-element/uml-element-repository';
import { AgentWorkspace } from './agent-workspace';

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
  element: AgentWorkspace;
};

type StateProps = {};

type DispatchProps = {
  update: typeof UMLElementRepository.update;
};

type Props = OwnProps & StateProps & DispatchProps;

const AgentWorkspaceUpdateComponent: React.FC<Props> = ({ element, update }) => (
  <div>
    <Section>
      <Header>Workspace name</Header>
      <Textfield value={element.name} onChange={(name) => update<AgentWorkspace>(element.id, { name })} autoFocus />
    </Section>
    <Section>
      <Header>Filesystem path</Header>
      <Textfield
        value={element.path}
        placeholder="/path/to/workspace"
        onChange={(path) => update<AgentWorkspace>(element.id, { path })}
      />
    </Section>
    <Section>
      <Header>Description</Header>
      <Textfield
        value={element.description}
        multiline
        enterToSubmit={false}
        placeholder="Optional description"
        onChange={(description) => update<AgentWorkspace>(element.id, { description })}
      />
    </Section>
    <Section>
      <CheckboxRow>
        <input
          type="checkbox"
          checked={element.writable}
          onChange={(e) => update<AgentWorkspace>(element.id, { writable: e.target.checked })}
        />
        Writable
      </CheckboxRow>
    </Section>
    <Section>
      <Header>Max read bytes</Header>
      <Textfield
        value={element.max_read_bytes}
        onChange={(value) => {
          const parsed = typeof value === 'number' ? value : parseInt(String(value), 10);
          update<AgentWorkspace>(element.id, { max_read_bytes: Number.isNaN(parsed) ? 0 : parsed });
        }}
      />
    </Section>
  </div>
);

const enhance = connect<StateProps, DispatchProps, OwnProps, ModelState>(null, {
  update: UMLElementRepository.update,
});

export const AgentWorkspaceUpdate = enhance(AgentWorkspaceUpdateComponent);
