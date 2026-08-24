import React, { Component, ComponentType } from 'react';
import { connect, ConnectedComponent } from 'react-redux';
import { Button } from '../../../components/controls/button/button';
import { ColorButton } from '../../../components/controls/color-button/color-button';
import { TrashIcon } from '../../../components/controls/icon/trash';
import { Textfield } from '../../../components/controls/textfield/textfield';
import { ModelState } from '../../../components/store/model-state';
import { StylePane } from '../../../components/style-pane/style-pane';
import { styled } from '../../../components/theme/styles';
import { UMLElement } from '../../../services/uml-element/uml-element';
import { UMLElementRepository } from '../../../services/uml-element/uml-element-repository';
import { AsyncDispatch } from '../../../utils/actions/actions';
import { NNContainer } from './nn-container';

const Flex = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
`;

const Label = styled.label`
  display: block;
  margin-top: 1rem;
  margin-bottom: 0.5rem;
  font-weight: 500;
`;

const CheckboxLabel = styled.label`
  display: flex;
  align-items: center;
  margin-top: 1rem;
  cursor: pointer;

  input[type="checkbox"] {
    margin-right: 8px;
  }
`;

type State = {
  colorOpen: boolean;
  inputVarEnabled: boolean;
  returnVarsEnabled: boolean;
  inputVarError: string | null;
  returnVarsError: string | null;
};

class NNContainerUpdateComponent extends Component<Props, State> {
  state = {
    colorOpen: false,
    inputVarEnabled: !!(this.props.element as NNContainer).input_var,
    returnVarsEnabled: !!(this.props.element as NNContainer).return_vars,
    inputVarError: null,
    returnVarsError: null,
  };

  private toggleColor = () => {
    this.setState((state) => ({
      colorOpen: !state.colorOpen,
    }));
  };

  private onFieldChange = (id: string, values: { description?: string; uri?: string }) => {
    this.props.update(id, values);
  };

  private onUpdate = (name: string) => {
    const { element, update } = this.props;
    update(element.id, { name });
  };

  private toggleInputVar = () => {
    const newEnabled = !this.state.inputVarEnabled;
    this.setState({ inputVarEnabled: newEnabled, inputVarError: null });
    if (!newEnabled) {
      this.props.update(this.props.element.id, { input_var: undefined });
    }
  };

  private toggleReturnVars = () => {
    const newEnabled = !this.state.returnVarsEnabled;
    this.setState({ returnVarsEnabled: newEnabled, returnVarsError: null });
    if (!newEnabled) {
      this.props.update(this.props.element.id, { return_vars: undefined });
    }
  };

  private onInputVarChange = (value: string) => {
    const trimmed = value.trim();
    // Validate: must start with alphabet letter
    if (trimmed === '') {
      this.setState({ inputVarError: null });
      this.props.update(this.props.element.id, { input_var: undefined });
    } else if (/^[a-zA-Z]/.test(trimmed)) {
      this.setState({ inputVarError: null });
      this.props.update(this.props.element.id, { input_var: trimmed || undefined });
    } else {
      this.setState({ inputVarError: 'Must start with an alphabet letter (a-z, A-Z)' });
    }
  };

  private onReturnVarsChange = (value: string) => {
    const trimmed = value.trim();
    // Validate: must start with alphabet letter (or be comma-separated list of valid identifiers)
    if (trimmed === '') {
      this.setState({ returnVarsError: null });
      this.props.update(this.props.element.id, { return_vars: undefined });
    } else {
      // Split by comma and check each identifier
      const identifiers = trimmed.split(',').map(s => s.trim()).filter(s => s !== '');
      const allValid = identifiers.every(id => /^[a-zA-Z]/.test(id));

      if (allValid) {
        this.setState({ returnVarsError: null });
        this.props.update(this.props.element.id, { return_vars: trimmed || undefined });
      } else {
        this.setState({ returnVarsError: 'Each identifier must start with an alphabet letter (a-z, A-Z)' });
      }
    }
  };

  render() {
    const { element } = this.props;
    const container = element as NNContainer;

    return (
      <div>
        <section>
          <Flex>
            <Textfield value={element.name} onChange={this.onUpdate} autoFocus />
            <ColorButton onClick={this.toggleColor} />
            <Button color="link" tabIndex={-1} onClick={() => this.props.delete(element.id)}>
              <TrashIcon />
            </Button>
          </Flex>
        </section>
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
        <section>
          <CheckboxLabel>
            <input
              type="checkbox"
              checked={this.state.inputVarEnabled}
              onChange={this.toggleInputVar}
            />
            Input Variable
          </CheckboxLabel>
          {this.state.inputVarEnabled && (
            <>
              <Textfield
                value={container.input_var || ''}
                onChange={this.onInputVarChange}
                placeholder="e.g., x"
              />
              {this.state.inputVarError && (
                <span style={{ color: 'red', fontSize: '11px', display: 'block', marginTop: '4px' }}>
                  {this.state.inputVarError}
                </span>
              )}
            </>
          )}
        </section>
        <section>
          <CheckboxLabel>
            <input
              type="checkbox"
              checked={this.state.returnVarsEnabled}
              onChange={this.toggleReturnVars}
            />
            Return Variables
          </CheckboxLabel>
          {this.state.returnVarsEnabled && (
            <>
              <Textfield
                value={container.return_vars || ''}
                onChange={this.onReturnVarsChange}
                placeholder="e.g., y or rep, recon"
              />
              {this.state.returnVarsError && (
                <span style={{ color: 'red', fontSize: '11px', display: 'block', marginTop: '4px' }}>
                  {this.state.returnVarsError}
                </span>
              )}
            </>
          )}
        </section>
      </div>
    );
  }
}

type OwnProps = {
  element: UMLElement;
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

export const NNContainerUpdate: ConnectedComponent<ComponentType<Props>, OwnProps> = enhance(NNContainerUpdateComponent);