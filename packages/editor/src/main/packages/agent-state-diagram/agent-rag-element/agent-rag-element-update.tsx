import React from 'react';
import { connect } from 'react-redux';
import { Textfield } from '../../../components/controls/textfield/textfield';
import { Header } from '../../../components/controls/typography/typography';
import { ModelState } from '../../../components/store/model-state';
import { UMLElementRepository } from '../../../services/uml-element/uml-element-repository';
import { AgentRagElement } from './agent-rag-element';

type OwnProps = {
  element: AgentRagElement;
};

type StateProps = {};

type DispatchProps = {
  update: typeof UMLElementRepository.update;
};

type Props = OwnProps & StateProps & DispatchProps;

const AgentRagElementUpdateComponent: React.FC<Props> = ({ element, update }) => (
  <div>
    <Header>Name of RAG DB</Header>
    <Textfield value={element.name} onChange={(name) => update(element.id, { name })} autoFocus />
  </div>
);

const enhance = connect<StateProps, DispatchProps, OwnProps, ModelState>(null, {
  update: UMLElementRepository.update,
});

export const AgentRagElementUpdate = enhance(AgentRagElementUpdateComponent);
