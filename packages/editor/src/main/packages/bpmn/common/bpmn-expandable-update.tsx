import React, { Component, ComponentClass } from 'react';
import { connect } from 'react-redux';
import { compose } from 'redux';
import { Button } from '../../../components/controls/button/button';
import { Divider } from '../../../components/controls/divider/divider';
import { I18nContext } from '../../../components/i18n/i18n-context';
import { localized } from '../../../components/i18n/localized';
import { ModelState } from '../../../components/store/model-state';
import { UMLElementRepository } from '../../../services/uml-element/uml-element-repository';
import { BpmnPopupHeader } from './bpmn-popup-header';

export interface ExpandableElement {
  id: string;
  name: string;
  isExpanded: boolean;
  fillColor?: string;
  lineColor?: string;
  textColor?: string;
}

interface OwnProps {
  element: ExpandableElement;
  /** i18n key for the element noun shown in the button text, e.g. "packages.BPMNDiagram.BPMNSubprocess". */
  labelKey: string;
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

class BPMNExpandableUpdateComponent extends Component<Props> {
  render() {
    const { element, labelKey, translate } = this.props;
    const label = translate(labelKey);
    return (
      <div>
        <BpmnPopupHeader element={element} update={this.props.update} delete={this.props.delete} />
        <section>
          <Divider />
          <Button block color={element.isExpanded ? 'secondary' : 'primary'} onClick={this.toggleExpanded(element.id)}>
            {element.isExpanded
              ? `${translate('packages.BPMNDiagram.BPMNCollapse')} ${label}`
              : `${translate('packages.BPMNDiagram.BPMNExpand')} ${label}`}
          </Button>
        </section>
      </div>
    );
  }

  private toggleExpanded = (id: string) => () => {
    this.props.update(id, { isExpanded: !this.props.element.isExpanded });
  };
}

export const BPMNExpandableUpdate = enhance(BPMNExpandableUpdateComponent);
