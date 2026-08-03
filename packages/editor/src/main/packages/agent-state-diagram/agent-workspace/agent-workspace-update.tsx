import React from 'react';
import { connect } from 'react-redux';
import styled from 'styled-components';
import { Textfield } from '../../../components/controls/textfield/textfield';
import { Header } from '../../../components/controls/typography/typography';
import { ModelState } from '../../../components/store/model-state';
import { UMLElementRepository } from '../../../services/uml-element/uml-element-repository';
import { AgentElementType } from '..';
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

const Warning = styled.p`
  font-size: 12px;
  margin: 4px 0 8px;
  color: #e04040;
  opacity: 0.85;
`;

type OwnProps = {
  element: AgentWorkspace;
};

type StateProps = {
  elements: ModelState['elements'];
};

type DispatchProps = {
  update: typeof UMLElementRepository.update;
};

type Props = OwnProps & StateProps & DispatchProps;

const AGENT_STATE_TYPE = (AgentElementType as Record<string, string>).AgentState ?? 'AgentState';

const AgentWorkspaceUpdateComponent: React.FC<Props> = ({ element, update, elements }) => {
  const hasReasoningState = Object.values(elements).some(
    (el: any) => el.type === AGENT_STATE_TYPE && el.stateType === 'reasoning',
  );

  return (
  <div>
    {!hasReasoningState && (
      <Warning>
        ⚠ Workspaces can only be used by a reasoning state. Add a reasoning state to use this workspace.
      </Warning>
    )}
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
};

const enhance = connect<StateProps, DispatchProps, OwnProps, ModelState>(
  (state) => ({ elements: state.elements }),
  { update: UMLElementRepository.update },
);

export const AgentWorkspaceUpdate = enhance(AgentWorkspaceUpdateComponent);
