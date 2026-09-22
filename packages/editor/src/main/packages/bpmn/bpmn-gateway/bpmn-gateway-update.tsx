import React, { Component, ComponentClass } from 'react';
import { connect } from 'react-redux';
import { compose } from 'redux';
import { Button } from '../../../components/controls/button/button';
import { Divider } from '../../../components/controls/divider/divider';
import { TrashIcon } from '../../../components/controls/icon/trash';
import { Textfield } from '../../../components/controls/textfield/textfield';
import { I18nContext } from '../../../components/i18n/i18n-context';
import { localized } from '../../../components/i18n/localized';
import { ModelState } from '../../../components/store/model-state';
import { styled } from '../../../components/theme/styles';
import { UMLElementRepository } from '../../../services/uml-element/uml-element-repository';
import { BPMNGateway, BPMNGatewayType } from './bpmn-gateway';
import { BPMNFlow } from '../bpmn-flow/bpmn-flow';
import { Dropdown } from '../../../components/controls/dropdown/dropdown';
import { ColorButton } from '../../../components/controls/color-button/color-button';
import { StylePane } from '../../../components/style-pane/style-pane';

// BPMN 2.0.2 § 8.3.13 / §§ 10.5.4 / 10.5.6: Parallel and Event-Based gateways
// cannot carry a default outgoing sequence flow.
const NO_DEFAULT_GATEWAY_TYPES: ReadonlySet<BPMNGatewayType> = new Set<BPMNGatewayType>(['parallel', 'event-based']);

interface OwnProps {
  element: BPMNGateway;
}

type StateProps = {
  // IDs of outgoing default sequence flows from this gateway. Cleared by
  // `changeGatewayType` when the user switches to a type that may not carry
  // a default flow (Parallel / Event-Based per BPMN 2.0.2 § 8.3.13).
  outgoingDefaultFlowIds: string[];
};

interface DispatchProps {
  update: typeof UMLElementRepository.update;
  delete: typeof UMLElementRepository.delete;
}

type Props = OwnProps & StateProps & DispatchProps & I18nContext;

const enhance = compose<ComponentClass<OwnProps>>(
  localized,
  connect<StateProps, DispatchProps, OwnProps, ModelState>(
    (state, ownProps) => {
      const myId = ownProps.element.id;
      const outgoingDefaultFlowIds = Object.values(state.elements)
        .filter((e) => {
          const f = e as unknown as Partial<BPMNFlow>;
          if (f.flowType !== 'sequence' || f.isDefault !== true) return false;
          const r = e as unknown as { source?: { element: string } };
          return r.source?.element === myId;
        })
        .map((e) => e.id);
      return { outgoingDefaultFlowIds };
    },
    {
      update: UMLElementRepository.update,
      delete: UMLElementRepository.delete,
    },
  ),
);

const Flex = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
`;

type State = { colorOpen: boolean };

class BPMNGatewayUpdateComponent extends Component<Props, State> {
  state = { colorOpen: false };

  private toggleColor = () => {
    this.setState((state) => ({
      colorOpen: !state.colorOpen,
    }));
  };

  render() {
    const { element } = this.props;

    return (
      <div>
        <section>
          <Flex>
            <Textfield value={element.name} onChange={this.rename(element.id)} autoFocus />
            <ColorButton onClick={this.toggleColor} />
            <Button color="link" tabIndex={-1} onClick={this.delete(element.id)}>
              <TrashIcon />
            </Button>
          </Flex>
          <Divider />
        </section>
        <section>
          <StylePane
            open={this.state.colorOpen}
            element={element}
            onColorChange={this.props.update}
            lineColor
            textColor
            fillColor
          />
        </section>
        <section>
          <Dropdown value={element.gatewayType} onChange={this.changeGatewayType(element.id)}>
            <Dropdown.Item value={'exclusive'}>
              {this.props.translate('packages.BPMNDiagram.BPMNExclusiveGateway')}
            </Dropdown.Item>
            <Dropdown.Item value={'parallel'}>
              {this.props.translate('packages.BPMNDiagram.BPMNParallelGateway')}
            </Dropdown.Item>
            <Dropdown.Item value={'inclusive'}>
              {this.props.translate('packages.BPMNDiagram.BPMNInclusiveGateway')}
            </Dropdown.Item>
            <Dropdown.Item value={'event-based'}>
              {this.props.translate('packages.BPMNDiagram.BPMNEventBasedGateway')}
            </Dropdown.Item>
            <Dropdown.Item value={'complex'}>
              {this.props.translate('packages.BPMNDiagram.BPMNComplexGateway')}
            </Dropdown.Item>
          </Dropdown>
        </section>
      </div>
    );
  }

  /**
   * Rename the gateway
   * @param id The ID of the gateway that should be renamed
   */
  private rename = (id: string) => (value: string) => {
    this.props.update(id, { name: value });
  };

  /**
   * Change the type of the gateway. If the new type cannot carry a default
   * flow (Parallel / Event-Based per BPMN 2.0.2 § 8.3.13), clear `isDefault`
   * on every outgoing sequence flow first.
   * @param id The ID of the gateway whose type should be changed
   */
  private changeGatewayType = (id: string) => (value: string) => {
    const newType = value as BPMNGatewayType;
    if (NO_DEFAULT_GATEWAY_TYPES.has(newType)) {
      for (const flowId of this.props.outgoingDefaultFlowIds) {
        this.props.update<BPMNFlow>(flowId, { isDefault: false });
      }
    }
    this.props.update<BPMNGateway>(id, { gatewayType: newType });
  };

  /**
   * Delete a gateway
   * @param id The ID of the gateway that should be deleted
   */
  private delete = (id: string) => () => {
    this.props.delete(id);
  };
}

export const BPMNGatewayUpdate = enhance(BPMNGatewayUpdateComponent);
