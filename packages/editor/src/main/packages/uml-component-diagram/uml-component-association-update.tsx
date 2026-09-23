import React, { Component, ComponentClass } from 'react';
import { connect } from 'react-redux';
import { compose } from 'redux';
import { ComponentRelationshipType } from '.';
import { Button } from '../../components/controls/button/button';
import { Divider } from '../../components/controls/divider/divider';
import { Dropdown } from '../../components/controls/dropdown/dropdown';
import { Textfield } from '../../components/controls/textfield/textfield';
import { ExchangeIcon } from '../../components/controls/icon/exchange';
import { TrashIcon } from '../../components/controls/icon/trash';
import { Body, Header } from '../../components/controls/typography/typography';
import { I18nContext } from '../../components/i18n/i18n-context';
import { localized } from '../../components/i18n/localized';
import { ModelState } from '../../components/store/model-state';
import { styled } from '../../components/theme/styles';
import { UMLElementRepository } from '../../services/uml-element/uml-element-repository';
import { UMLRelationshipRepository } from '../../services/uml-relationship/uml-relationship-repository';
import { UMLRelationship } from '../../services/uml-relationship/uml-relationship';
import { ColorButton } from '../../components/controls/color-button/color-button';
import { StylePane } from '../../components/style-pane/style-pane';
import { COMPONENT_EDGE_STEREOTYPE_PRESETS } from '../common/agentic/agentic-tokens';
import { LineageSourceLink } from '../../components/lineage/LineageSourceLink';

const Flex = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
`;

/** Makes the editor's content-sized Dropdown fill the popup row like a
 *  Textfield: the button stretches to 100 % and left-aligns its label. */
const PresetField = styled.div`
  width: 100%;

  button {
    width: 100%;
    text-align: left;
  }
`;

type State = { colorOpen: boolean };

class ComponentAssociationUpdate extends Component<Props, State> {
  state = { colorOpen: false };

  private toggleColor = () => {
    this.setState((state) => ({
      colorOpen: !state.colorOpen,
    }));
  };

  render() {
    const { element } = this.props;
    const isDependency = element.type === ComponentRelationshipType.ComponentDependency;
    const stereotype = (element as unknown as { stereotype?: string }).stereotype ?? '';

    return (
      <div>
        <section>
          <Flex>
            <Header gutter={false} style={{ flexGrow: 1 }}>
              {this.props.translate('popup.association')}
            </Header>
            <ColorButton onClick={this.toggleColor} />
            <Button color="link" onClick={() => this.props.flip(element.id)}>
              <ExchangeIcon />
            </Button>
            <Button color="link" tabIndex={-1} onClick={() => this.props.delete(element.id)}>
              <TrashIcon />
            </Button>
          </Flex>
          <StylePane open={this.state.colorOpen} element={element} onColorChange={this.props.update} lineColor />
          <Divider />
        </section>
        <section>
          <Dropdown value={element.type as keyof typeof ComponentRelationshipType} onChange={this.onChange}>
            <Dropdown.Item value={ComponentRelationshipType.ComponentDependency}>
              {this.props.translate('packages.ComponentDiagram.ComponentDependency')}
            </Dropdown.Item>
            <Dropdown.Item value={ComponentRelationshipType.ComponentInterfaceProvided}>
              {this.props.translate('packages.ComponentDiagram.ComponentInterfaceProvided')}
            </Dropdown.Item>
            <Dropdown.Item value={ComponentRelationshipType.ComponentInterfaceRequired}>
              {this.props.translate('packages.ComponentDiagram.ComponentInterfaceRequired')}
            </Dropdown.Item>
          </Dropdown>
        </section>
        {isDependency && (
          <>
            <Divider />
            <section>
              <Flex>
                <Body style={{ width: '6em', flexShrink: 0, marginRight: '0.5em' }}>Stereotype</Body>
                <Textfield
                  value={stereotype}
                  onChange={this.onStereotypeChange}
                  placeholder="e.g. delegates, has, uses"
                />
              </Flex>
              <Flex>
                <Body style={{ width: '6em', flexShrink: 0, marginRight: '0.5em' }}>Preset</Body>
                <PresetField>
                  <Dropdown value={stereotype} onChange={this.onStereotypeChange} placeholder="Choose a preset…">
                    {COMPONENT_EDGE_STEREOTYPE_PRESETS.map((token) => (
                      <Dropdown.Item key={token} value={token}>
                        {token}
                      </Dropdown.Item>
                    ))}
                  </Dropdown>
                </PresetField>
              </Flex>
            </section>
          </>
        )}
        {/* Self-gating: only renders for derived ComponentDependencies. */}
        <LineageSourceLink elementId={element.id} />
      </div>
    );
  }

  private onChange = (value: keyof typeof ComponentRelationshipType) => {
    const { element, update } = this.props;
    update(element.id, { type: value });
  };

  private onStereotypeChange = (value: string) => {
    const { element, update } = this.props;
    update(element.id, { stereotype: value } as any);
  };
}

type OwnProps = {
  element: UMLRelationship;
};

type StateProps = {};

type DispatchProps = {
  update: typeof UMLElementRepository.update;
  delete: typeof UMLElementRepository.delete;
  flip: typeof UMLRelationshipRepository.flip;
};

type Props = OwnProps & StateProps & DispatchProps & I18nContext;

const enhance = compose<ComponentClass<OwnProps>>(
  localized,
  connect<StateProps, DispatchProps, OwnProps, ModelState>(null, {
    update: UMLElementRepository.update,
    delete: UMLElementRepository.delete,
    flip: UMLRelationshipRepository.flip,
  }),
);

export const UMLComponentAssociationUpdate = enhance(ComponentAssociationUpdate);
