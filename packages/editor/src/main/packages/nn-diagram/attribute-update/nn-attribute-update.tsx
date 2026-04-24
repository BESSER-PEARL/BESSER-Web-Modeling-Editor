import React, { Component, ComponentClass, createRef } from 'react';
import styled from 'styled-components';
import { Button } from '../../../components/controls/button/button';
import { ColorButton } from '../../../components/controls/color-button/color-button';
import { TrashIcon } from '../../../components/controls/icon/trash';
import { Textfield } from '../../../components/controls/textfield/textfield';
import { Dropdown } from '../../../components/controls/dropdown/dropdown';
import { StylePane } from '../../../components/style-pane/style-pane';
import { DropdownButton } from '../../../components/controls/dropdown/dropdown-button';
import { DropdownMenu } from '../../../components/controls/dropdown/dropdown-menu';
import { connect } from 'react-redux';
import { compose } from 'redux';
import { UMLElementRepository } from '../../../services/uml-element/uml-element-repository';
import { ModelState } from '../../../components/store/model-state';
import { IConv1DAttribute, Conv1DAttribute } from '../nn-conv1d-attributes/conv1d-attributes';
import { IConv2DAttribute, Conv2DAttribute } from '../nn-conv2d-attributes/conv2d-attributes';
import { IConv3DAttribute, Conv3DAttribute } from '../nn-conv3d-attributes/conv3d-attributes';
import { IPoolingAttribute, PoolingAttribute } from '../nn-pooling-attributes/pooling-attributes';
import { IRNNAttribute, RNNAttribute } from '../nn-rnn-attributes/rnn-attributes';
import { ILSTMAttribute, LSTMAttribute } from '../nn-lstm-attributes/lstm-attributes';
import { IGRUAttribute, GRUAttribute } from '../nn-gru-attributes/gru-attributes';
import { ILinearAttribute, LinearAttribute } from '../nn-linear-attributes/linear-attributes';
import { IFlattenAttribute, FlattenAttribute } from '../nn-flatten-attributes/flatten-attributes';
import { IEmbeddingAttribute, EmbeddingAttribute } from '../nn-embedding-attributes/embedding-attributes';
import { IDropoutAttribute, DropoutAttribute } from '../nn-dropout-attributes/dropout-attributes';
import { ILayerNormalizationAttribute, LayerNormalizationAttribute } from '../nn-layernormalization-attributes/layernormalization-attributes';
import { IBatchNormalizationAttribute, BatchNormalizationAttribute } from '../nn-batchnormalization-attributes/batchnormalization-attributes';
import { ITensorOpAttribute, TensorOpAttribute } from '../nn-tensorop-attributes/tensorop-attributes';
import { IConfigurationAttribute, ConfigurationAttribute } from '../nn-configuration-attributes/configuration-attributes';
import { NNElementType } from '../index';
import { getAttributeDefaultValue, LIST_STRICT_REGEX, LIST_PERMISSIVE_REGEX, getListExpectation } from '../nn-validation-defaults';
import { INNAttribute } from '../nn-component-attribute';

type TextfieldValue = string | number;

// Styled components
const Flex = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
`;

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

const ValueTextfield = styled(Textfield)`
  flex-grow: 1;
  min-width: 60px;
`;

const MultiSelectContainer = styled.div`
  position: relative;
  flex-grow: 1;
`;

const CheckboxLabel = styled.label`
  display: flex;
  align-items: center;
  padding: 4px 8px;
  cursor: pointer;
  user-select: none;

  &:hover {
    background-color: rgba(0, 0, 0, 0.05);
  }

  input[type="checkbox"] {
    margin-right: 8px;
  }
`;

interface OwnProps {
  element: Conv1DAttribute | Conv2DAttribute | Conv3DAttribute | PoolingAttribute | RNNAttribute | LSTMAttribute | GRUAttribute | LinearAttribute | FlattenAttribute | EmbeddingAttribute | DropoutAttribute | LayerNormalizationAttribute | BatchNormalizationAttribute | TensorOpAttribute | ConfigurationAttribute;
}

interface StateProps {
  elements: ModelState['elements'];
}

interface DispatchProps {
  update: typeof UMLElementRepository.update;
  delete: typeof UMLElementRepository.delete;
}

type Props = OwnProps & StateProps & DispatchProps;

interface ComponentState {
  colorOpen: boolean;
  multiSelectOpen: boolean;
  validationError: string | null;
  submitResetKey: number;
}

class NNAttributeUpdateComponent extends Component<Props, ComponentState> {
  state: ComponentState = { colorOpen: false, multiSelectOpen: false, validationError: null, submitResetKey: 0 };
  multiSelectButtonRef = createRef<HTMLButtonElement>();

  private toggleColor = () => {
    this.setState((state) => ({
      colorOpen: !state.colorOpen,
    }));
  };

  private handleValueChange = (newValue: TextfieldValue) => {
    const { element, update } = this.props;
    update(element.id, {
      value: String(newValue),
      name: `${element.attributeName} = ${String(newValue)}`
    } as Partial<INNAttribute>);
  };

  /**
   * Normalize legacy attribute values that the popup renders as a display-safe
   * fallback (e.g. 'zeros' → 'valid' for padding_type, 'cross_entropy' →
   * 'crossentropy', a numeric '2' → '2D' for Pooling/BatchNorm dimension).
   *
   * The dropdowns previously showed the normalized label but never wrote it
   * back to Redux, so an unchanged legacy project was exported with the
   * stale value. Dispatch a one-shot migration on mount.
   */
  componentDidMount() {
    const { element, update } = this.props;
    const oldValue = element.value;
    let newValue: string | null = null;

    const type = element.type;
    if (oldValue === 'zeros' && (
      type === NNElementType.PaddingTypeAttributeConv1D ||
      type === NNElementType.PaddingTypeAttributeConv2D ||
      type === NNElementType.PaddingTypeAttributeConv3D ||
      type === NNElementType.PaddingTypeAttributePooling
    )) {
      newValue = 'valid';
    } else if (oldValue === 'cross_entropy' && type === NNElementType.LossFunctionAttributeConfiguration) {
      newValue = 'crossentropy';
    } else if (
      (type === NNElementType.DimensionAttributePooling ||
       type === NNElementType.DimensionAttributeBatchNormalization) &&
      oldValue && !['1D', '2D', '3D'].includes(oldValue)
    ) {
      newValue = '2D';
    }

    if (newValue !== null && newValue !== oldValue) {
      update(element.id, {
        value: newValue,
        name: `${element.attributeName} = ${newValue}`,
      } as Partial<INNAttribute>);
    }
  }

  // Special handler for Pooling dimension changes - updates kernel_dim, stride_dim, and output_dim
  private handleDimensionChange = (newValue: TextfieldValue) => {
    const { element, update, elements } = this.props;
    const dimensionValue = String(newValue);

    // Update the dimension attribute itself
    update(element.id, {
      value: dimensionValue,
      name: `${element.attributeName} = ${dimensionValue}`
    } as Partial<INNAttribute>);

    // Find sibling kernel_dim, stride_dim, and output_dim attributes
    const ownerId = element.owner;
    if (ownerId) {
      const siblingElements = Object.values(elements).filter(
        (el: any) => el.owner === ownerId
      );

      // Determine the correct list values based on dimension
      let kernelValue: string;
      let strideValue: string;
      let outputValue: string;
      switch (dimensionValue) {
        case '1D':
          kernelValue = '[3]';
          strideValue = '[1]';
          outputValue = '[16]';
          break;
        case '3D':
          kernelValue = '[3, 3, 3]';
          strideValue = '[1, 1, 1]';
          outputValue = '[16, 16, 16]';
          break;
        case '2D':
        default:
          kernelValue = '[3, 3]';
          strideValue = '[1, 1]';
          outputValue = '[16, 16]';
          break;
      }

      // Update kernel_dim if it exists
      const kernelDimAttr = siblingElements.find(
        (el: any) => el.type === NNElementType.KernelDimAttributePooling
      );
      if (kernelDimAttr) {
        update(kernelDimAttr.id, {
          value: kernelValue,
          name: `kernel_dim = ${kernelValue}`
        } as Partial<INNAttribute>);
      }

      // Update stride_dim if it exists
      const strideDimAttr = siblingElements.find(
        (el: any) => el.type === NNElementType.StrideDimAttributePooling
      );
      if (strideDimAttr) {
        update(strideDimAttr.id, {
          value: strideValue,
          name: `stride_dim = ${strideValue}`
        } as Partial<INNAttribute>);
      }

      // Update output_dim if it exists
      const outputDimAttr = siblingElements.find(
        (el: any) => el.type === NNElementType.OutputDimAttributePooling
      );
      if (outputDimAttr) {
        update(outputDimAttr.id, {
          value: outputValue,
          name: `output_dim = ${outputValue}`
        } as Partial<INNAttribute>);
      }
    }
  };

  private handleDelete = () => {
    this.props.delete(this.props.element.id);
  };

  componentWillUnmount() {
    document.removeEventListener('click', this.dismissMultiSelect);
  }

  private toggleMultiSelect = (event: React.MouseEvent) => {
    event.stopPropagation();
    const newState = !this.state.multiSelectOpen;
    this.setState({ multiSelectOpen: newState });

    if (newState) {
      // Add listener when opening
      setTimeout(() => document.addEventListener('click', this.dismissMultiSelect), 0);
    } else {
      // Remove listener when closing
      document.removeEventListener('click', this.dismissMultiSelect);
    }
  };

  private dismissMultiSelect = () => {
    document.removeEventListener('click', this.dismissMultiSelect);
    this.setState({ multiSelectOpen: false });
  };

  private handleMetricsToggle = (option: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const { element, update } = this.props;
    // Parse current values - handle both formats: "a, b" and "[a, b]"
    const rawValue = element.value || '';
    const cleanedValue = rawValue.replace(/^\[|\]$/g, ''); // Remove surrounding brackets if present
    const currentValues = cleanedValue ? cleanedValue.split(',').map(v => v.trim()) : [];

    let newValues: string[];
    if (event.target.checked) {
      // Add the option
      newValues = [...currentValues, option];
    } else {
      // Remove the option
      newValues = currentValues.filter(v => v !== option);
    }

    // Store value with brackets for List type
    const newValue = newValues.length > 0 ? `[${newValues.join(', ')}]` : '';
    update(element.id, {
      value: newValue,
      name: `${element.attributeName} = ${newValue}`
    } as Partial<INNAttribute>);
  };

  private handleValidatedChange = (newValue: string | number) => {
    const { element, update } = this.props;
    const str = String(newValue);
    const type = element.attributeType;

    if (type === 'int') {
      if (str === '' || str === '-') {
        this.setState({ validationError: null });
      } else if (/^-?\d+$/.test(str)) {
        this.setState({ validationError: null });
        update(element.id, { value: str, name: `${element.attributeName} = ${str}` } as Partial<INNAttribute>);
      } else {
        this.setState({ validationError: `Must be an integer. Example: ${getAttributeDefaultValue(element)}` });
      }
    } else if (type === 'float') {
      const isIntermediate = str === '' || str === '-' || str === '.' || /^-?\d*\.$/.test(str);
      const isValid = !isIntermediate && !isNaN(Number(str)) && str !== '';
      if (isIntermediate) {
        this.setState({ validationError: null });
      } else if (isValid) {
        this.setState({ validationError: null });
        update(element.id, { value: str, name: `${element.attributeName} = ${str}` } as Partial<INNAttribute>);
      } else {
        this.setState({ validationError: `Must be a number. Example: ${getAttributeDefaultValue(element)}` });
      }
    } else if (type === 'List') {
      if (str === '' || LIST_PERMISSIVE_REGEX.test(str)) {
        if (LIST_STRICT_REGEX.test(str)) {
          const expected = getListExpectation(element.type, element.owner, this.props.elements);
          if (expected.count !== null) {
            const actualCount = str.replace(/^\[|\]$/g, '').split(',').filter((s) => s.trim() !== '').length;
            if (actualCount !== expected.count) {
              this.setState({ validationError: `Must be a list with ${expected.count} integer${expected.count > 1 ? 's' : ''}. Example: ${expected.example}` });
              return;
            }
          }
          this.setState({ validationError: null });
          update(element.id, { value: str, name: `${element.attributeName} = ${str}` } as Partial<INNAttribute>);
        } else {
          this.setState({ validationError: null });
        }
      } else {
        const expected = getListExpectation(element.type, element.owner, this.props.elements);
        const countMsg = expected.count !== null ? ` with ${expected.count} integer${expected.count > 1 ? 's' : ''}` : ' of integers';
        this.setState({ validationError: `Must be a list${countMsg}. Example: ${expected.example}` });
      }
    }
  };

  private handleValidatedSubmit = (newValue: string | number) => {
    const { element, update } = this.props;
    const str = String(newValue).trim();
    const type = element.attributeType;

    if (type === 'int') {
      if (/^-?\d+$/.test(str)) {
        this.setState({ validationError: null });
        update(element.id, { value: str, name: `${element.attributeName} = ${str}` } as Partial<INNAttribute>);
      } else {
        const defaultVal = getAttributeDefaultValue(element);
        update(element.id, { value: defaultVal, name: `${element.attributeName} = ${defaultVal}` } as Partial<INNAttribute>);
        const errorMsg = (str === '' || str === '-') ? null : `Must be an integer. Example: ${defaultVal}`;
        this.setState((s) => ({ validationError: errorMsg, submitResetKey: s.submitResetKey + 1 }));
      }
    } else if (type === 'float') {
      if (!isNaN(Number(str)) && str !== '' && str !== '-' && str !== '.') {
        this.setState({ validationError: null });
        update(element.id, { value: str, name: `${element.attributeName} = ${str}` } as Partial<INNAttribute>);
      } else {
        const defaultVal = getAttributeDefaultValue(element);
        update(element.id, { value: defaultVal, name: `${element.attributeName} = ${defaultVal}` } as Partial<INNAttribute>);
        const isIncomplete = str === '' || str === '-' || str === '.';
        const errorMsg = isIncomplete ? null : `Must be a number. Example: ${defaultVal}`;
        this.setState((s) => ({ validationError: errorMsg, submitResetKey: s.submitResetKey + 1 }));
      }
    } else if (type === 'List') {
      if (LIST_STRICT_REGEX.test(str)) {
        const expected = getListExpectation(element.type, element.owner, this.props.elements);
        if (expected.count !== null) {
          const actualCount = str.replace(/^\[|\]$/g, '').split(',').filter((s) => s.trim() !== '').length;
          if (actualCount !== expected.count) {
            const defaultVal = expected.example;
            update(element.id, { value: defaultVal, name: `${element.attributeName} = ${defaultVal}` } as Partial<INNAttribute>);
            this.setState((s) => ({
              validationError: `Must be a list with ${expected.count} integer${expected.count! > 1 ? 's' : ''}. Example: ${expected.example}`,
              submitResetKey: s.submitResetKey + 1,
            }));
            return;
          }
        }
        this.setState({ validationError: null });
        update(element.id, { value: str, name: `${element.attributeName} = ${str}` } as Partial<INNAttribute>);
      } else if (str === '' || LIST_PERMISSIVE_REGEX.test(str)) {
        const defaultVal = getListExpectation(element.type, element.owner, this.props.elements).example;
        update(element.id, { value: defaultVal, name: `${element.attributeName} = ${defaultVal}` } as Partial<INNAttribute>);
        this.setState((s) => ({ validationError: null, submitResetKey: s.submitResetKey + 1 }));
      } else {
        const expected = getListExpectation(element.type, element.owner, this.props.elements);
        const defaultVal = expected.example;
        update(element.id, { value: defaultVal, name: `${element.attributeName} = ${defaultVal}` } as Partial<INNAttribute>);
        const countMsg = expected.count !== null ? ` with ${expected.count} integer${expected.count > 1 ? 's' : ''}` : ' of integers';
        this.setState((s) => ({
          validationError: `Must be a list${countMsg}. Example: ${expected.example}`,
          submitResetKey: s.submitResetKey + 1,
        }));
      }
    }
  };

  render() {
    const { element } = this.props;
    const { colorOpen } = this.state;

    // Check if this is the tns_type attribute for TensorOp
    const isTnsType = element.type === NNElementType.TnsTypeAttributeTensorOp;
    const tnsTypeOptions = ['reshape', 'concatenate', 'multiply', 'matmultiply', 'transpose', 'permute'];

    // Check if this is a padding_type attribute
    const isPaddingType = element.type === NNElementType.PaddingTypeAttributeConv1D ||
                          element.type === NNElementType.PaddingTypeAttributeConv2D ||
                          element.type === NNElementType.PaddingTypeAttributeConv3D ||
                          element.type === NNElementType.PaddingTypeAttributePooling;
    const paddingTypeOptions = ['valid', 'same'];
    // Handle legacy 'zeros' value by defaulting to 'valid'
    const paddingValue = isPaddingType && element.value === 'zeros' ? 'valid' : (element.value || 'valid');

    // Check if this is a pooling_type attribute
    const isPoolingType = element.type === NNElementType.PoolingTypeAttributePooling;
    const poolingTypeOptions = ['average', 'max', 'adaptive_average', 'adaptive_max', 'global_average', 'global_max'];

    // Check if this is a dimension attribute for Pooling or BatchNormalization
    const isDimension = element.type === NNElementType.DimensionAttributePooling ||
                        element.type === NNElementType.DimensionAttributeBatchNormalization;
    const dimensionOptions = ['1D', '2D', '3D'];
    // Handle legacy numeric value by defaulting to '2D'
    const dimensionValue = isDimension && !dimensionOptions.includes(element.value) ? '2D' : (element.value || '2D');

    // Check if this is an optimizer attribute
    const isOptimizer = element.type === NNElementType.OptimizerAttributeConfiguration;
    const optimizerOptions = ['sgd', 'adam', 'adamW', 'adagrad'];

    // Check if this is a loss_function attribute
    const isLossFunction = element.type === NNElementType.LossFunctionAttributeConfiguration;
    const lossFunctionOptions = ['crossentropy', 'binary_crossentropy', 'mse'];
    // Handle legacy 'cross_entropy' value by defaulting to 'crossentropy'
    const lossFunctionValue = isLossFunction && element.value === 'cross_entropy' ? 'crossentropy' : (element.value || 'crossentropy');

    // Check if this is a metrics attribute (multi-select)
    const isMetrics = element.type === NNElementType.MetricsAttributeConfiguration;
    const metricsOptions = ['accuracy', 'precision', 'recall', 'f1-score', 'mae'];
    // Parse metrics value - handle both formats: "a, b" and "[a, b]"
    const rawMetricsValue = element.value || '';
    const cleanedMetricsValue = rawMetricsValue.replace(/^\[|\]$/g, ''); // Remove surrounding brackets if present
    const selectedMetrics = cleanedMetricsValue ? cleanedMetricsValue.split(',').map(v => v.trim()) : [];
    const metricsDisplayValue = selectedMetrics.length > 0 ? `[${selectedMetrics.join(', ')}]` : 'Select metrics';

    // Check if this is a task_type attribute (Dataset)
    const isTaskType = element.type === NNElementType.TaskTypeAttributeDataset;
    const taskTypeOptions = ['binary', 'multi_class', 'regression'];

    // Check if this is an input_format attribute (Dataset)
    const isInputFormat = element.type === NNElementType.InputFormatAttributeDataset;
    const inputFormatOptions = ['csv', 'images'];

    // Check if this is an actv_func attribute
    const isActvFunc = element.type === NNElementType.ActvFuncAttributeConv1D ||
                       element.type === NNElementType.ActvFuncAttributeConv2D ||
                       element.type === NNElementType.ActvFuncAttributeConv3D ||
                       element.type === NNElementType.ActvFuncAttributePooling ||
                       element.type === NNElementType.ActvFuncAttributeRNN ||
                       element.type === NNElementType.ActvFuncAttributeLSTM ||
                       element.type === NNElementType.ActvFuncAttributeGRU ||
                       element.type === NNElementType.ActvFuncAttributeLinear ||
                       element.type === NNElementType.ActvFuncAttributeFlatten ||
                       element.type === NNElementType.ActvFuncAttributeEmbedding ||
                       element.type === NNElementType.ActvFuncAttributeLayerNormalization ||
                       element.type === NNElementType.ActvFuncAttributeBatchNormalization;
    const actvFuncOptions = ['relu', 'leaky_relu', 'sigmoid', 'softmax', 'tanh'];

    return (
      <>
        <Flex>
          <AttributeInputContainer>
            <AttributeLabel>{element.attributeName} = </AttributeLabel>
            {isTnsType ? (
              <Dropdown
                value={element.value || 'reshape'}
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
            ) : isPaddingType ? (
              <Dropdown
                value={paddingValue}
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
            ) : isPoolingType ? (
              <Dropdown
                value={element.value || 'max'}
                onChange={this.handleValueChange}
                size="sm"
                outline
              >
                {poolingTypeOptions.map(option => (
                  <Dropdown.Item key={option} value={option}>
                    {option}
                  </Dropdown.Item>
                ))}
              </Dropdown>
            ) : isDimension ? (
              <Dropdown
                value={dimensionValue}
                onChange={element.type === NNElementType.DimensionAttributePooling
                  ? this.handleDimensionChange
                  : this.handleValueChange}
                size="sm"
                outline
              >
                {dimensionOptions.map(option => (
                  <Dropdown.Item key={option} value={option}>
                    {option}
                  </Dropdown.Item>
                ))}
              </Dropdown>
            ) : isOptimizer ? (
              <Dropdown
                value={element.value || 'adam'}
                onChange={this.handleValueChange}
                size="sm"
                outline
              >
                {optimizerOptions.map(option => (
                  <Dropdown.Item key={option} value={option}>
                    {option}
                  </Dropdown.Item>
                ))}
              </Dropdown>
            ) : isLossFunction ? (
              <Dropdown
                value={lossFunctionValue}
                onChange={this.handleValueChange}
                size="sm"
                outline
              >
                {lossFunctionOptions.map(option => (
                  <Dropdown.Item key={option} value={option}>
                    {option}
                  </Dropdown.Item>
                ))}
              </Dropdown>
            ) : isMetrics ? (
              <MultiSelectContainer onClick={(e) => e.stopPropagation()}>
                <DropdownButton
                  ref={this.multiSelectButtonRef}
                  color="primary"
                  onClick={this.toggleMultiSelect}
                  outline={true}
                  size="sm"
                >
                  {metricsDisplayValue}
                </DropdownButton>
                {this.state.multiSelectOpen && this.multiSelectButtonRef.current && (
                  <DropdownMenu
                    style={{
                      position: 'absolute',
                      top: this.multiSelectButtonRef.current.getBoundingClientRect().height,
                      left: 0,
                      minWidth: this.multiSelectButtonRef.current.getBoundingClientRect().width,
                      zIndex: 1000,
                    }}
                  >
                    {metricsOptions.map(option => (
                      <CheckboxLabel key={option} onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedMetrics.includes(option)}
                          onChange={this.handleMetricsToggle(option)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        {option}
                      </CheckboxLabel>
                    ))}
                  </DropdownMenu>
                )}
              </MultiSelectContainer>
            ) : isTaskType ? (
              <Dropdown
                value={element.value || 'multi_class'}
                onChange={this.handleValueChange}
                size="sm"
                outline
              >
                {taskTypeOptions.map(option => (
                  <Dropdown.Item key={option} value={option}>
                    {option}
                  </Dropdown.Item>
                ))}
              </Dropdown>
            ) : isInputFormat ? (
              <Dropdown
                value={element.value || 'images'}
                onChange={this.handleValueChange}
                size="sm"
                outline
              >
                {inputFormatOptions.map(option => (
                  <Dropdown.Item key={option} value={option}>
                    {option}
                  </Dropdown.Item>
                ))}
              </Dropdown>
            ) : isActvFunc ? (
              <Dropdown
                value={element.value || 'relu'}
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
            ) : element.attributeType === 'int' || element.attributeType === 'float' || element.attributeType === 'List' ? (
              <ValueTextfield
                key={this.state.submitResetKey}
                gutter
                value={element.value || ''}
                onChange={this.handleValidatedChange}
                onSubmit={this.handleValidatedSubmit}
                placeholder="value"
              />
            ) : (
              <ValueTextfield
                gutter
                value={element.value || ''}
                onChange={this.handleValueChange}
                placeholder="value"
              />
            )}
          </AttributeInputContainer>
          <ColorButton onClick={this.toggleColor} />
          {/* Wire up handleDelete so users can drop an optional attribute
              from the layer directly, instead of having to untoggle it in
              the parent layer popup. Mirrors nn-component-update.tsx. */}
          <Button color="link" tabIndex={-1} onClick={this.handleDelete} title="Remove attribute">
            <TrashIcon />
          </Button>
        </Flex>
        {this.state.validationError && (
          <span style={{ color: 'red', fontSize: '11px', display: 'block', marginTop: '-2px', marginBottom: '4px' }}>
            {this.state.validationError}
          </span>
        )}
        <StylePane open={colorOpen} element={element} onColorChange={this.props.update} fillColor textColor />
      </>
    );
  }
}

const mapStateToProps = (state: ModelState): StateProps => ({
  elements: state.elements,
});

const enhance = compose<ComponentClass<OwnProps>>(
  connect<StateProps, DispatchProps, OwnProps, ModelState>(
    mapStateToProps,
    {
      update: UMLElementRepository.update,
      delete: UMLElementRepository.delete,
    },
  ),
);

export const NNAttributeUpdate = enhance(NNAttributeUpdateComponent);
