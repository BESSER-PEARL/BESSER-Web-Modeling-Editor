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
import { UMLElementType } from '../../uml-element-type';
import { BPMNGateway, BPMNGatewayType } from '../bpmn-gateway/bpmn-gateway';

// BPMN 2.0.2 § 8.3.13, p. 98: default sequence flow source whitelist.
const ALLOWED_DEFAULT_ACTIVITY_TYPES: ReadonlySet<UMLElementType> = new Set([
  UMLElementType.BPMNTask,
  UMLElementType.BPMNSubprocess,
  UMLElementType.BPMNTransaction,
  UMLElementType.BPMNCallActivity,
]);

const ALLOWED_DEFAULT_GATEWAY_TYPES: ReadonlySet<BPMNGatewayType> = new Set<BPMNGatewayType>([
  'exclusive',
  'inclusive',
  'complex',
]);

const canBeDefault = (flowType: BPMNFlowType, sourceElement?: UMLElement): boolean => {
  if (flowType !== 'sequence' || !sourceElement) return false;
  const t = sourceElement.type as UMLElementType;
  if (ALLOWED_DEFAULT_ACTIVITY_TYPES.has(t)) return true;
  if (t === UMLElementType.BPMNGateway) {
    return ALLOWED_DEFAULT_GATEWAY_TYPES.has((sourceElement as BPMNGateway).gatewayType);
  }
  return false;
};

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
        <Dropdown.Item value={'sequence'}>{this.props.translate('packages.BPMN.BPMNSequenceFlow')}</Dropdown.Item>
      ) : null,
      allowedTypes.includes('message') ? (
        <Dropdown.Item value={'message'}>{this.props.translate('packages.BPMN.BPMNMessageFlow')}</Dropdown.Item>
      ) : null,
      allowedTypes.includes('association') ? (
        <Dropdown.Item value={'association'}>{this.props.translate('packages.BPMN.BPMNAssociationFlow')}</Dropdown.Item>
      ) : null,
      allowedTypes.includes('data association') ? (
        <Dropdown.Item value={'data association'}>
          {this.props.translate('packages.BPMN.BPMNDataAssociationFlow')}
        </Dropdown.Item>
      ) : null,
    ].filter((item): item is React.ReactElement => item !== null);

    return (
      <div>
        <section>
          <Flex>
            <Textfield value={element.name} onChange={this.rename(element.id)} autoFocus />
            <ColorButton onClick={this.toggleColor} />
            <Button color="link" onClick={() => this.props.flip(element.id)}>
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
                  {this.props.translate('packages.BPMN.BPMNDefaultSequenceFlow')}
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

  private delete = (id: string) => () => {
    this.props.delete(id);
  };
}

export const BPMNFlowUpdate = enhance(BPMNFlowUpdateComponent);
