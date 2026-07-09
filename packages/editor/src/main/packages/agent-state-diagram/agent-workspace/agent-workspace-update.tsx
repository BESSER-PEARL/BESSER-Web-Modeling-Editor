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

type Props = OwnProps & StateProps & DispatchProps & I18nContext;

const AgentWorkspaceUpdateComponent: React.FC<Props> = ({ element, update, translate }) => (
  <div>
    <Section>
      <Header>{translate('popup.agent.workspace.name')}</Header>
      <Textfield value={element.name} onChange={(name) => update<AgentWorkspace>(element.id, { name })} autoFocus />
    </Section>
    <Section>
      <Header>{translate('popup.agent.workspace.path')}</Header>
      <Textfield
        value={element.path}
        placeholder="/path/to/workspace"
        onChange={(path) => update<AgentWorkspace>(element.id, { path })}
      />
    </Section>
    <Section>
      <Header>{translate('popup.agent.workspace.description')}</Header>
      <Textfield
        value={element.description}
        multiline
        enterToSubmit={false}
        placeholder={translate('popup.agent.workspace.descriptionPlaceholder')}
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
        {translate('popup.agent.workspace.writable')}
      </CheckboxRow>
    </Section>
    <Section>
      <Header>{translate('popup.agent.workspace.maxReadBytes')}</Header>
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

const enhance = compose<ComponentClass<OwnProps>>(
  localized,
  connect<StateProps, DispatchProps, OwnProps, ModelState>(null, {
    update: UMLElementRepository.update,
  }),
);

export const AgentWorkspaceUpdate = enhance(AgentWorkspaceUpdateComponent);
