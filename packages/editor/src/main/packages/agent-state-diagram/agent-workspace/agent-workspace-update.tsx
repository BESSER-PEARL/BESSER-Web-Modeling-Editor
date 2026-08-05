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

type Props = OwnProps & StateProps & DispatchProps & I18nContext;

const AGENT_STATE_TYPE = (AgentElementType as Record<string, string>).AgentState ?? 'AgentState';

const AgentWorkspaceUpdateComponent: React.FC<Props> = ({ element, update, elements, translate }) => {
  const hasReasoningState = Object.values(elements).some(
    (el: any) => el.type === AGENT_STATE_TYPE && el.stateType === 'reasoning',
  );

  return (
    <div>
      {!hasReasoningState && <Warning>⚠ {translate('packages.AgentDiagram.workspaceReasoningStateWarning')}</Warning>}
      <Section>
        <Header>{translate('packages.AgentDiagram.workspaceName')}</Header>
        <Textfield value={element.name} onChange={(name) => update<AgentWorkspace>(element.id, { name })} autoFocus />
      </Section>
      <Section>
        <Header>{translate('packages.AgentDiagram.filesystemPath')}</Header>
        <Textfield
          value={element.path}
          placeholder="/path/to/workspace"
          onChange={(path) => update<AgentWorkspace>(element.id, { path })}
        />
      </Section>
      <Section>
        <Header>{translate('packages.AgentDiagram.description')}</Header>
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
          {translate('packages.AgentDiagram.writable')}
        </CheckboxRow>
      </Section>
      <Section>
        <Header>{translate('packages.AgentDiagram.maxReadBytes')}</Header>
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

const enhance = compose<ComponentClass<OwnProps>>(
  localized,
  connect<StateProps, DispatchProps, OwnProps, ModelState>((state) => ({ elements: state.elements }), {
    update: UMLElementRepository.update,
  }),
);

export const AgentWorkspaceUpdate = enhance(AgentWorkspaceUpdateComponent);
