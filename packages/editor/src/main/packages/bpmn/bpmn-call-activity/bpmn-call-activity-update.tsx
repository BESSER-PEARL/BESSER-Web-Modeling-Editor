import React, { Component, ComponentClass } from 'react';
import { connect } from 'react-redux';
import { compose } from 'redux';
import { Divider } from '../../../components/controls/divider/divider';
import { Textfield } from '../../../components/controls/textfield/textfield';
import { I18nContext } from '../../../components/i18n/i18n-context';
import { localized } from '../../../components/i18n/localized';
import { ModelState } from '../../../components/store/model-state';
import { styled } from '../../../components/theme/styles';
import { UMLElementRepository } from '../../../services/uml-element/uml-element-repository';
import { BPMNCallActivity } from './bpmn-call-activity';
import { BpmnPopupHeader } from '../common/bpmn-popup-header';

interface OwnProps {
  element: BPMNCallActivity;
}

type StateProps = {};

interface DispatchProps {
  update: typeof UMLElementRepository.update;
  delete: typeof UMLElementRepository.delete;
}

type Props = OwnProps & StateProps & DispatchProps & I18nContext;

const enhance = compose<ComponentClass<OwnProps>>(
  localized,
  connect<StateProps, DispatchProps, OwnProps, ModelState>(null, {
    update: UMLElementRepository.update,
    delete: UMLElementRepository.delete,
  }),
);

const Label = styled.div`
  font-size: 0.85em;
  color: #888;
  margin-bottom: 0.25rem;
`;

class BPMNCallActivityUpdateComponent extends Component<Props> {
  render() {
    const { element } = this.props;

    return (
      <div>
        <BpmnPopupHeader element={element} update={this.props.update} delete={this.props.delete} />
        <section>
          <Divider />
          <Label>{this.props.translate('packages.BPMNDiagram.BPMNCalledElement')}</Label>
          <Textfield
            value={element.calledElement}
            onChange={this.changeCalledElement(element.id)}
            placeholder={this.props.translate('packages.BPMNDiagram.BPMNCalledElementPlaceholder')}
          />
        </section>
      </div>
    );
  }

  private changeCalledElement = (id: string) => (value: string) => {
    this.props.update<BPMNCallActivity>(id, { calledElement: value });
  };
}

export const BPMNCallActivityUpdate = enhance(BPMNCallActivityUpdateComponent);
