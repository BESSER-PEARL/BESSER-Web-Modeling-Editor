import React, { Component, ComponentClass } from 'react';
import { connect } from 'react-redux';
import { compose } from 'redux';
import styled from 'styled-components';
import { Textfield } from '../../../components/controls/textfield/textfield';
import { Dropdown } from '../../../components/controls/dropdown/dropdown';
import { ModelState } from '../../../components/store/model-state';
import { UMLElementRepository } from '../../../services/uml-element/uml-element-repository';
import { UMLContainerRepository } from '../../../services/uml-container/uml-container-repository';
import { Conv1DAttribute } from '../nn-conv1d-attributes/conv1d-attributes';
import { INNAttribute } from '../nn-component-attribute';
import { IUMLRelationship } from '../../../services/uml-relationship/uml-relationship';
import { NNRelationshipType } from '../index';
import { getAttributeDefaultValue, LIST_STRICT_REGEX, LIST_PERMISSIVE_REGEX, getListExpectation } from '../nn-validation-defaults';
import { getWidgetConfig } from '../nn-attribute-widget-config';

const AttributeInputContainer = styled.div`
  display: flex;
  align-items: center;
  flex-grow: 1;
  margin-right: 8px;
`;

const AttributeLabel = styled.span`
  font-family: inherit;
  font-size: inherit;
  color: inherit;
  margin-right: 4px;
  white-space: nowrap;
`;

interface OwnProps {
  attributeType: string;
  attributeCtor: any;
  label: string;
  layerId: string;
}

interface StateProps {
  existingAttribute: any | undefined;  // Don't check type, just use plain object
  elements: ModelState['elements'];  // Access to all elements for dimension lookup
  attributeValue: string | undefined;  // Explicit value tracking to force re-render on value changes
  predecessorNames: string[];  // Names of layers/tensor ops that come before this layer via NNNext
}

interface DispatchProps {
  create: typeof UMLElementRepository.create;
  update: typeof UMLElementRepository.update;
  delete: typeof UMLElementRepository.delete;
  appendToParent: (elementId: string, parentId: string) => void;
}

type Props = OwnProps & StateProps & DispatchProps;

interface LocalState {
  localValue: string;
  isChecked: boolean;
  // For layers_of_tensors - track selections before both are filled
  tensor1: string;
  tensor2: string;
  validationError: string | null;
  submitResetKey: number;
}

class OptionalAttributeRowComponent extends Component<Props, LocalState> {
  constructor(props: Props) {
    super(props);
    // Parse layers_of_tensors value if present
    const initialValue = props.existingAttribute?.value || '';
    const [t1, t2] = this.parseLayersOfTensors(initialValue);
    this.state = {
      localValue: initialValue,
      isChecked: !!props.existingAttribute,
      tensor1: t1,
      tensor2: t2,
      validationError: null,
      submitResetKey: 0,
    };
  }

  componentDidUpdate(prevProps: Props) {
    // Update local state when Redux state changes
    if (!prevProps.existingAttribute && this.props.existingAttribute) {
      const newValue = this.props.existingAttribute.value || '';
      const [t1, t2] = this.parseLayersOfTensors(newValue);
      this.setState({
        localValue: newValue,
        isChecked: true,
        tensor1: t1,
        tensor2: t2,
      });
    } else if (prevProps.existingAttribute && !this.props.existingAttribute) {
      this.setState({
        localValue: '',
        isChecked: false,
        tensor1: '',
        tensor2: '',
      });
    } else if (prevProps.attributeValue !== this.props.attributeValue &&
               this.props.existingAttribute) {
      // Sync local state with Redux when value changes externally (e.g., dimension change)
      const newValue = this.props.existingAttribute.value || '';
      const [t1, t2] = this.parseLayersOfTensors(newValue);
      this.setState({
        localValue: newValue,
        tensor1: t1,
        tensor2: t2,
      });
    }
  }

  // Parse layers_of_tensors value like "['a', 'b']" into [tensor1, tensor2]
  private parseLayersOfTensors = (value: string): [string, string] => {
    if (!value || value === '[]') return ['', ''];
    // Remove brackets and split by comma
    const cleaned = value.replace(/^\[|\]$/g, '').replace(/'/g, '');
    const parts = cleaned.split(',').map(s => s.trim());
    return [parts[0] || '', parts[1] || ''];
  };

  // Format two tensors into layers_of_tensors value
  private formatLayersOfTensors = (tensor1: string, tensor2: string): string => {
    if (!tensor1 && !tensor2) return '[]';
    if (!tensor1 || !tensor2) return '[]'; // Both are required
    return `['${tensor1}', '${tensor2}']`;
  };

  private handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const { existingAttribute, attributeCtor, layerId, attributeType, elements } = this.props;
    const isChecking = e.target.checked;

    // Update local state immediately for responsive UI
    this.setState({ isChecked: isChecking });

    if (isChecking) {
      const config = getWidgetConfig(attributeType);

      // For predecessor / layers_of_tensors: don't create attribute yet, wait for user selection
      if (config.widget === 'predecessor' || config.widget === 'layers_of_tensors') {
        return;
      }

      // Create attribute only if it doesn't exist
      if (!existingAttribute) {
        const instance = new attributeCtor({ owner: layerId });

        // Apply dimension-aware initial value if defined in config (e.g. pooling kernel/stride/output)
        if (config.getInitialValue) {
          instance.value = config.getInitialValue(elements, layerId);
          instance.name = `${instance.attributeName} = ${instance.value}`;
        }

        this.props.create(instance, layerId);
        // Also add to parent's ownedElements so it persists
        this.props.appendToParent(instance.id, layerId);
        this.setState({ localValue: instance.value || '', isChecked: true });
      }
    } else {
      // Delete attribute - these are optional so they can be deleted
      if (existingAttribute && !existingAttribute.isMandatory) {
        this.props.delete(existingAttribute.id);
        this.setState({ localValue: '', isChecked: false, tensor1: '', tensor2: '' });
      } else {
        // No attribute exists, just reset local state
        this.setState({ isChecked: false, tensor1: '', tensor2: '' });
      }
    }
  };

  private handleValueChange = (newValue: string | number) => {
    const valueStr = String(newValue);
    const { existingAttribute, attributeCtor, layerId, attributeType } = this.props;

    // For predecessor: handle empty value specially (create on select, delete on clear)
    if (getWidgetConfig(attributeType).widget === 'predecessor') {
      if (valueStr === '') {
        // Empty value selected - delete the attribute if it exists
        if (existingAttribute) {
          this.props.delete(existingAttribute.id);
          this.setState({ localValue: '', isChecked: false });
        }
        return;
      } else if (!existingAttribute) {
        // Non-empty value selected but attribute doesn't exist - create it
        const instance = new attributeCtor({ owner: layerId });
        instance.value = valueStr;
        instance.name = `${instance.attributeName} = ${valueStr}`;
        this.props.create(instance, layerId);
        this.props.appendToParent(instance.id, layerId);
        this.setState({ localValue: valueStr, isChecked: true });
        return;
      }
    }

    if (existingAttribute) {
      this.props.update<Conv1DAttribute>(existingAttribute.id, {
        value: valueStr,
        name: `${existingAttribute.attributeName} = ${valueStr}`
      } as Partial<Conv1DAttribute>);
    }
  };

  private handleValidatedTextChange = (newValue: string | number) => {
    const { existingAttribute } = this.props;
    const str = String(newValue);
    const attrType = existingAttribute?.attributeType;

    if (attrType === 'int') {
      if (str === '' || str === '-') {
        this.setState({ validationError: null });
      } else if (/^-?\d+$/.test(str)) {
        this.setState({ validationError: null });
        this.props.update<Conv1DAttribute>(existingAttribute!.id, {
          value: str, name: `${existingAttribute!.attributeName} = ${str}`
        } as Partial<Conv1DAttribute>);
      } else {
        this.setState({ validationError: `Must be an integer. Example: ${getAttributeDefaultValue(existingAttribute!)}` });
      }
    } else if (attrType === 'float') {
      const isIntermediate = str === '' || str === '-' || str === '.' || /^-?\d*\.$/.test(str);
      const isValid = !isIntermediate && !isNaN(Number(str)) && str !== '';
      if (isIntermediate) {
        this.setState({ validationError: null });
      } else if (isValid) {
        this.setState({ validationError: null });
        this.props.update<Conv1DAttribute>(existingAttribute!.id, {
          value: str, name: `${existingAttribute!.attributeName} = ${str}`
        } as Partial<Conv1DAttribute>);
      } else {
        this.setState({ validationError: `Must be a number. Example: ${getAttributeDefaultValue(existingAttribute!)}` });
      }
    } else if (attrType === 'List') {
      if (str === '' || LIST_PERMISSIVE_REGEX.test(str)) {
        if (LIST_STRICT_REGEX.test(str)) {
          const expected = getListExpectation(existingAttribute!.type, existingAttribute!.owner, this.props.elements);
          if (expected.count !== null) {
            const actualCount = str.replace(/^\[|\]$/g, '').split(',').filter((s) => s.trim() !== '').length;
            if (actualCount !== expected.count) {
              this.setState({ validationError: `Must be a list with ${expected.count} integer${expected.count > 1 ? 's' : ''}. Example: ${expected.example}` });
              return;
            }
          }
          this.setState({ validationError: null });
          this.props.update<Conv1DAttribute>(existingAttribute!.id, {
            value: str, name: `${existingAttribute!.attributeName} = ${str}`
          } as Partial<Conv1DAttribute>);
        } else {
          this.setState({ validationError: null });
        }
      } else {
        const expected = getListExpectation(existingAttribute!.type, existingAttribute!.owner, this.props.elements);
        const countMsg = expected.count !== null ? ` with ${expected.count} integer${expected.count > 1 ? 's' : ''}` : ' of integers';
        this.setState({ validationError: `Must be a list${countMsg}. Example: ${expected.example}` });
      }
    } else {
      this.handleValueChange(newValue);
    }
  };

  private handleValidatedTextSubmit = (newValue: string | number) => {
    const { existingAttribute } = this.props;
    const str = String(newValue).trim();
    const attrType = existingAttribute?.attributeType;

    if (attrType === 'int') {
      if (/^-?\d+$/.test(str)) {
        this.setState({ validationError: null });
        this.props.update<Conv1DAttribute>(existingAttribute!.id, {
          value: str, name: `${existingAttribute!.attributeName} = ${str}`
        } as Partial<Conv1DAttribute>);
      } else {
        const defaultVal = getAttributeDefaultValue(existingAttribute!);
        this.props.update<Conv1DAttribute>(existingAttribute!.id, {
          value: defaultVal, name: `${existingAttribute!.attributeName} = ${defaultVal}`
        } as Partial<Conv1DAttribute>);
        const errorMsg = (str === '' || str === '-') ? null : `Must be an integer. Example: ${defaultVal}`;
        this.setState((s) => ({ validationError: errorMsg, submitResetKey: s.submitResetKey + 1 }));
      }
    } else if (attrType === 'float') {
      if (!isNaN(Number(str)) && str !== '' && str !== '-' && str !== '.') {
        this.setState({ validationError: null });
        this.props.update<Conv1DAttribute>(existingAttribute!.id, {
          value: str, name: `${existingAttribute!.attributeName} = ${str}`
        } as Partial<Conv1DAttribute>);
      } else {
        const defaultVal = getAttributeDefaultValue(existingAttribute!);
        this.props.update<Conv1DAttribute>(existingAttribute!.id, {
          value: defaultVal, name: `${existingAttribute!.attributeName} = ${defaultVal}`
        } as Partial<Conv1DAttribute>);
        const isIncomplete = str === '' || str === '-' || str === '.';
        const errorMsg = isIncomplete ? null : `Must be a number. Example: ${defaultVal}`;
        this.setState((s) => ({ validationError: errorMsg, submitResetKey: s.submitResetKey + 1 }));
      }
    } else if (attrType === 'List') {
      if (LIST_STRICT_REGEX.test(str)) {
        const expected = getListExpectation(existingAttribute!.type, existingAttribute!.owner, this.props.elements);
        if (expected.count !== null) {
          const actualCount = str.replace(/^\[|\]$/g, '').split(',').filter((s) => s.trim() !== '').length;
          if (actualCount !== expected.count) {
            const defaultVal = expected.example;
            this.props.update<Conv1DAttribute>(existingAttribute!.id, {
              value: defaultVal, name: `${existingAttribute!.attributeName} = ${defaultVal}`
            } as Partial<Conv1DAttribute>);
            this.setState((s) => ({
              validationError: `Must be a list with ${expected.count} integer${expected.count! > 1 ? 's' : ''}. Example: ${expected.example}`,
              submitResetKey: s.submitResetKey + 1,
            }));
            return;
          }
        }
        this.setState({ validationError: null });
        this.props.update<Conv1DAttribute>(existingAttribute!.id, {
          value: str, name: `${existingAttribute!.attributeName} = ${str}`
        } as Partial<Conv1DAttribute>);
      } else if (str === '' || LIST_PERMISSIVE_REGEX.test(str)) {
        const defaultVal = getListExpectation(existingAttribute!.type, existingAttribute!.owner, this.props.elements).example;
        this.props.update<Conv1DAttribute>(existingAttribute!.id, {
          value: defaultVal, name: `${existingAttribute!.attributeName} = ${defaultVal}`
        } as Partial<Conv1DAttribute>);
        this.setState((s) => ({ validationError: null, submitResetKey: s.submitResetKey + 1 }));
      } else {
        const expected = getListExpectation(existingAttribute!.type, existingAttribute!.owner, this.props.elements);
        const defaultVal = expected.example;
        this.props.update<Conv1DAttribute>(existingAttribute!.id, {
          value: defaultVal, name: `${existingAttribute!.attributeName} = ${defaultVal}`
        } as Partial<Conv1DAttribute>);
        const countMsg = expected.count !== null ? ` with ${expected.count} integer${expected.count > 1 ? 's' : ''}` : ' of integers';
        this.setState((s) => ({
          validationError: `Must be a list${countMsg}. Example: ${expected.example}`,
          submitResetKey: s.submitResetKey + 1,
        }));
      }
    } else {
      this.handleValueChange(newValue);
    }
  };

  // Handler for layers_of_tensors tensor selection (index: 0 = first, 1 = second)
  private handleTensorChange = (tensorIndex: 0 | 1) => (newValue: string | number) => {
    const valueStr = String(newValue);
    const { existingAttribute, attributeCtor, layerId } = this.props;

    // Get current tensors from local state
    const { tensor1: currentTensor1, tensor2: currentTensor2 } = this.state;

    // Update the appropriate tensor
    const tensor1 = tensorIndex === 0 ? valueStr : currentTensor1;
    const tensor2 = tensorIndex === 1 ? valueStr : currentTensor2;

    // Update local state immediately
    this.setState({ tensor1, tensor2 });

    // Check if both tensors are selected
    const bothSelected = tensor1 !== '' && tensor2 !== '';

    if (bothSelected) {
      const formattedValue = this.formatLayersOfTensors(tensor1, tensor2);

      if (!existingAttribute) {
        // Create the attribute with both values
        const instance = new attributeCtor({ owner: layerId });
        instance.value = formattedValue;
        instance.name = `${instance.attributeName} = ${formattedValue}`;
        this.props.create(instance, layerId);
        this.props.appendToParent(instance.id, layerId);
        this.setState({ localValue: formattedValue, isChecked: true });
      } else {
        // Update the attribute
        this.props.update<Conv1DAttribute>(existingAttribute.id, {
          value: formattedValue,
          name: `${existingAttribute.attributeName} = ${formattedValue}`
        } as Partial<Conv1DAttribute>);
      }
    } else {
      // Not both selected - delete attribute if it exists
      if (existingAttribute) {
        this.props.delete(existingAttribute.id);
        this.setState({ localValue: '' });
      }
    }
  };

  render() {
    const { label, attributeType, attributeValue, predecessorNames } = this.props;
    const { isChecked } = this.state;
    const config = getWidgetConfig(attributeType);

    // Always use Redux value if available (handles external updates like dimension change)
    const localValue = attributeValue || '';

    // For dropdowns: if the stored value is not in the options list (e.g. legacy values like
    // 'zeros' for padding or 'output' for return_type), fall back to the config's defaultValue.
    const displayValue = (config.widget === 'dropdown' && config.options && !config.options.includes(localValue))
      ? config.defaultValue ?? ''
      : localValue;

    // Use local state for tensor values (allows tracking before both are selected)
    const { tensor1, tensor2 } = this.state;

    return (
      <div style={{ marginTop: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
          <input
            type="checkbox"
            checked={isChecked}
            onChange={this.handleCheckboxChange}
          />
          <AttributeInputContainer>
            <AttributeLabel>{label} = </AttributeLabel>
            {isChecked ? (
              config.widget === 'layers_of_tensors' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexGrow: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '11px', minWidth: '25px' }}>1st:</span>
                    <Dropdown
                      value={tensor1 || ''}
                      onChange={this.handleTensorChange(0)}
                      size="sm"
                      outline
                    >
                      {[
                        <Dropdown.Item key="__empty__" value="">
                          {'(select)'}
                        </Dropdown.Item>,
                        ...predecessorNames.map(name => (
                          <Dropdown.Item key={name} value={name}>
                            {name}
                          </Dropdown.Item>
                        ))
                      ]}
                    </Dropdown>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '11px', minWidth: '25px' }}>2nd:</span>
                    <Dropdown
                      value={tensor2 || ''}
                      onChange={this.handleTensorChange(1)}
                      size="sm"
                      outline
                    >
                      {[
                        <Dropdown.Item key="__empty__" value="">
                          {'(select)'}
                        </Dropdown.Item>,
                        ...predecessorNames.map(name => (
                          <Dropdown.Item key={name} value={name}>
                            {name}
                          </Dropdown.Item>
                        ))
                      ]}
                    </Dropdown>
                  </div>
                </div>
              ) : config.widget === 'predecessor' ? (
                <Dropdown
                  value={localValue || ''}
                  onChange={this.handleValueChange}
                  size="sm"
                  outline
                >
                  {[
                    <Dropdown.Item key="__empty__" value="">
                      {'(select predecessor)'}
                    </Dropdown.Item>,
                    ...predecessorNames.map(name => (
                      <Dropdown.Item key={name} value={name}>
                        {name}
                      </Dropdown.Item>
                    ))
                  ]}
                </Dropdown>
              ) : config.widget === 'dropdown' ? (
                <Dropdown
                  value={displayValue || config.defaultValue || ''}
                  onChange={this.handleValueChange}
                  size="sm"
                  outline
                >
                  {config.options!.map(option => (
                    <Dropdown.Item key={option} value={option}>
                      {option}
                    </Dropdown.Item>
                  ))}
                </Dropdown>
              ) : (
                <Textfield
                  key={this.state.submitResetKey}
                  gutter
                  value={localValue}
                  onChange={this.handleValidatedTextChange}
                  onSubmit={this.handleValidatedTextSubmit}
                  placeholder="value"
                  style={{ flexGrow: 1 }}
                />
              )
            ) : (
              <span style={{ color: '#999' }}>unchecked</span>
            )}
          </AttributeInputContainer>
        </div>
        {this.state.validationError && (
          <span style={{ color: 'red', fontSize: '11px', display: 'block', marginLeft: '24px' }}>
            {this.state.validationError}
          </span>
        )}
      </div>
    );
  }
}

// Find attribute by type and owner, don't use instanceof
const mapStateToProps = (state: ModelState, ownProps: OwnProps): StateProps => {
  const existingAttribute = Object.values(state.elements).find(
    (el) =>
      el.owner === ownProps.layerId &&
      el.type === ownProps.attributeType
  );

  // Find ALL predecessors via NNNext relationships (traverse backwards through the chain)
  const predecessorNames: string[] = [];
  const visitedIds = new Set<string>();

  // Helper function to get the name of a layer/tensor op
  const getElementName = (elementId: string): string | null => {
    const element = state.elements[elementId];
    if (!element) return null;

    // Get the name attribute value from the layer/tensor op
    const nameAttr = Object.values(state.elements).find(
      (el: any) => el.owner === elementId && el.type?.includes('NameAttribute')
    );
    return (nameAttr as INNAttribute)?.value || element.name || null;
  };

  // Recursively find all predecessors
  const findPredecessors = (targetId: string) => {
    // Get all NNNext relationships where this element is the target
    const incomingRelationships = Object.values(state.elements).filter(
      (el: any) => el.type === NNRelationshipType.NNNext && el.target?.element === targetId
    );

    for (const rel of incomingRelationships) {
      const sourceId = (rel as IUMLRelationship).source?.element;
      if (sourceId && !visitedIds.has(sourceId)) {
        visitedIds.add(sourceId);
        const name = getElementName(sourceId);
        if (name) {
          predecessorNames.push(name);
        }
        // Recursively find predecessors of this source
        findPredecessors(sourceId);
      }
    }
  };

  // Start finding predecessors from the current layer
  findPredecessors(ownProps.layerId);

  return {
    existingAttribute,
    elements: state.elements,
    attributeValue: (existingAttribute as INNAttribute)?.value,  // Explicit value to trigger re-render
    predecessorNames,
  };
};

const enhance = compose<ComponentClass<OwnProps>>(
  connect<StateProps, DispatchProps, OwnProps, ModelState>(
    mapStateToProps,
    {
      create: UMLElementRepository.create,
      update: UMLElementRepository.update,
      delete: UMLElementRepository.delete,
      appendToParent: UMLContainerRepository.append,
    },
    null,  // mergeProps
    { pure: false }  // Disable shallow comparison to ensure re-render on Redux updates
  ),
);

export const OptionalAttributeRow = enhance(OptionalAttributeRowComponent);