import React, { Component, ComponentClass } from 'react';
import { connect } from 'react-redux';
import { compose } from 'redux';
import { Button } from '../../../components/controls/button/button';
import { TrashIcon } from '../../../components/controls/icon/trash';
import { Textfield } from '../../../components/controls/textfield/textfield';
import { I18nContext } from '../../../components/i18n/i18n-context';
import { localized } from '../../../components/i18n/localized';
import { ModelState } from '../../../components/store/model-state';
import { styled } from '../../../components/theme/styles';
import { UMLElementRepository } from '../../../services/uml-element/uml-element-repository';
import { ExchangeIcon } from '../../../components/controls/icon/exchange';
import { UMLRelationshipRepository } from '../../../services/uml-relationship/uml-relationship-repository';
import { BPMNFlow, BPMNFlowType } from './bpmn-flow';
import { ColorButton } from '../../../components/controls/color-button/color-button';
import { StylePane } from '../../../components/style-pane/style-pane';
import { Dropdown } from '../../../components/controls/dropdown/dropdown';
import { Divider } from '../../../components/controls/divider/divider';
import { Switch } from '../../../components/controls/switch/switch';
import { UMLElement } from '../../../services/uml-element/uml-element';
import { getAllowedBpmnFlowTypes } from './bpmn-flow-semantics';
import { canSourceCarryDefault } from './bpmn-flow-validator';
import { UMLElementType } from '../../uml-element-type';

// BPMN 2.0.2 § 8.3.13: a default flow must be a sequence flow whose source can
// carry a default. Source eligibility lives in the shared validator (04C / C2).
const canBeDefault = (flowType: BPMNFlowType, sourceElement?: UMLElement): boolean =>
  flowType === 'sequence' && canSourceCarryDefault(sourceElement);

interface OwnProps {
  element: BPMNFlow;
}

type StateProps = {
  sourceElement?: UMLElement;
  targetElement?: UMLElement;
  // BPMN 2.0.2 § 8.3.13: at most one default outgoing flow per source.
  // Other flows from this source currently marked default — to be cleared
  // when the user sets this flow as default.
  siblingDefaultFlowIds: string[];
};

interface DispatchProps {
  update: typeof UMLElementRepository.update;
  delete: typeof UMLElementRepository.delete;
  flip: typeof UMLRelationshipRepository.flip;
}

type Props = OwnProps & StateProps & DispatchProps & I18nContext;

const enhance = compose<ComponentClass<OwnProps>>(
  localized,
  connect<StateProps, DispatchProps, OwnProps, ModelState>(
    (state, ownProps) => {
      const myId = ownProps.element.id;
      const mySourceId = ownProps.element.source.element;
      const siblingDefaultFlowIds = Object.values(state.elements)
        .filter((e) => {
          if (e.id === myId) return false;
          const f = e as unknown as Partial<BPMNFlow>;
          if (f.flowType !== 'sequence' || f.isDefault !== true) return false;
          const r = e as unknown as { source?: { element: string } };
          return r.source?.element === mySourceId;
        })
        .map((e) => e.id);
      return {
        sourceElement: state.elements[mySourceId] as UMLElement | undefined,
        targetElement: state.elements[ownProps.element.target.element] as UMLElement | undefined,
        siblingDefaultFlowIds,
      };
    },
    {
      update: UMLElementRepository.update,
      delete: UMLElementRepository.delete,
      flip: UMLRelationshipRepository.flip,
    },
  ),
);

const Flex = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
`;

type State = { colorOpen: boolean };

class BPMNFlowUpdateComponent extends Component<Props, State> {
  state = { colorOpen: false };

  private toggleColor = () => {
    this.setState((state) => ({
      colorOpen: !state.colorOpen,
    }));
  };

  render() {
    const { element, sourceElement, targetElement } = this.props;
    const allowedTypes =
      sourceElement && targetElement
        ? getAllowedBpmnFlowTypes(sourceElement.type as UMLElementType, targetElement.type as UMLElementType)
        : ['sequence', 'message', 'association', 'data association'];

    const flowTypeItems = [
      allowedTypes.includes('sequence') ? (
        <Dropdown.Item value={'sequence'}>
          {this.props.translate('packages.BPMNDiagram.BPMNSequenceFlow')}
        </Dropdown.Item>
      ) : null,
      allowedTypes.includes('message') ? (
        <Dropdown.Item value={'message'}>{this.props.translate('packages.BPMNDiagram.BPMNMessageFlow')}</Dropdown.Item>
      ) : null,
      allowedTypes.includes('association') ? (
        <Dropdown.Item value={'association'}>
          {this.props.translate('packages.BPMNDiagram.BPMNAssociationFlow')}
        </Dropdown.Item>
      ) : null,
      allowedTypes.includes('data association') ? (
        <Dropdown.Item value={'data association'}>
          {this.props.translate('packages.BPMNDiagram.BPMNDataAssociationFlow')}
        </Dropdown.Item>
      ) : null,
    ].filter((item): item is React.ReactElement => item !== null);

    return (
      <div>
        <section>
          <Flex>
            <Textfield value={element.name} onChange={this.rename(element.id)} autoFocus />
            <ColorButton onClick={this.toggleColor} />
            <Button color="link" onClick={this.handleFlip}>
              <ExchangeIcon />
            </Button>
            <Button color="link" tabIndex={-1} onClick={this.delete(element.id)}>
              <TrashIcon />
            </Button>
          </Flex>
        </section>
        <Divider />
        <section>
          <Dropdown value={element.flowType} onChange={this.changeFlowType(element.id)}>
            {flowTypeItems}
          </Dropdown>
        </section>
        {canBeDefault(element.flowType, sourceElement) && (
          <>
            <Divider />
            <section>
              <Switch
                value={element.isDefault ? 'default' : ''}
                onChange={this.toggleDefault(element.id)}
                color="primary"
              >
                <Switch.Item value={'default'}>
                  {this.props.translate('packages.BPMNDiagram.BPMNDefaultSequenceFlow')}
                </Switch.Item>
              </Switch>
            </section>
          </>
        )}
        <StylePane
          open={this.state.colorOpen}
          element={element}
          onColorChange={this.props.update}
          lineColor
          textColor
        />
      </div>
    );
  }

  private rename = (id: string) => (value: string) => {
    this.props.update(id, { name: value });
  };

  /**
   * Change the type of the gateway
   * @param id The ID of the gateway whose type should be changed
   */
  private changeFlowType = (id: string) => (value: string) => {
    this.props.update<BPMNFlow>(id, { flowType: value as BPMNFlowType });
  };

  // BPMN 2.0.2 § 8.3.13: at most one default outgoing flow per source. When
  // turning this flow on, clear `isDefault` on every sibling flow from the same
  // source first. Turning off needs no fix-up — only one flow can be on at any
  // time, so siblings are already `false`.
  private toggleDefault = (id: string) => (_value: string) => {
    const turningOn = !this.props.element.isDefault;
    if (turningOn) {
      for (const sibId of this.props.siblingDefaultFlowIds) {
        this.props.update<BPMNFlow>(sibId, { isDefault: false });
      }
    }
    this.props.update<BPMNFlow>(id, { isDefault: turningOn });
  };

  // BPMN 2.0.2 § 8.3.13: flipping a sequence flow swaps source ↔ target. If
  // `isDefault` is set and the post-flip source (= current target) is not a
  // valid default source, clear `isDefault` before the flip so the data
  // reflects the spec. Endpoint-drag is not intercepted here — see §11 of the
  // 04A1 guide for the deferred saga-based fix.
  private handleFlip = () => {
    const { element, targetElement } = this.props;
    if (element.isDefault && !canBeDefault(element.flowType, targetElement)) {
      this.props.update<BPMNFlow>(element.id, { isDefault: false });
    }
    this.props.flip(element.id);
  };

  private delete = (id: string) => () => {
    this.props.delete(id);
  };
}

export const BPMNFlowUpdate = enhance(BPMNFlowUpdateComponent);
