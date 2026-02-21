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
import { NNElementType, NNRelationshipType } from '../index';

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

  // Helper to check if attribute type is name_module_input
  private isNameModuleInputType = (attrType: string): boolean => {
    return attrType === NNElementType.NameModuleInputAttributeConv1D ||
           attrType === NNElementType.NameModuleInputAttributeConv2D ||
           attrType === NNElementType.NameModuleInputAttributeConv3D ||
           attrType === NNElementType.NameModuleInputAttributePooling ||
           attrType === NNElementType.NameModuleInputAttributeRNN ||
           attrType === NNElementType.NameModuleInputAttributeLSTM ||
           attrType === NNElementType.NameModuleInputAttributeGRU ||
           attrType === NNElementType.NameModuleInputAttributeLinear ||
           attrType === NNElementType.NameModuleInputAttributeFlatten ||
           attrType === NNElementType.NameModuleInputAttributeEmbedding ||
           attrType === NNElementType.NameModuleInputAttributeDropout ||
           attrType === NNElementType.NameModuleInputAttributeLayerNormalization ||
           attrType === NNElementType.NameModuleInputAttributeBatchNormalization;
  };

  // Helper to check if attribute type is layers_of_tensors
  private isLayersOfTensorsType = (attrType: string): boolean => {
    return attrType === NNElementType.LayersOfTensorsAttributeTensorOp;
  };

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
      // For name_module_input: don't create attribute yet, wait for user to select a value
      if (this.isNameModuleInputType(attributeType)) {
        // Just show the dropdown, attribute will be created when a value is selected
        return;
      }

      // For layers_of_tensors: don't create attribute yet, wait for user to select both values
      if (this.isLayersOfTensorsType(attributeType)) {
        // Just show the dropdowns, attribute will be created when both values are selected
        return;
      }

      // Create attribute only if it doesn't exist
      if (!existingAttribute) {
        const instance = new attributeCtor({ owner: layerId });

        // For Pooling kernel_dim, stride_dim, and output_dim, adjust value based on current dimension
        if (attributeType === NNElementType.KernelDimAttributePooling ||
            attributeType === NNElementType.StrideDimAttributePooling ||
            attributeType === NNElementType.OutputDimAttributePooling) {
          // Find the dimension attribute for this Pooling layer
          const dimensionAttr = Object.values(elements).find(
            (el: any) => el.owner === layerId && el.type === NNElementType.DimensionAttributePooling
          );
          const dimension = (dimensionAttr as any)?.value || '2D';

          // Set the correct value based on dimension
          if (attributeType === NNElementType.KernelDimAttributePooling) {
            switch (dimension) {
              case '1D': instance.value = '[3]'; break;
              case '3D': instance.value = '[3, 3, 3]'; break;
              default: instance.value = '[3, 3]'; break;
            }
          } else if (attributeType === NNElementType.StrideDimAttributePooling) {
            switch (dimension) {
              case '1D': instance.value = '[1]'; break;
              case '3D': instance.value = '[1, 1, 1]'; break;
              default: instance.value = '[1, 1]'; break;
            }
          } else if (attributeType === NNElementType.OutputDimAttributePooling) {
            // output_dim for adaptive pooling - list size matches dimension
            switch (dimension) {
              case '1D': instance.value = '[16]'; break;
              case '3D': instance.value = '[16, 16, 16]'; break;
              default: instance.value = '[16, 16]'; break;
            }
          }
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

    // For name_module_input: handle empty value specially
    if (this.isNameModuleInputType(attributeType)) {
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

    // Always use Redux value if available (handles external updates like dimension change)
    const localValue = attributeValue || '';

    // Check if this is a name_module_input attribute
    const isNameModuleInput = attributeType === NNElementType.NameModuleInputAttributeConv1D ||
                              attributeType === NNElementType.NameModuleInputAttributeConv2D ||
                              attributeType === NNElementType.NameModuleInputAttributeConv3D ||
                              attributeType === NNElementType.NameModuleInputAttributePooling ||
                              attributeType === NNElementType.NameModuleInputAttributeRNN ||
                              attributeType === NNElementType.NameModuleInputAttributeLSTM ||
                              attributeType === NNElementType.NameModuleInputAttributeGRU ||
                              attributeType === NNElementType.NameModuleInputAttributeLinear ||
                              attributeType === NNElementType.NameModuleInputAttributeFlatten ||
                              attributeType === NNElementType.NameModuleInputAttributeEmbedding ||
                              attributeType === NNElementType.NameModuleInputAttributeDropout ||
                              attributeType === NNElementType.NameModuleInputAttributeLayerNormalization ||
                              attributeType === NNElementType.NameModuleInputAttributeBatchNormalization;

    // Check if this is a layers_of_tensors attribute (TensorOp - requires two predecessors)
    const isLayersOfTensors = this.isLayersOfTensorsType(attributeType);
    // Use local state for tensor values (allows tracking before both are selected)
    const { tensor1, tensor2 } = this.state;

    // Check if this is a padding_type attribute
    const isPaddingType = attributeType === NNElementType.PaddingTypeAttributeConv1D ||
                          attributeType === NNElementType.PaddingTypeAttributeConv2D ||
                          attributeType === NNElementType.PaddingTypeAttributeConv3D ||
                          attributeType === NNElementType.PaddingTypeAttributePooling;
    const paddingTypeOptions = ['valid', 'same'];

    // Check if this is a tns_type attribute
    const isTnsType = attributeType === NNElementType.TnsTypeAttributeTensorOp;
    const tnsTypeOptions = ['reshape', 'concatenate', 'multiply', 'matmultiply', 'transpose', 'permute'];

    // Check if this is a return_type attribute
    const isReturnType = attributeType === NNElementType.ReturnTypeAttributeRNN ||
                         attributeType === NNElementType.ReturnTypeAttributeLSTM ||
                         attributeType === NNElementType.ReturnTypeAttributeGRU;
    const returnTypeOptions = ['hidden', 'last', 'full'];

    // Check if this is an actv_func attribute
    const isActvFunc = attributeType === NNElementType.ActvFuncAttributeConv1D ||
                       attributeType === NNElementType.ActvFuncAttributeConv2D ||
                       attributeType === NNElementType.ActvFuncAttributeConv3D ||
                       attributeType === NNElementType.ActvFuncAttributePooling ||
                       attributeType === NNElementType.ActvFuncAttributeRNN ||
                       attributeType === NNElementType.ActvFuncAttributeLSTM ||
                       attributeType === NNElementType.ActvFuncAttributeGRU ||
                       attributeType === NNElementType.ActvFuncAttributeLinear ||
                       attributeType === NNElementType.ActvFuncAttributeFlatten ||
                       attributeType === NNElementType.ActvFuncAttributeEmbedding ||
                       attributeType === NNElementType.ActvFuncAttributeLayerNormalization ||
                       attributeType === NNElementType.ActvFuncAttributeBatchNormalization;
    const actvFuncOptions = ['relu', 'leaky_relu', 'sigmoid', 'softmax', 'tanh'];

    // Check if this is a boolean attribute (permute_in, permute_out, input_reused, batch_first, bidirectional)
    const isBooleanAttr = attributeType === NNElementType.PermuteInAttributeConv1D ||
                          attributeType === NNElementType.PermuteOutAttributeConv1D ||
                          attributeType === NNElementType.PermuteInAttributeConv2D ||
                          attributeType === NNElementType.PermuteOutAttributeConv2D ||
                          attributeType === NNElementType.PermuteInAttributeConv3D ||
                          attributeType === NNElementType.PermuteOutAttributeConv3D ||
                          attributeType === NNElementType.PermuteInAttributePooling ||
                          attributeType === NNElementType.PermuteOutAttributePooling ||
                          attributeType === NNElementType.InputReusedAttributeConv1D ||
                          attributeType === NNElementType.InputReusedAttributeConv2D ||
                          attributeType === NNElementType.InputReusedAttributeConv3D ||
                          attributeType === NNElementType.InputReusedAttributePooling ||
                          attributeType === NNElementType.InputReusedAttributeRNN ||
                          attributeType === NNElementType.InputReusedAttributeLSTM ||
                          attributeType === NNElementType.InputReusedAttributeGRU ||
                          attributeType === NNElementType.InputReusedAttributeLinear ||
                          attributeType === NNElementType.InputReusedAttributeFlatten ||
                          attributeType === NNElementType.InputReusedAttributeEmbedding ||
                          attributeType === NNElementType.InputReusedAttributeDropout ||
                          attributeType === NNElementType.InputReusedAttributeLayerNormalization ||
                          attributeType === NNElementType.InputReusedAttributeBatchNormalization ||
                          attributeType === NNElementType.InputReusedAttributeTensorOp ||
                          attributeType === NNElementType.BidirectionalAttributeRNN ||
                          attributeType === NNElementType.BidirectionalAttributeLSTM ||
                          attributeType === NNElementType.BidirectionalAttributeGRU ||
                          attributeType === NNElementType.BatchFirstAttributeRNN ||
                          attributeType === NNElementType.BatchFirstAttributeLSTM ||
                          attributeType === NNElementType.BatchFirstAttributeGRU;
    const booleanOptions = ['true', 'false'];

    // Handle legacy 'zeros' value by defaulting to 'valid'
    // Handle legacy 'output' value by defaulting to 'last' for return_type
    const displayValue = isPaddingType && localValue === 'zeros' ? 'valid' :
                         isReturnType && localValue === 'output' ? 'last' :
                         localValue;

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
              isLayersOfTensors ? (
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
              ) : isNameModuleInput ? (
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
              ) : isPaddingType ? (
                <Dropdown
                  value={displayValue || 'valid'}
                  onChange={this.handleValueChange}
                  size="sm"
                  outline
                >
                  {paddingTypeOptions.map(option => (
                    <Dropdown.Item key={option} value={option}>
                      {option}
                    </Dropdown.Item>
                  ))}
                </Dropdown>
              ) : isTnsType ? (
                <Dropdown
                  value={displayValue || 'reshape'}
                  onChange={this.handleValueChange}
                  size="sm"
                  outline
                >
                  {tnsTypeOptions.map(option => (
                    <Dropdown.Item key={option} value={option}>
                      {option}
                    </Dropdown.Item>
                  ))}
                </Dropdown>
              ) : isReturnType ? (
                <Dropdown
                  value={displayValue || 'last'}
                  onChange={this.handleValueChange}
                  size="sm"
                  outline
                >
                  {returnTypeOptions.map(option => (
                    <Dropdown.Item key={option} value={option}>
                      {option}
                    </Dropdown.Item>
                  ))}
                </Dropdown>
              ) : isActvFunc ? (
                <Dropdown
                  value={displayValue || 'relu'}
                  onChange={this.handleValueChange}
                  size="sm"
                  outline
                >
                  {actvFuncOptions.map(option => (
                    <Dropdown.Item key={option} value={option}>
                      {option}
                    </Dropdown.Item>
                  ))}
                </Dropdown>
              ) : isBooleanAttr ? (
                <Dropdown
                  value={displayValue || 'false'}
                  onChange={this.handleValueChange}
                  size="sm"
                  outline
                >
                  {booleanOptions.map(option => (
                    <Dropdown.Item key={option} value={option}>
                      {option}
                    </Dropdown.Item>
                  ))}
                </Dropdown>
              ) : (
                <Textfield
                  gutter
                  value={localValue}
                  onChange={this.handleValueChange}
                  placeholder="value"
                  style={{ flexGrow: 1 }}
                />
              )
            ) : (
              <span style={{ color: '#999' }}>unchecked</span>
            )}
          </AttributeInputContainer>
        </div>
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
    return (nameAttr as any)?.value || element.name || null;
  };

  // Recursively find all predecessors
  const findPredecessors = (targetId: string) => {
    // Get all NNNext relationships where this element is the target
    const incomingRelationships = Object.values(state.elements).filter(
      (el: any) => el.type === NNRelationshipType.NNNext && el.target?.element === targetId
    );

    for (const rel of incomingRelationships) {
      const sourceId = (rel as any).source?.element;
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
    attributeValue: (existingAttribute as any)?.value,  // Explicit value to trigger re-render
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
