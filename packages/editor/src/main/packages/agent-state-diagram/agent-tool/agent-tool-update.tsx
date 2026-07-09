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

type Props = OwnProps & StateProps & DispatchProps & I18nContext;

const AgentToolUpdateComponent: React.FC<Props> = ({ element, update, translate }) => (
  <div>
    <Section>
      <Header>{translate('popup.agent.tool.name')}</Header>
      <Textfield value={element.name} onChange={(name) => update<AgentTool>(element.id, { name })} autoFocus />
    </Section>
    <Section>
      <Header>{translate('popup.agent.tool.description')}</Header>
      <Textfield
        value={element.description}
        multiline
        enterToSubmit={false}
        placeholder={translate('popup.agent.tool.descriptionPlaceholder')}
        onChange={(description) => update<AgentTool>(element.id, { description })}
      />
    </Section>
    <Section>
      <Header>{translate('popup.agent.tool.code')}</Header>
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

const enhance = compose<ComponentClass<OwnProps>>(
  localized,
  connect<StateProps, DispatchProps, OwnProps, ModelState>(null, {
    update: UMLElementRepository.update,
  }),
);

export const AgentToolUpdate = enhance(AgentToolUpdateComponent);
