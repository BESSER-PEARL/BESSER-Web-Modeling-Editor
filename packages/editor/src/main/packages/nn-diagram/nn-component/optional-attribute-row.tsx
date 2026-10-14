import React, { Component, ComponentClass, createRef } from 'react';
import { connect } from 'react-redux';
import { compose } from 'redux';
import styled from 'styled-components';
import { Textfield } from '../../../components/controls/textfield/textfield';
import { Dropdown } from '../../../components/controls/dropdown/dropdown';
import { DropdownButton } from '../../../components/controls/dropdown/dropdown-button';
import { DropdownMenu } from '../../../components/controls/dropdown/dropdown-menu';
import { I18nContext } from '../../../components/i18n/i18n-context';
import { localized } from '../../../components/i18n/localized';
import { ModelState } from '../../../components/store/model-state';
import { UMLElementRepository } from '../../../services/uml-element/uml-element-repository';
import { UMLContainerRepository } from '../../../services/uml-container/uml-container-repository';
import { Conv1DAttribute } from '../nn-conv1d-attributes/conv1d-attributes';
import { INNAttribute } from '../nn-component-attribute';
import { IUMLRelationship } from '../../../services/uml-relationship/uml-relationship';
import { NNRelationshipType } from '../index';
import { getWidgetConfig, getTnsTypeCategory, TnsTypeCategory } from '../nn-attribute-widget-config';
import { interpolate, validateOnChange, validateOnSubmit, ValidationContext } from '../nn-attribute-validators';
import {
  formatLayersOfTensors,
  formatPadAmount,
  formatRepeatDim,
  formatSubscriptIndices,
  formatSubscriptIndicesDisplay,
  isCompletePadAmountPair,
  PadAmountPair,
  parseLayersOfTensors,
  parsePadAmount,
  parseRepeatDim,
  parseSubscriptIndices,
  SubscriptDimension,
} from '../nn-attribute-value-formats';

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

// Content aligned under the row's checkbox
const Indented = styled.div`
  margin-left: 24px;
  width: calc(100% - 24px);
`;

const HelpText = styled(Indented)`
  font-size: 11px;
  color: #666;
  margin-top: 6px;
`;

const ErrorText = styled.span`
  color: red;
  font-size: 11px;
  display: block;
  margin-left: 24px;
`;

const DimensionRow = styled(Indented)`
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 6px;
`;

const SmallLabel = styled.span`
  font-size: 11px;
`;

const RemoveButton = styled.button`
  padding: 2px 6px;
  font-size: 11px;
  cursor: pointer;
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 3px;
  flex-shrink: 0;
`;

const AddButton = styled.button`
  padding: 4px 8px;
  font-size: 11px;
  cursor: pointer;
  background: #28a745;
  color: white;
  border: none;
  border-radius: 3px;
  margin-top: 6px;
  margin-left: 24px;
`;

const ValuePreview = styled.div`
  margin-top: 6px;
  margin-left: 24px;
  padding: 6px 8px;
  background: #f5f5f5;
  border: 1px solid #ddd;
  border-radius: 3px;
  font-size: 11px;
  font-family: monospace;
  color: #333;
  width: calc(100% - 24px - 16px);
`;

const NUMERIC_LITERAL_REGEX = /^-?(\d+\.?\d*|\.\d*)$/;
const INT_REGEX = /^-?\d+$/;

interface OwnProps {
  attributeType: string;
  attributeCtor: any;
  label: string;
  layerId: string;
  tnsType?: string;  // For layers_of_tensors: the current tns_type value
}

interface StateProps {
  existingAttribute: any | undefined;  // Don't check type, just use plain object
  elements: ModelState['elements'];  // Access to all elements for dimension lookup
  attributeValue: string | undefined;  // Explicit value tracking to force re-render on value changes
  predecessorNames: string[];  // Names of layers/tensor ops that come before this layer via NNNext
  tensorOpNames: string[];  // Names of ONLY tensor ops (no layers) that come before this layer via NNNext
}

interface DispatchProps {
  create: typeof UMLElementRepository.create;
  update: typeof UMLElementRepository.update;
  delete: typeof UMLElementRepository.delete;
  appendToParent: (elementId: string, parentId: string) => void;
}

type Props = OwnProps & StateProps & DispatchProps & I18nContext;

interface LocalState {
  localValue: string;
  isChecked: boolean;
  // For layers_of_tensors - dynamic array of tensor selections
  tensorSelections: string[];
  // For subscript_indices - dynamic array of dimension indices/slices
  subscriptDimensions: SubscriptDimension[];
  // For repeat_dim - dynamic array of integers or tensorop names
  repeatDimensions: string[];
  // For pad_amount - dynamic array of [int, int] pairs
  padAmountPairs: PadAmountPair[];
  validationError: string | null;
  submitResetKey: number;
  // For multiselect dropdown state
  multiSelectOpen: boolean;
}

class OptionalAttributeRowComponent extends Component<Props, LocalState> {
  multiSelectButtonRef = createRef<HTMLButtonElement>();

  constructor(props: Props) {
    super(props);
    const initialValue = props.existingAttribute?.value || '';
    this.state = {
      localValue: initialValue,
      isChecked: !!props.existingAttribute,
      tensorSelections: parseLayersOfTensors(initialValue),
      subscriptDimensions: parseSubscriptIndices(initialValue),
      repeatDimensions: parseRepeatDim(initialValue),
      padAmountPairs: parsePadAmount(initialValue),
      validationError: null,
      submitResetKey: 0,
      multiSelectOpen: false,
    };
  }

  componentDidMount() {
    // Migrate legacy dropdown values on mount: if the stored attribute
    // value isn't in the current options list, normalize to the config's
    // defaultValue and dispatch once so the Redux store no longer holds
    // the stale value. Without this, the popup renders the normalized
    // label but the exported JSON/BUML still carries e.g. 'output' (for
    // return_type) or any other legacy dropdown string.
    const { existingAttribute, update, attributeType } = this.props;
    if (!existingAttribute || !existingAttribute.value) return;
    const config = getWidgetConfig(attributeType);
    if (
      config.widget === 'dropdown' &&
      Array.isArray(config.options) &&
      !config.options.includes(existingAttribute.value) &&
      config.defaultValue
    ) {
      update(existingAttribute.id, {
        value: config.defaultValue,
        name: `${attributeType} = ${config.defaultValue}`,
      } as any);
    }
  }

  componentDidUpdate(prevProps: Props) {
    // Update local state when Redux state changes
    if (!prevProps.existingAttribute && this.props.existingAttribute) {
      const newValue = this.props.existingAttribute.value || '';
      this.setState({ localValue: newValue, isChecked: true, ...this.parsedWidgetState(newValue) });
    } else if (prevProps.existingAttribute && !this.props.existingAttribute) {
      this.setState({
        localValue: '',
        isChecked: false,
        tensorSelections: [],
        subscriptDimensions: [],
        repeatDimensions: [],
        padAmountPairs: [],
      });
    } else if (prevProps.attributeValue !== this.props.attributeValue &&
               this.props.existingAttribute) {
      // Sync local state with Redux when value changes externally (e.g., dimension change)
      const newValue = this.props.existingAttribute.value || '';
      this.setState({ localValue: newValue, ...this.parsedWidgetState(newValue) });
    }
  }

  /** Re-parse only the structured state that belongs to this row's widget; keep the rest. */
  private parsedWidgetState(value: string) {
    const config = getWidgetConfig(this.props.attributeType);
    return {
      tensorSelections: config.widget === 'layers_of_tensors' ? parseLayersOfTensors(value) : this.state.tensorSelections,
      subscriptDimensions: config.widget === 'subscript_indices' ? parseSubscriptIndices(value) : this.state.subscriptDimensions,
      repeatDimensions: config.widget === 'repeat_dim' ? parseRepeatDim(value) : this.state.repeatDimensions,
      padAmountPairs: config.widget === 'pad_amount' ? parsePadAmount(value) : this.state.padAmountPairs,
    };
  }

  // ── Attribute persistence helpers ────────────────────────────────────────────
  // Every widget stores its result through these three, so the create /
  // update / delete contract (value + "<name> = <value>" label, parent
  // ownership, local state sync) lives in exactly one place.

  /** Create the attribute element under the layer, optionally with an initial value. */
  private createAttribute = (value?: string) => {
    const { attributeCtor, layerId } = this.props;
    const instance = new attributeCtor({ owner: layerId });
    if (value !== undefined) {
      instance.value = value;
      instance.name = `${instance.attributeName} = ${value}`;
    }
    this.props.create(instance, layerId);
    // Also add to parent's ownedElements so it persists
    this.props.appendToParent(instance.id, layerId);
    this.setState({ localValue: instance.value || '', isChecked: true });
    return instance;
  };

  /** Store a value on the existing attribute element; no-op when it does not exist. */
  private updateAttribute = (value: string) => {
    const { existingAttribute } = this.props;
    if (!existingAttribute) return;
    this.props.update<Conv1DAttribute>(existingAttribute.id, {
      value,
      name: `${existingAttribute.attributeName} = ${value}`,
    } as Partial<Conv1DAttribute>);
  };

  /** Store a value, creating the attribute element on first use. */
  private setAttributeValue = (value: string) => {
    if (this.props.existingAttribute) {
      this.updateAttribute(value);
    } else {
      this.createAttribute(value);
    }
  };

  private deleteAttribute = () => {
    const { existingAttribute } = this.props;
    if (!existingAttribute) return;
    this.props.delete(existingAttribute.id);
    this.setState({ localValue: '' });
  };

  private validationContext = (): ValidationContext | null => {
    const { existingAttribute, elements, translate } = this.props;
    if (!existingAttribute) return null;
    return {
      attributeName: existingAttribute.attributeName,
      attributeType: existingAttribute.attributeType,
      elementType: existingAttribute.type,
      ownerId: existingAttribute.owner,
      elements,
      currentValue: existingAttribute.value || '',
      translate,
    };
  };

  private handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const { existingAttribute, layerId, attributeType, elements } = this.props;
    const isChecking = e.target.checked;

    // Update local state immediately for responsive UI
    this.setState({ isChecked: isChecking });

    if (isChecking) {
      const config = getWidgetConfig(attributeType);

      // For predecessor / layers_of_tensors / subscript_indices / pad_amount: don't create attribute yet, wait for user selection
      if (config.widget === 'predecessor' || config.widget === 'layers_of_tensors' || config.widget === 'subscript_indices' || config.widget === 'pad_amount') {
        return;
      }

      // Create attribute only if it doesn't exist, with the dimension-aware initial
      // value (e.g. pooling kernel/stride/output) or the config default when there is one
      if (!existingAttribute) {
        if (config.getInitialValue) {
          this.createAttribute(config.getInitialValue(elements, layerId));
        } else if (config.defaultValue) {
          this.createAttribute(config.defaultValue);
        } else {
          this.createAttribute();
        }
      }
    } else {
      // Delete attribute - these are optional so they can be deleted
      if (existingAttribute && !existingAttribute.isMandatory) {
        this.props.delete(existingAttribute.id);
        this.setState({ localValue: '', isChecked: false, tensorSelections: [], subscriptDimensions: [], padAmountPairs: [] });
      } else {
        // No attribute exists, just reset local state
        this.setState({ isChecked: false, tensorSelections: [], subscriptDimensions: [], padAmountPairs: [] });
      }
    }
  };

  private handleValueChange = (newValue: string | number) => {
    const valueStr = String(newValue);
    const { existingAttribute, attributeType } = this.props;

    // For predecessor: handle empty value specially (create on select, delete on clear)
    if (getWidgetConfig(attributeType).widget === 'predecessor') {
      if (valueStr === '') {
        if (existingAttribute) {
          this.props.delete(existingAttribute.id);
          this.setState({ localValue: '', isChecked: false });
        }
        return;
      } else if (!existingAttribute) {
        this.createAttribute(valueStr);
        return;
      }
    }

    this.updateAttribute(valueStr);
  };

  private handleValidatedTextChange = (newValue: string | number) => {
    const str = String(newValue);
    const ctx = this.validationContext();
    const outcome = ctx && validateOnChange(str, ctx);
    if (!outcome) {
      this.handleValueChange(newValue);
      return;
    }
    this.setState({ validationError: outcome.error });
    if (outcome.commit) {
      this.updateAttribute(str);
    }
  };

  private handleValidatedTextSubmit = (newValue: string | number) => {
    const str = String(newValue).trim();
    const ctx = this.validationContext();
    const outcome = ctx && validateOnSubmit(str, ctx);
    if (!outcome) {
      this.handleValueChange(newValue);
      return;
    }
    this.updateAttribute(outcome.value);
    if (outcome.reset) {
      this.setState((s) => ({ validationError: outcome.error, submitResetKey: s.submitResetKey + 1 }));
    } else {
      this.setState({ validationError: null });
    }
  };

  private toggleMultiSelect = (event: React.MouseEvent) => {
    event.stopPropagation();
    const newState = !this.state.multiSelectOpen;
    this.setState({ multiSelectOpen: newState });

    if (newState) {
      setTimeout(() => document.addEventListener('click', this.dismissMultiSelect), 0);
    } else {
      document.removeEventListener('click', this.dismissMultiSelect);
    }
  };

  private dismissMultiSelect = () => {
    document.removeEventListener('click', this.dismissMultiSelect);
    this.setState({ multiSelectOpen: false });
  };

  private handleMultiSelectToggle = (option: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    // Always add when checked (never remove)
    if (!event.target.checked) {
      return;
    }

    const rawValue = this.props.existingAttribute?.value || '[]';
    const cleanedValue = rawValue.replace(/^\[|\]$/g, '');
    const currentValues = cleanedValue ? cleanedValue.split(',').map((v: string) => v.trim()) : [];

    // Add the new value to the end of the list
    this.setAttributeValue(`[${[...currentValues, option].join(', ')}]`);

    // Uncheck the checkbox after adding (force re-render with setTimeout)
    setTimeout(() => {
      event.target.checked = false;
    }, 0);
  };

  componentWillUnmount() {
    document.removeEventListener('click', this.dismissMultiSelect);
  }

  // Handler for layers_of_tensors tensor selection
  private handleTensorChange = (tensorIndex: number) => (newValue: string | number) => {
    const { existingAttribute, tnsType } = this.props;
    const category = tnsType ? getTnsTypeCategory(tnsType) : 'binary';

    const newSelections = [...this.state.tensorSelections];
    newSelections[tensorIndex] = String(newValue);
    this.setState({ tensorSelections: newSelections });

    // Store once the minimum number of operands is selected
    const requiredCount = (category === 'unary') ? 1 : 2;
    const nonEmptySelections = newSelections.filter((s) => s !== '');

    if (nonEmptySelections.length >= requiredCount) {
      this.setAttributeValue(formatLayersOfTensors(nonEmptySelections));
    } else if (existingAttribute && nonEmptySelections.length === 0) {
      // Only delete if ALL selections are empty (user explicitly cleared everything)
      this.deleteAttribute();
    }
    // If some but not enough selections, keep the UI state but don't update the attribute
  };

  // Handler to add a new tensor element (for N-ary operations)
  private handleAddTensorElement = () => {
    this.setState((prevState) => ({
      tensorSelections: [...prevState.tensorSelections, ''],
    }));
  };

  // Handler to remove a tensor element at given index (for N-ary operations)
  private handleRemoveTensorElement = (index: number) => {
    const newSelections = this.state.tensorSelections.filter((_, i) => i !== index);
    this.setState({ tensorSelections: newSelections });

    const filteredSelections = newSelections.filter((s) => s !== '');
    if (filteredSelections.length >= 2) {
      this.updateAttribute(formatLayersOfTensors(filteredSelections));
    } else {
      this.deleteAttribute();
    }
  };

  private setSubscriptDimensions = (newDimensions: SubscriptDimension[]) => {
    this.setState({ subscriptDimensions: newDimensions });
    this.setAttributeValue(formatSubscriptIndices(newDimensions));
  };

  // Handler for subscript dimension type change
  private handleSubscriptDimensionTypeChange = (index: number) => (newType: 'index' | 'slice') => {
    const newDimensions = [...this.state.subscriptDimensions];
    newDimensions[index] = newType === 'index' ? { type: 'index', value: 0 } : { type: 'slice' };
    this.setSubscriptDimensions(newDimensions);
  };

  // Handler for subscript dimension field change (value for index, start/stop/step for slice)
  private handleSubscriptDimensionFieldChange = (index: number, field: 'value' | 'start' | 'stop' | 'step') => (newValue: string | number) => {
    const valueStr = String(newValue).trim();
    const numValue = valueStr === '' ? undefined : parseInt(valueStr, 10);
    if (valueStr !== '' && isNaN(numValue!)) return; // Invalid input

    const newDimensions = [...this.state.subscriptDimensions];
    newDimensions[index] = { ...newDimensions[index], [field]: numValue };
    this.setSubscriptDimensions(newDimensions);
  };

  private handleAddSubscriptDimension = () => {
    this.setSubscriptDimensions([...this.state.subscriptDimensions, { type: 'index', value: 0 }]);
  };

  private handleRemoveSubscriptDimension = (index: number) => {
    const newDimensions = this.state.subscriptDimensions.filter((_, i) => i !== index);
    this.setState({ subscriptDimensions: newDimensions });

    if (newDimensions.length > 0) {
      this.updateAttribute(formatSubscriptIndices(newDimensions));
    } else {
      this.deleteAttribute();
    }
  };

  // Handler for repeat_dim dimension change
  private handleRepeatDimChange = (index: number) => (newValue: string | number) => {
    const { existingAttribute } = this.props;
    const newDimensions = [...this.state.repeatDimensions];
    newDimensions[index] = String(newValue);
    this.setState({ repeatDimensions: newDimensions });

    const nonEmptyDimensions = newDimensions.filter((d) => d.trim() !== '');
    if (nonEmptyDimensions.length > 0) {
      this.setAttributeValue(formatRepeatDim(newDimensions));
    } else if (existingAttribute) {
      this.deleteAttribute();
    }
  };

  private handleAddRepeatDim = () => {
    this.setState((prevState) => ({
      repeatDimensions: [...prevState.repeatDimensions, ''],
    }));
  };

  private handleRemoveRepeatDim = (index: number) => {
    const newDimensions = this.state.repeatDimensions.filter((_, i) => i !== index);
    this.setState({ repeatDimensions: newDimensions });

    if (newDimensions.some((d) => d.trim() !== '')) {
      this.updateAttribute(formatRepeatDim(newDimensions));
    } else {
      this.deleteAttribute();
    }
  };

  // Handler to change a pad_amount pair field (left or right)
  private handlePadAmountPairChange = (index: number, field: 'left' | 'right') => (newValue: string | number) => {
    const { existingAttribute } = this.props;
    const newPairs = [...this.state.padAmountPairs];
    newPairs[index] = { ...newPairs[index], [field]: String(newValue) };
    this.setState({ padAmountPairs: newPairs });

    if (newPairs.some(isCompletePadAmountPair)) {
      this.setAttributeValue(formatPadAmount(newPairs));
    } else if (existingAttribute) {
      this.deleteAttribute();
    }
  };

  private handleAddPadAmountPair = () => {
    this.setState((prevState) => ({
      padAmountPairs: [...prevState.padAmountPairs, { left: '', right: '' }],
    }));
  };

  private handleRemovePadAmountPair = (index: number) => {
    const newPairs = this.state.padAmountPairs.filter((_, i) => i !== index);
    this.setState({ padAmountPairs: newPairs });

    if (newPairs.some(isCompletePadAmountPair)) {
      this.updateAttribute(formatPadAmount(newPairs));
    } else {
      this.deleteAttribute();
    }
  };

  // ── Rendering ────────────────────────────────────────────────────────────────

  private ordinal = (index: number): string => {
    const { translate } = this.props;
    if (index === 0) return translate('popup.nn.row.ordinal1');
    if (index === 1) return translate('popup.nn.row.ordinal2');
    return interpolate(translate('popup.nn.row.ordinalN'), { n: index + 1 });
  };

  private dimensionLabel = (index: number): string =>
    interpolate(this.props.translate('popup.nn.row.dim'), { n: index + 1 });

  /** The predecessor choices shared by every layer/tensorop selector: an empty option, INPUT, then the predecessors. */
  private renderPredecessorItems = (emptyLabelKey: string) => [
    <Dropdown.Item key="__empty__" value="">
      {this.props.translate(emptyLabelKey)}
    </Dropdown.Item>,
    <Dropdown.Item key="INPUT" value="INPUT">
      INPUT
    </Dropdown.Item>,
    ...this.props.predecessorNames.map((name) => (
      <Dropdown.Item key={name} value={name}>
        {name}
      </Dropdown.Item>
    )),
  ];

  private renderLayersOfTensors = (category: TnsTypeCategory) => {
    const { translate } = this.props;
    const initialCount = (category === 'unary') ? 1 : 2;

    // Ensure we have enough elements in tensorSelections array
    const displaySelections = [...this.state.tensorSelections];
    while (displaySelections.length < initialCount) {
      displaySelections.push('');
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
        {displaySelections.map((selection, index) => (
          <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <SmallLabel style={{ minWidth: '30px' }}>{this.ordinal(index)}:</SmallLabel>
            {category === 'binary' ? (
              // Binary: allow dropdown OR text input for numeric literals
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexGrow: 1 }}>
                <Dropdown
                  value={NUMERIC_LITERAL_REGEX.test(selection) ? '' : selection}
                  onChange={this.handleTensorChange(index)}
                  size="sm"
                  outline
                  style={{ flexGrow: 1 }}
                >
                  {this.renderPredecessorItems('popup.nn.row.selectOrEnterNumber')}
                </Dropdown>
                <SmallLabel>{translate('popup.nn.row.or')}</SmallLabel>
                <Textfield
                  gutter
                  value={NUMERIC_LITERAL_REGEX.test(selection) ? selection : ''}
                  onChange={(val) => this.handleTensorChange(index)(String(val))}
                  placeholder={translate('popup.nn.row.numericPlaceholder')}
                  style={{ width: '80px' }}
                />
              </div>
            ) : (
              // Unary and N-ary: dropdown only
              <Dropdown
                value={selection || ''}
                onChange={this.handleTensorChange(index)}
                size="sm"
                outline
                style={{ flexGrow: 1 }}
              >
                {this.renderPredecessorItems('popup.nn.row.select')}
              </Dropdown>
            )}
            {category === 'n-ary' && index >= 2 && (
              <RemoveButton onClick={() => this.handleRemoveTensorElement(index)}>✕</RemoveButton>
            )}
          </div>
        ))}
        {category === 'n-ary' && (
          <AddButton onClick={this.handleAddTensorElement} style={{ marginTop: '4px', marginLeft: 0 }}>
            {translate('popup.nn.row.addElement')}
          </AddButton>
        )}
      </div>
    );
  };

  private renderMultiSelect = (localValue: string, options: string[]) => {
    const { translate } = this.props;
    const cleanedValue = (localValue || '[]').replace(/^\[|\]$/g, '');
    const selectedValues = cleanedValue ? cleanedValue.split(',').map((v) => v.trim()) : [];
    return (
      <MultiSelectContainer onClick={(e) => e.stopPropagation()}>
        <DropdownButton
          ref={this.multiSelectButtonRef}
          color="primary"
          onClick={this.toggleMultiSelect}
          outline={true}
          size="sm"
        >
          {selectedValues.length > 0 ? `[${selectedValues.join(', ')}]` : translate('popup.nn.row.selectValues')}
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
            {options.map((option) => (
              <CheckboxLabel key={option} onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={false}
                  onChange={this.handleMultiSelectToggle(option)}
                  onClick={(e) => e.stopPropagation()}
                />
                {option}
              </CheckboxLabel>
            ))}
          </DropdownMenu>
        )}
      </MultiSelectContainer>
    );
  };

  private renderSubscriptIndices = () => {
    const { translate } = this.props;
    const dimensions = this.state.subscriptDimensions.length > 0
      ? this.state.subscriptDimensions
      : [{ type: 'index' } as SubscriptDimension];

    return (
      <>
        {dimensions.map((dimension, index) => (
          <Indented key={index} style={{ marginTop: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <SmallLabel style={{ minWidth: '40px' }}>{this.dimensionLabel(index)}</SmallLabel>
              <Dropdown
                value={dimension.type}
                onChange={(val) => this.handleSubscriptDimensionTypeChange(index)(val as 'index' | 'slice')}
                size="sm"
                outline
                placeholder={translate('popup.nn.row.typePlaceholder')}
                style={{ minWidth: '70px', maxWidth: '70px' }}
              >
                <Dropdown.Item value="index">{translate('popup.nn.row.index')}</Dropdown.Item>
                <Dropdown.Item value="slice">{translate('popup.nn.row.slice')}</Dropdown.Item>
              </Dropdown>
              {dimension.type === 'index' ? (
                <Textfield
                  gutter
                  value={dimension.value !== undefined ? String(dimension.value) : ''}
                  onChange={(val) => this.handleSubscriptDimensionFieldChange(index, 'value')(String(val))}
                  placeholder="0"
                  style={{ flexGrow: 1 }}
                />
              ) : (
                <>
                  {(['start', 'stop', 'step'] as const).map((field, fieldIndex) => (
                    <React.Fragment key={field}>
                      {fieldIndex > 0 && <SmallLabel>:</SmallLabel>}
                      <Textfield
                        gutter
                        value={dimension[field] !== undefined ? String(dimension[field]) : ''}
                        onChange={(val) => this.handleSubscriptDimensionFieldChange(index, field)(String(val))}
                        placeholder={translate(`popup.nn.row.${field}Placeholder`)}
                        style={{ flexGrow: 1, minWidth: '50px' }}
                      />
                    </React.Fragment>
                  ))}
                </>
              )}
              {index > 0 && (
                <RemoveButton onClick={() => this.handleRemoveSubscriptDimension(index)}>✕</RemoveButton>
              )}
            </div>
          </Indented>
        ))}
        <AddButton onClick={this.handleAddSubscriptDimension}>{translate('popup.nn.row.addDimension')}</AddButton>
        <ValuePreview>
          <strong>{translate('popup.nn.row.value')}</strong> {formatSubscriptIndicesDisplay(this.state.subscriptDimensions)}
        </ValuePreview>
      </>
    );
  };

  private renderRepeatDim = () => {
    const { translate } = this.props;
    const dimensions = this.state.repeatDimensions.length > 0 ? this.state.repeatDimensions : [''];

    return (
      <>
        {dimensions.map((dimension, index) => (
          <DimensionRow key={index}>
            <SmallLabel style={{ minWidth: '50px' }}>{this.dimensionLabel(index)}</SmallLabel>
            <Dropdown
              value={INT_REGEX.test(dimension.trim()) ? '' : dimension}
              onChange={(val) => this.handleRepeatDimChange(index)(String(val))}
              size="sm"
              outline
              style={{ flexGrow: 1 }}
            >
              {this.renderPredecessorItems('popup.nn.row.selectLayerOrTensorOp')}
            </Dropdown>
            <SmallLabel>{translate('popup.nn.row.or')}</SmallLabel>
            <Textfield
              gutter
              value={INT_REGEX.test(dimension.trim()) ? dimension : ''}
              onChange={(val) => this.handleRepeatDimChange(index)(String(val))}
              placeholder={translate('popup.nn.row.enterIntPlaceholder')}
              style={{ width: '80px' }}
            />
            {index > 0 && (
              <RemoveButton onClick={() => this.handleRemoveRepeatDim(index)}>✕</RemoveButton>
            )}
          </DimensionRow>
        ))}
        <AddButton onClick={this.handleAddRepeatDim}>{translate('popup.nn.row.addDimension')}</AddButton>
        <ValuePreview>
          <strong>{translate('popup.nn.row.value')}</strong> {formatRepeatDim(this.state.repeatDimensions)}
        </ValuePreview>
      </>
    );
  };

  private renderPadAmount = () => {
    const { translate } = this.props;
    return (
      <>
        {this.state.padAmountPairs.map((pair, index) => (
          <DimensionRow key={index}>
            <SmallLabel style={{ minWidth: '50px' }}>{this.dimensionLabel(index)}</SmallLabel>
            {(['left', 'right'] as const).map((side) => (
              <React.Fragment key={side}>
                <SmallLabel>{translate(`popup.nn.row.${side}`)}</SmallLabel>
                <Textfield
                  gutter
                  value={pair[side]}
                  onChange={(val) => this.handlePadAmountPairChange(index, side)(String(val))}
                  placeholder={translate('popup.nn.row.intPlaceholder')}
                  style={{ width: '60px' }}
                />
              </React.Fragment>
            ))}
            {index > 0 && (
              <RemoveButton onClick={() => this.handleRemovePadAmountPair(index)}>✕</RemoveButton>
            )}
          </DimensionRow>
        ))}
        <AddButton onClick={this.handleAddPadAmountPair}>{translate('popup.nn.row.addDimension')}</AddButton>
        <ValuePreview>
          <strong>{translate('popup.nn.row.value')}</strong> {formatPadAmount(this.state.padAmountPairs)}
        </ValuePreview>
      </>
    );
  };

  private renderWidget = (localValue: string, category: TnsTypeCategory) => {
    const { attributeType, translate } = this.props;
    const config = getWidgetConfig(attributeType);

    switch (config.widget) {
      case 'layers_of_tensors':
        return this.renderLayersOfTensors(category);
      case 'subscript_indices':
      case 'repeat_dim':
      case 'pad_amount':
        return <span style={{ color: '#999' }}>{translate('popup.nn.row.seeBelow')}</span>;
      case 'predecessor':
        return (
          <Dropdown value={localValue || ''} onChange={this.handleValueChange} size="sm" outline>
            {this.renderPredecessorItems('popup.nn.row.selectPredecessor')}
          </Dropdown>
        );
      case 'dropdown': {
        // If the stored value is not in the options list (e.g. legacy values like
        // 'zeros' for padding or 'output' for return_type), fall back to the config's defaultValue.
        const displayValue = config.options && !config.options.includes(localValue)
          ? config.defaultValue ?? ''
          : localValue;
        return (
          <Dropdown value={displayValue || config.defaultValue || ''} onChange={this.handleValueChange} size="sm" outline>
            {config.options!.map((option) => (
              <Dropdown.Item key={option} value={option}>
                {option}
              </Dropdown.Item>
            ))}
          </Dropdown>
        );
      }
      case 'multiselect':
        return this.renderMultiSelect(localValue, config.options!);
      default:
        return (
          <Textfield
            key={this.state.submitResetKey}
            gutter
            value={localValue}
            onChange={this.handleValidatedTextChange}
            onSubmit={this.handleValidatedTextSubmit}
            placeholder={translate(config.placeholderKey || 'popup.nn.row.valuePlaceholder')}
            style={{ flexGrow: 1 }}
          />
        );
    }
  };

  render() {
    const { label, attributeType, attributeValue, tnsType, translate } = this.props;
    const { isChecked, validationError } = this.state;
    const config = getWidgetConfig(attributeType);

    // Always use Redux value if available (handles external updates like dimension change)
    const localValue = attributeValue || '';

    // Determine category for layers_of_tensors widget
    const category: TnsTypeCategory = tnsType ? getTnsTypeCategory(tnsType) : 'binary';
    const stacked = isChecked && config.widget === 'layers_of_tensors';

    return (
      <div style={{ marginTop: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', width: '100%' }}>
          <input
            type="checkbox"
            checked={isChecked}
            onChange={this.handleCheckboxChange}
            style={{ marginTop: '4px' }}
          />
          <AttributeInputContainer style={stacked ? { flexDirection: 'column', alignItems: 'flex-start' } : undefined}>
            <AttributeLabel style={stacked ? { display: 'block', marginBottom: '4px' } : undefined}>{label} = </AttributeLabel>
            {isChecked ? (
              this.renderWidget(localValue, category)
            ) : (
              <span style={{ color: '#999' }}>{translate('popup.nn.row.unchecked')}</span>
            )}
          </AttributeInputContainer>
        </div>
        {validationError && <ErrorText>{validationError}</ErrorText>}
        {!validationError && isChecked && config.helpTextKey && (
          <HelpText>{translate(config.helpTextKey)}</HelpText>
        )}
        {config.widget === 'subscript_indices' && isChecked && this.renderSubscriptIndices()}
        {config.widget === 'repeat_dim' && isChecked && this.renderRepeatDim()}
        {config.widget === 'pad_amount' && isChecked && this.renderPadAmount()}
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

  const predecessorNames = _computePredecessors(state.elements, ownProps.layerId, null);
  const tensorOpNames = _computePredecessors(state.elements, ownProps.layerId, 'TensorOp');

  return {
    existingAttribute,
    elements: state.elements,
    attributeValue: (existingAttribute as INNAttribute)?.value,  // Explicit value to trigger re-render
    predecessorNames,
    tensorOpNames,
  };
};

// Module-level memoization keyed on the ``state.elements`` object reference
// via a WeakMap. When the Redux slice hasn't changed, every row re-uses the
// same array reference — which lets us drop the ``{ pure: false }`` override
// on connect() and rely on shallow equality to skip re-renders.
//
// WeakMap (rather than a single-slot cache) means the per-slice cache is GC'd
// with the elements ref: if the user loads a second diagram, the first's
// cache entries become unreachable automatically, so we never risk serving
// stale predecessor lists from a prior diagram instance.
//
// Without this memoization, a layer with ~10 optional rows would re-walk
// the NNNext graph ~10x per Redux dispatch (each row re-runs mapStateToProps
// under pure:false). With it, the graph is walked once per unique
// (elements, id) pair and reused across every row bound to that elements ref.
const _predecessorsCache = new WeakMap<object, Map<string, string[]>>();

function _computePredecessors(elements: any, targetId: string, typeFilter: string | null): string[] {
  const cacheKey = typeFilter ? `${targetId}_${typeFilter}` : targetId;
  let byTarget = _predecessorsCache.get(elements);
  if (!byTarget) {
    byTarget = new Map<string, string[]>();
    _predecessorsCache.set(elements, byTarget);
  }
  const cached = byTarget.get(cacheKey);
  if (cached) return cached;

  const allElements = Object.values(elements) as any[];
  const names: string[] = [];
  const visited = new Set<string>();

  const getElementName = (elementId: string): string | null => {
    const element = elements[elementId];
    if (!element) return null;

    // If typeFilter is set, only include elements of that type
    if (typeFilter && element.type !== typeFilter) return null;

    const nameAttr = allElements.find(
      (el) => el.owner === elementId && el.type?.includes('NameAttribute')
    );
    return (nameAttr as INNAttribute)?.value || element.name || null;
  };

  const visit = (id: string) => {
    const incoming = allElements.filter(
      (el) => el.type === NNRelationshipType.NNNext && el.target?.element === id
    );
    for (const rel of incoming) {
      const sourceId = (rel as IUMLRelationship).source?.element;
      if (sourceId && !visited.has(sourceId)) {
        visited.add(sourceId);
        const name = getElementName(sourceId);
        if (name) names.push(name);
        visit(sourceId);
      }
    }
  };
  visit(targetId);

  byTarget.set(cacheKey, names);
  return names;
}

const enhance = compose<ComponentClass<OwnProps>>(
  localized,
  connect<StateProps, DispatchProps, OwnProps, ModelState>(
    mapStateToProps,
    {
      create: UMLElementRepository.create,
      update: UMLElementRepository.update,
      delete: UMLElementRepository.delete,
      appendToParent: UMLContainerRepository.append,
    },
    // Default (shallow) mergeProps + default pure:true. Previously pure:false
    // forced mapStateToProps to run on every dispatch; now we return stable
    // object/array references when elements haven't changed, so shallow
    // comparison correctly short-circuits unchanged rows.
  ),
);

export const OptionalAttributeRow = enhance(OptionalAttributeRowComponent);
