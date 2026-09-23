import React, { Component, ComponentType } from 'react';
import { connect, ConnectedComponent } from 'react-redux';
import { Button } from '../../../components/controls/button/button';
import { ColorButton } from '../../../components/controls/color-button/color-button';
import { Divider } from '../../../components/controls/divider/divider';
import { TrashIcon } from '../../../components/controls/icon/trash';
import { Textfield } from '../../../components/controls/textfield/textfield';
import { Body } from '../../../components/controls/typography/typography';
import { ModelState } from '../../../components/store/model-state';
import { StylePane } from '../../../components/style-pane/style-pane';
import { styled } from '../../../components/theme/styles';
import { UMLElementRepository } from '../../../services/uml-element/uml-element-repository';
import { AsyncDispatch } from '../../../utils/actions/actions';
import { IUMLComponent, UMLComponent } from './uml-component';
import { StereotypeToggle } from '../../../components/controls/stereotype-toggle/stereotype-toggle';
import { Dropdown } from '../../../components/controls/dropdown/dropdown';
import { COMPONENT_STEREOTYPE_PRESETS } from '../agentic/agentic-tokens';
import { LineageSourceLink } from '../../../components/lineage/LineageSourceLink';
import { ElementPickerField } from '../../../components/element-picker/ElementPickerField';

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

class ComponentUpdate extends Component<Props, State> {
  state = { colorOpen: false };

  private toggleColor = () => {
    this.setState((state) => ({
      colorOpen: !state.colorOpen,
    }));
  };

  private onFieldChange = (id: string, values: { description?: string; uri?: string }) => {
    this.props.update(id, values);
  };

  render() {
    const { element } = this.props;

    return (
      <div>
        <section>
          <Flex>
            <Textfield value={element.name} onChange={this.onRename} autoFocus />
            <ColorButton onClick={this.toggleColor} />
            <StereotypeToggle value={element.displayStereotype} onChange={this.onStereotypeVisibilityToggle} />
            <Button color="link" tabIndex={-1} onClick={() => this.props.delete(element.id)}>
              <TrashIcon />
            </Button>
          </Flex>
        </section>
        <section>
          <Divider />
          <Flex>
            <Body style={{ width: '6em', flexShrink: 0, marginRight: '0.5em' }}>Stereotype</Body>
            <Textfield
              value={element.stereotype}
              onChange={this.onStereotypeRename}
              placeholder="e.g. solution, skill, external"
            />
          </Flex>
          <Flex>
            <Body style={{ width: '6em', flexShrink: 0, marginRight: '0.5em' }}>Preset</Body>
            <PresetField>
              <Dropdown value={element.stereotype} onChange={this.onStereotypeRename} placeholder="Choose a preset…">
                {COMPONENT_STEREOTYPE_PRESETS.map((token) => (
                  <Dropdown.Item key={token} value={token}>
                    {token}
                  </Dropdown.Item>
                ))}
              </Dropdown>
            </PresetField>
          </Flex>
        </section>
        {/* `realizes` picker: Component-diagram Component only (not the
            Deployment diagram's Component). Self-gates to render nothing when
            the host registers no element-picker provider. */}
        {element.type === 'Component' && (
          <section>
            <Divider />
            <ElementPickerField
              label="Realizes"
              selected={(element as IUMLComponent).realizes ?? []}
              typeTokens={['Class', 'AbstractClass', 'Interface', 'Enumeration']}
              onChange={this.onRealizesChange}
            />
          </section>
        )}
        <StylePane
          open={this.state.colorOpen}
          element={element}
          onColorChange={this.props.update}
          onFieldChange={this.onFieldChange}
          showDescription
          showUri
          lineColor
          textColor
          fillColor
        />
        {/* Self-gating: renders nothing for non-derived elements. */}
        <LineageSourceLink elementId={element.id} />
      </div>
    );
  }

  private onRename = (value: string) => {
    const { element, update } = this.props;
    update<IUMLComponent>(element.id, { name: value });
  };

  private onStereotypeVisibilityToggle = () => {
    const { element, update } = this.props;
    const newVisibilityValue = !element.displayStereotype;
    update<IUMLComponent>(element.id, { displayStereotype: newVisibilityValue });
  };

  private onStereotypeRename = (value: string) => {
    const { element, update } = this.props;
    update<IUMLComponent>(element.id, { stereotype: value });
  };

  private onRealizesChange = (value: string[]) => {
    const { element, update } = this.props;
    update<IUMLComponent>(element.id, { realizes: value });
  };
}

type OwnProps = {
  element: UMLComponent;
};

type StateProps = {};

type DispatchProps = {
  update: typeof UMLElementRepository.update;
  delete: AsyncDispatch<typeof UMLElementRepository.delete>;
};

type Props = OwnProps & StateProps & DispatchProps;

const enhance = connect<StateProps, DispatchProps, OwnProps, ModelState>(null, {
  update: UMLElementRepository.update,
  delete: UMLElementRepository.delete,
});

export const UMLComponentUpdate: ConnectedComponent<ComponentType<Props>, OwnProps> = enhance(ComponentUpdate);
