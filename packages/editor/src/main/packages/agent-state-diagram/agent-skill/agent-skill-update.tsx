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

type Props = OwnProps & StateProps & DispatchProps & I18nContext;

const AGENT_STATE_TYPE = (AgentElementType as Record<string, string>).AgentState ?? 'AgentState';

const AgentSkillUpdateComponent: React.FC<Props> = ({ element, update, elements, translate }) => {
  const hasReasoningState = Object.values(elements).some(
    (el: any) => el.type === AGENT_STATE_TYPE && el.stateType === 'reasoning',
  );

  return (
    <div>
      {!hasReasoningState && <Warning>⚠ {translate('packages.AgentDiagram.skillReasoningStateWarning')}</Warning>}
      <Section>
        <Header>{translate('packages.AgentDiagram.skillName')}</Header>
        <Textfield value={element.name} onChange={(name) => update<AgentSkill>(element.id, { name })} autoFocus />
      </Section>
      <Section>
        <Header>{translate('packages.AgentDiagram.description')}</Header>
        <Textfield
          value={element.description}
          multiline
          enterToSubmit={false}
          placeholder={translate('packages.AgentDiagram.skillDescriptionPlaceholder')}
          onChange={(description) => update<AgentSkill>(element.id, { description })}
        />
      </Section>
      <Section>
        <Header>{translate('packages.AgentDiagram.markdownContent')}</Header>
        <Textfield
          value={element.content}
          multiline
          enterToSubmit={false}
          placeholder={translate('packages.AgentDiagram.skillContentPlaceholder')}
          onChange={(content) => update<AgentSkill>(element.id, { content })}
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

export const AgentSkillUpdate = enhance(AgentSkillUpdateComponent);
