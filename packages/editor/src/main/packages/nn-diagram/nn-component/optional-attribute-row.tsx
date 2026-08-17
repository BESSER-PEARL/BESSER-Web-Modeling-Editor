import React, { Component, ComponentClass, createRef } from 'react';
import { connect } from 'react-redux';
import { compose } from 'redux';
import styled from 'styled-components';
import { Textfield } from '../../../components/controls/textfield/textfield';
import { Dropdown } from '../../../components/controls/dropdown/dropdown';
import { DropdownButton } from '../../../components/controls/dropdown/dropdown-button';
import { DropdownMenu } from '../../../components/controls/dropdown/dropdown-menu';
import { ModelState } from '../../../components/store/model-state';
import { UMLElementRepository } from '../../../services/uml-element/uml-element-repository';
import { UMLContainerRepository } from '../../../services/uml-container/uml-container-repository';
import { Conv1DAttribute } from '../nn-conv1d-attributes/conv1d-attributes';
import { INNAttribute } from '../nn-component-attribute';
import { IUMLRelationship } from '../../../services/uml-relationship/uml-relationship';
import { NNRelationshipType } from '../index';
import { getAttributeDefaultValue, LIST_STRICT_REGEX, LIST_PERMISSIVE_REGEX, LIST_IDENTIFIER_STRICT_REGEX, LIST_IDENTIFIER_PERMISSIVE_REGEX, getListExpectation } from '../nn-validation-defaults';
import { getWidgetConfig, getTnsTypeCategory, TnsTypeCategory } from '../nn-attribute-widget-config';

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

type Props = OwnProps & StateProps & DispatchProps;

interface LocalState {
  localValue: string;
  isChecked: boolean;
  // For layers_of_tensors - dynamic array of tensor selections
  tensorSelections: string[];
  // For subscript_indices - dynamic array of dimension indices/slices
  subscriptDimensions: Array<{type: 'index' | 'slice'; value?: number; start?: number; stop?: number; step?: number}>;
  // For repeat_dim - dynamic array of integers or tensorop names
  repeatDimensions: string[];
  // For pad_amount - dynamic array of [int, int] pairs
  padAmountPairs: Array<{left: string; right: string}>;
  validationError: string | null;
  submitResetKey: number;
  // For multiselect dropdown state
  multiSelectOpen: boolean;
}

class OptionalAttributeRowComponent extends Component<Props, LocalState> {
  multiSelectButtonRef = createRef<HTMLButtonElement>();

  constructor(props: Props) {
    super(props);
    // Parse layers_of_tensors value if present
    const initialValue = props.existingAttribute?.value || '';
    const tensorSelections = this.parseLayersOfTensors(initialValue);
    const subscriptDimensions = this.parseSubscriptIndices(initialValue);
    const repeatDimensions = this.parseRepeatDim(initialValue);
    const padAmountPairs = this.parsePadAmount(initialValue);
    this.state = {
      localValue: initialValue,
      isChecked: !!props.existingAttribute,
      tensorSelections,
      subscriptDimensions,
      repeatDimensions,
      padAmountPairs,
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
    const config = getWidgetConfig(this.props.attributeType);

    if (!prevProps.existingAttribute && this.props.existingAttribute) {
      const newValue = this.props.existingAttribute.value || '';
      const tensorSelections = config.widget === 'layers_of_tensors' ? this.parseLayersOfTensors(newValue) : this.state.tensorSelections;
      const subscriptDimensions = config.widget === 'subscript_indices' ? this.parseSubscriptIndices(newValue) : this.state.subscriptDimensions;
      const repeatDimensions = config.widget === 'repeat_dim' ? this.parseRepeatDim(newValue) : this.state.repeatDimensions;
      const padAmountPairs = config.widget === 'pad_amount' ? this.parsePadAmount(newValue) : this.state.padAmountPairs;
      this.setState({
        localValue: newValue,
        isChecked: true,
        tensorSelections,
        subscriptDimensions,
        repeatDimensions,
        padAmountPairs,
      });
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
      const tensorSelections = config.widget === 'layers_of_tensors' ? this.parseLayersOfTensors(newValue) : this.state.tensorSelections;
      const subscriptDimensions = config.widget === 'subscript_indices' ? this.parseSubscriptIndices(newValue) : this.state.subscriptDimensions;
      const repeatDimensions = config.widget === 'repeat_dim' ? this.parseRepeatDim(newValue) : this.state.repeatDimensions;
      const padAmountPairs = config.widget === 'pad_amount' ? this.parsePadAmount(newValue) : this.state.padAmountPairs;
      this.setState({
        localValue: newValue,
        tensorSelections,
        subscriptDimensions,
        repeatDimensions,
        padAmountPairs,
      });
    }
  }

  // Parse layers_of_tensors value like "['a', 'b']" or "['x', 1.5]" into array
  private parseLayersOfTensors = (value: string): string[] => {
    if (!value || value === '[]') return [];
    // Remove brackets and split by comma
    const cleaned = value.replace(/^\[|\]$/g, '');
    // Match quoted strings or numbers
    const matches = cleaned.match(/('[^']*'|"[^"]*"|\d+\.?\d*)/g) || [];
    return matches.map(s => s.replace(/^['"]|['"]$/g, '').trim());
  };

  // Format array of tensors into layers_of_tensors value
  // Wraps strings in quotes, leaves numbers as-is
  private formatLayersOfTensors = (selections: string[]): string => {
    if (!selections || selections.length === 0) return '[]';
    const formatted = selections.map(item => {
      // Check if numeric (int or float)
      if (/^-?\d+(\.\d+)?$/.test(item)) {
        return item;
      }
      return `'${item}'`;
    });
    return `[${formatted.join(', ')}]`;
  };

  // Parse subscript_indices value like '[{"type": "index", "value": 0}, {"type": "slice", "start": 1, "stop": 5}]'
  private parseSubscriptIndices = (value: string): Array<{type: 'index' | 'slice'; value?: number; start?: number; stop?: number; step?: number}> => {
    if (!value || value === '[]') return [];
    try {
      const parsed = JSON.parse(value);
      if (!Array.isArray(parsed)) return [];
      return parsed.map(item => {
        if (item.type === 'index') {
          return { type: 'index', value: item.value };
        } else if (item.type === 'slice') {
          return {
            type: 'slice',
            start: item.start !== undefined ? item.start : undefined,
            stop: item.stop !== undefined ? item.stop : undefined,
            step: item.step !== undefined ? item.step : undefined,
          };
        }
        return { type: 'index', value: 0 };
      });
    } catch (e) {
      return [];
    }
  };

  // Format array of dimensions into subscript_indices JSON string (for backend)
  private formatSubscriptIndices = (dimensions: Array<{type: 'index' | 'slice'; value?: number; start?: number; stop?: number; step?: number}>): string => {
    if (!dimensions || dimensions.length === 0) return '[]';
    const formatted = dimensions.map(dim => {
      if (dim.type === 'index') {
        return { type: 'index', value: dim.value };
      } else {
        const slice: any = { type: 'slice' };
        if (dim.start !== undefined) slice.start = dim.start;
        if (dim.stop !== undefined) slice.stop = dim.stop;
        if (dim.step !== undefined) slice.step = dim.step;
        return slice;
      }
    });
    return JSON.stringify(formatted);
  };

  // Format array of dimensions into human-readable format for display: [0, 1:5, :, -1]
  private formatSubscriptIndicesDisplay = (dimensions: Array<{type: 'index' | 'slice'; value?: number; start?: number; stop?: number; step?: number}>): string => {
    if (!dimensions || dimensions.length === 0) return '[]';
    const formatted = dimensions.map(dim => {
      if (dim.type === 'index') {
        return dim.value !== undefined ? String(dim.value) : '0';
      } else {
        const start = dim.start !== undefined ? String(dim.start) : '';
        const stop = dim.stop !== undefined ? String(dim.stop) : '';
        const step = dim.step !== undefined ? String(dim.step) : '';
        if (start === '' && stop === '' && step === '') return ':';
        if (step === '') return `${start}:${stop}`;
        return `${start}:${stop}:${step}`;
      }
    });
    return `[${formatted.join(', ')}]`;
  };

  // Parse repeat_dim value like "[1, 'op_3', 2]" into array of dimensions
  private parseRepeatDim = (value: string): string[] => {
    if (!value || value === '[]') return [];
    // Remove outer brackets
    const cleaned = value.replace(/^\[|\]$/g, '').trim();
    if (!cleaned) return [];
    // Match quoted strings or numbers
    const matches = cleaned.match(/('[^']*'|"[^"]*"|-?\d+)/g) || [];
    // Remove quotes from matched strings
    return matches.map(m => m.replace(/^['"]|['"]$/g, ''));
  };

  // Format array of dimensions into repeat_dim string: "[1, 'op_3', 2]"
  private formatRepeatDim = (dimensions: string[]): string => {
    if (!dimensions || dimensions.length === 0) return '[]';
    const nonEmpty = dimensions.filter(d => d.trim() !== '');
    if (nonEmpty.length === 0) return '[]';
    // Format each dimension: integers as-is, strings in quotes
    const formatted = nonEmpty.map(d => {
      const trimmed = d.trim();
      // Check if it's an integer
      if (/^-?\d+$/.test(trimmed)) {
        return trimmed;
      }
      // It's a string (tensorop name), wrap in quotes
      return `'${trimmed}'`;
    });
    return `[${formatted.join(', ')}]`;
  };

  // Parse pad_amount value into array of {left, right} pairs: "[[1, 6], [2, 3]]" → [{left: '1', right: '6'}, {left: '2', right: '3'}]
  private parsePadAmount = (value: string): Array<{left: string; right: string}> => {
    if (!value || value === '[]' || value === '[[]]') return [];
    try {
      // Remove outer brackets and split by "], [" pattern
      const cleaned = value.replace(/^\[|\]$/g, '').trim();
      if (!cleaned) return [];
      // Match pairs like [1, 6] or [2, 3]
      const pairMatches = cleaned.match(/\[([^\]]+)\]/g);
      if (!pairMatches) return [];

      return pairMatches.map(pair => {
        // Remove brackets and split by comma
        const inner = pair.replace(/^\[|\]$/g, '');
        const parts = inner.split(',').map(p => p.trim());
        return {
          left: parts[0] || '',
          right: parts[1] || ''
        };
      });
    } catch {
      return [];
    }
  };

  // Format array of {left, right} pairs into pad_amount string: "[[1, 6], [2, 3]]"
  private formatPadAmount = (pairs: Array<{left: string; right: string}>): string => {
    if (!pairs || pairs.length === 0) return '[]';
    // Only include pairs where both left and right are integers
    const validPairs = pairs.filter(p =>
      /^-?\d+$/.test(p.left.trim()) && /^-?\d+$/.test(p.right.trim())
    );
    if (validPairs.length === 0) return '[]';

    const formatted = validPairs.map(p => `[${p.left.trim()}, ${p.right.trim()}]`);
    return `[${formatted.join(', ')}]`;
  };

  private handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const { existingAttribute, attributeCtor, layerId, attributeType, elements } = this.props;
    const isChecking = e.target.checked;

    // Update local state immediately for responsive UI
    this.setState({ isChecked: isChecking });

    if (isChecking) {
      const config = getWidgetConfig(attributeType);

      // For predecessor / layers_of_tensors / subscript_indices / pad_amount: don't create attribute yet, wait for user selection
      if (config.widget === 'predecessor' || config.widget === 'layers_of_tensors' || config.widget === 'subscript_indices' || config.widget === 'pad_amount') {
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
        // Apply defaultValue from config if no value set
        else if (config.defaultValue && !instance.value) {
          instance.value = config.defaultValue;
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
        this.setState({ localValue: '', isChecked: false, tensorSelections: [], subscriptDimensions: [], padAmountPairs: [] });
      } else {
        // No attribute exists, just reset local state
        this.setState({ isChecked: false, tensorSelections: [], subscriptDimensions: [], padAmountPairs: [] });
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

    // Special validation for input_var: must start with alphabet
    if (existingAttribute?.attributeName === 'input_var') {
      if (str === '') {
        this.setState({ validationError: null });
      } else if (/^[a-zA-Z]/.test(str)) {
        // Valid: starts with alphabet
        this.setState({ validationError: null });
        this.props.update<Conv1DAttribute>(existingAttribute!.id, {
          value: str, name: `${existingAttribute!.attributeName} = ${str}`
        } as Partial<Conv1DAttribute>);
      } else {
        this.setState({ validationError: `Must start with an alphabet letter (a-z, A-Z)` });
      }
      return;
    }

    // Special validation for interpolate_size: must be a tuple like (224, 224) or (112, 112, 112)
    if (existingAttribute?.attributeName === 'interpolate_size') {
      // Tuple format: (int, int, ...) with matched parentheses
      const TUPLE_STRICT_REGEX = /^\(\s*\d+(\s*,\s*\d+)*\s*\)$/;
      const TUPLE_PERMISSIVE_REGEX = /^(\((\d+(\s*,\s*\d+)*(\s*,?\s*)?)?\)?)$/;

      if (str === '' || TUPLE_PERMISSIVE_REGEX.test(str)) {
        if (TUPLE_STRICT_REGEX.test(str)) {
          // Valid complete tuple
          this.setState({ validationError: null });
          this.props.update<Conv1DAttribute>(existingAttribute!.id, {
            value: str, name: `${existingAttribute!.attributeName} = ${str}`
          } as Partial<Conv1DAttribute>);
        } else {
          // Intermediate state (typing in progress)
          this.setState({ validationError: null });
        }
      } else {
        // Invalid format
        this.setState({ validationError: `Must be a tuple of integers. Example: (224, 224)` });
      }
      return;
    }

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
        // Range validation for dropout_rate (must be between 0 and 1)
        if (existingAttribute!.attributeName === 'dropout_rate') {
          const numValue = Number(str);
          if (numValue < 0 || numValue > 1) {
            this.setState({ validationError: `Must be between 0 and 1. Example: ${getAttributeDefaultValue(existingAttribute!)}` });
            return;
          }
        }
        this.setState({ validationError: null });
        this.props.update<Conv1DAttribute>(existingAttribute!.id, {
          value: str, name: `${existingAttribute!.attributeName} = ${str}`
        } as Partial<Conv1DAttribute>);
      } else {
        this.setState({ validationError: `Must be a number. Example: ${getAttributeDefaultValue(existingAttribute!)}` });
      }
    } else if (attrType === 'List') {
      // Special handling for split_sizes: accepts both int and list
      if (existingAttribute && existingAttribute.attributeName === 'split_sizes') {
        // Check if it's a valid integer
        const isValidInt = /^-?\d+$/.test(str);
        // Check if it's a valid list format (permissive or strict)
        const isValidList = LIST_STRICT_REGEX.test(str);
        const isIntermediateList = str === '' || LIST_PERMISSIVE_REGEX.test(str);

        if (str === '' || str === '-') {
          this.setState({ validationError: null });
        } else if (isValidInt || isValidList) {
          this.setState({ validationError: null });
          this.props.update<Conv1DAttribute>(existingAttribute!.id, {
            value: str, name: `${existingAttribute!.attributeName} = ${str}`
          } as Partial<Conv1DAttribute>);
        } else if (isIntermediateList) {
          this.setState({ validationError: null });
        } else {
          this.setState({ validationError: `Must be an integer (e.g., 3) or a list of integers (e.g., [2,3,5])` });
        }
      } else {
        // Standard list validation for other attributes
        const expected = getListExpectation(existingAttribute!.type, existingAttribute!.owner, this.props.elements);
        const isStringList = expected.type === 'string';
        const strictRegex = isStringList ? LIST_IDENTIFIER_STRICT_REGEX : LIST_STRICT_REGEX;
        const permissiveRegex = isStringList ? LIST_IDENTIFIER_PERMISSIVE_REGEX : LIST_PERMISSIVE_REGEX;

        if (str === '' || permissiveRegex.test(str)) {
          if (strictRegex.test(str)) {
            if (expected.count !== null) {
              const actualCount = str.replace(/^\[|\]$/g, '').split(',').filter((s) => s.trim() !== '').length;
              if (actualCount !== expected.count) {
                const typeLabel = isStringList ? 'string' : 'integer';
                this.setState({ validationError: `Must be a list with ${expected.count} ${typeLabel}${expected.count > 1 ? 's' : ''}. Example: ${expected.example}` });
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
          const typeLabel = isStringList ? 'strings' : 'integers';
          const countMsg = expected.count !== null ? ` with ${expected.count} ${typeLabel}` : ` of ${typeLabel}`;
          this.setState({ validationError: `Must be a list${countMsg}. Example: ${expected.example}` });
        }
      }
    } else {
      this.handleValueChange(newValue);
    }
  };

  private handleValidatedTextSubmit = (newValue: string | number) => {
    const { existingAttribute } = this.props;
    const str = String(newValue).trim();
    const attrType = existingAttribute?.attributeType;

    // Special validation for input_var: must start with alphabet
    if (existingAttribute?.attributeName === 'input_var') {
      if (/^[a-zA-Z]/.test(str) && str !== '') {
        // Valid: non-empty and starts with alphabet
        this.setState({ validationError: null });
        this.props.update<Conv1DAttribute>(existingAttribute!.id, {
          value: str, name: `${existingAttribute!.attributeName} = ${str}`
        } as Partial<Conv1DAttribute>);
      } else {
        // Invalid or empty: clear value and show error
        this.props.update<Conv1DAttribute>(existingAttribute!.id, {
          value: '', name: `${existingAttribute!.attributeName} = `
        } as Partial<Conv1DAttribute>);
        const errorMsg = str === '' ? null : `Must start with an alphabet letter (a-z, A-Z)`;
        this.setState((s) => ({ validationError: errorMsg, submitResetKey: s.submitResetKey + 1 }));
      }
      return;
    }

    // Special validation for interpolate_size on submit
    if (existingAttribute?.attributeName === 'interpolate_size') {
      const TUPLE_STRICT_REGEX = /^\(\s*\d+(\s*,\s*\d+)*\s*\)$/;

      if (TUPLE_STRICT_REGEX.test(str)) {
        // Valid tuple
        this.setState({ validationError: null });
        this.props.update<Conv1DAttribute>(existingAttribute!.id, {
          value: str, name: `${existingAttribute!.attributeName} = ${str}`
        } as Partial<Conv1DAttribute>);
      } else {
        // Invalid: clear value and show error
        this.props.update<Conv1DAttribute>(existingAttribute!.id, {
          value: '', name: `${existingAttribute!.attributeName} = `
        } as Partial<Conv1DAttribute>);
        const errorMsg = str === '' ? null : `Must be a tuple of integers. Example: (224, 224)`;
        this.setState((s) => ({ validationError: errorMsg, submitResetKey: s.submitResetKey + 1 }));
      }
      return;
    }

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
      // Special handling for split_sizes: accepts both int and list
      if (existingAttribute && existingAttribute.attributeName === 'split_sizes') {
        const isValidInt = /^-?\d+$/.test(str);
        const isValidList = LIST_STRICT_REGEX.test(str);

        if (isValidInt || isValidList) {
          this.setState({ validationError: null });
          this.props.update<Conv1DAttribute>(existingAttribute!.id, {
            value: str, name: `${existingAttribute!.attributeName} = ${str}`
          } as Partial<Conv1DAttribute>);
        } else if (str === '' || str === '-' || LIST_PERMISSIVE_REGEX.test(str)) {
          // Set to default empty and clear error if incomplete
          this.props.update<Conv1DAttribute>(existingAttribute!.id, {
            value: '', name: `${existingAttribute!.attributeName} = `
          } as Partial<Conv1DAttribute>);
          this.setState((s) => ({ validationError: null, submitResetKey: s.submitResetKey + 1 }));
        } else {
          // Invalid format
          this.props.update<Conv1DAttribute>(existingAttribute!.id, {
            value: '', name: `${existingAttribute!.attributeName} = `
          } as Partial<Conv1DAttribute>);
          this.setState((s) => ({
            validationError: `Must be an integer (e.g., 3) or a list of integers (e.g., [2,3,5])`,
            submitResetKey: s.submitResetKey + 1,
          }));
        }
      } else {
        // Standard list validation for other attributes
        const expected = getListExpectation(existingAttribute!.type, existingAttribute!.owner, this.props.elements);
        const isStringList = expected.type === 'string';
        const strictRegex = isStringList ? LIST_IDENTIFIER_STRICT_REGEX : LIST_STRICT_REGEX;
        const permissiveRegex = isStringList ? LIST_IDENTIFIER_PERMISSIVE_REGEX : LIST_PERMISSIVE_REGEX;

        if (strictRegex.test(str)) {
          if (expected.count !== null) {
            const actualCount = str.replace(/^\[|\]$/g, '').split(',').filter((s) => s.trim() !== '').length;
            if (actualCount !== expected.count) {
              const defaultVal = expected.example;
              this.props.update<Conv1DAttribute>(existingAttribute!.id, {
                value: defaultVal, name: `${existingAttribute!.attributeName} = ${defaultVal}`
              } as Partial<Conv1DAttribute>);
              const typeLabel = isStringList ? 'string' : 'integer';
              this.setState((s) => ({
                validationError: `Must be a list with ${expected.count} ${typeLabel}${expected.count! > 1 ? 's' : ''}. Example: ${expected.example}`,
                submitResetKey: s.submitResetKey + 1,
              }));
              return;
            }
          }
          this.setState({ validationError: null });
          this.props.update<Conv1DAttribute>(existingAttribute!.id, {
            value: str, name: `${existingAttribute!.attributeName} = ${str}`
          } as Partial<Conv1DAttribute>);
        } else if (str === '' || permissiveRegex.test(str)) {
          const defaultVal = expected.example;
          this.props.update<Conv1DAttribute>(existingAttribute!.id, {
            value: defaultVal, name: `${existingAttribute!.attributeName} = ${defaultVal}`
          } as Partial<Conv1DAttribute>);
          this.setState((s) => ({ validationError: null, submitResetKey: s.submitResetKey + 1 }));
        } else {
          const defaultVal = expected.example;
          this.props.update<Conv1DAttribute>(existingAttribute!.id, {
            value: defaultVal, name: `${existingAttribute!.attributeName} = ${defaultVal}`
          } as Partial<Conv1DAttribute>);
          const typeLabel = isStringList ? 'strings' : 'integers';
          const countMsg = expected.count !== null ? ` with ${expected.count} ${typeLabel}` : ` of ${typeLabel}`;
          this.setState((s) => ({
            validationError: `Must be a list${countMsg}. Example: ${expected.example}`,
            submitResetKey: s.submitResetKey + 1,
          }));
        }
      }
    } else {
      this.handleValueChange(newValue);
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
    const { existingAttribute, attributeCtor, layerId } = this.props;

    // Always add when checked (never remove)
    if (!event.target.checked) {
      return;
    }

    const rawValue = existingAttribute?.value || '[]';
    const cleanedValue = rawValue.replace(/^\[|\]$/g, '');
    const currentValues = cleanedValue ? cleanedValue.split(',').map(v => v.trim()) : [];

    // Add the new value to the end of the list
    const newValues = [...currentValues, option];
    const newValue = `[${newValues.join(', ')}]`;

    if (!existingAttribute) {
      // Create attribute with the new value
      const instance = new attributeCtor({ owner: layerId });
      instance.value = newValue;
      instance.name = `${instance.attributeName} = ${newValue}`;
      this.props.create(instance, layerId);
      this.props.appendToParent(instance.id, layerId);
      this.setState({ localValue: newValue, isChecked: true });
    } else {
      // Update attribute
      this.props.update<Conv1DAttribute>(existingAttribute.id, {
        value: newValue,
        name: `${existingAttribute.attributeName} = ${newValue}`
      } as Partial<Conv1DAttribute>);
    }

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
    const valueStr = String(newValue);
    const { existingAttribute, attributeCtor, layerId, tnsType } = this.props;
    const category = tnsType ? getTnsTypeCategory(tnsType) : 'binary';

    // Update the tensor at the specified index
    const newSelections = [...this.state.tensorSelections];
    newSelections[tensorIndex] = valueStr;

    // Update local state immediately
    this.setState({ tensorSelections: newSelections });

    // Determine if we have the minimum required selections
    const requiredCount = (category === 'unary') ? 1 : 2;
    const nonEmptySelections = newSelections.filter(s => s !== '');
    const hasMinimum = nonEmptySelections.length >= requiredCount;

    if (hasMinimum) {
      const formattedValue = this.formatLayersOfTensors(nonEmptySelections);

      if (!existingAttribute) {
        // Create the attribute
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
    } else if (existingAttribute && nonEmptySelections.length === 0) {
      // Only delete if ALL selections are empty (user explicitly cleared everything)
      this.props.delete(existingAttribute.id);
      this.setState({ localValue: '' });
    }
    // If some but not enough selections, keep the UI state but don't update the attribute
  };

  // Handler to add a new tensor element (for N-ary operations)
  private handleAddTensorElement = () => {
    this.setState(prevState => ({
      tensorSelections: [...prevState.tensorSelections, '']
    }));
  };

  // Handler to remove a tensor element at given index (for N-ary operations)
  private handleRemoveTensorElement = (index: number) => {
    const { existingAttribute } = this.props;
    const newSelections = this.state.tensorSelections.filter((_, i) => i !== index);

    this.setState({ tensorSelections: newSelections });

    // Update or delete attribute based on remaining selections
    const filteredSelections = newSelections.filter(s => s !== '');
    if (filteredSelections.length >= 2) {
      const formattedValue = this.formatLayersOfTensors(filteredSelections);
      if (existingAttribute) {
        this.props.update<Conv1DAttribute>(existingAttribute.id, {
          value: formattedValue,
          name: `${existingAttribute.attributeName} = ${formattedValue}`
        } as Partial<Conv1DAttribute>);
      }
    } else if (existingAttribute) {
      this.props.delete(existingAttribute.id);
      this.setState({ localValue: '' });
    }
  };

  // Handler for subscript dimension type change
  private handleSubscriptDimensionTypeChange = (index: number) => (newType: 'index' | 'slice') => {
    const { existingAttribute, attributeCtor, layerId } = this.props;

    const newDimensions = [...this.state.subscriptDimensions];
    if (newType === 'index') {
      newDimensions[index] = { type: 'index', value: 0 };
    } else {
      newDimensions[index] = { type: 'slice' };
    }

    this.setState({ subscriptDimensions: newDimensions });

    const formattedValue = this.formatSubscriptIndices(newDimensions);

    if (!existingAttribute) {
      const instance = new attributeCtor({ owner: layerId });
      instance.value = formattedValue;
      instance.name = `${instance.attributeName} = ${formattedValue}`;
      this.props.create(instance, layerId);
      this.props.appendToParent(instance.id, layerId);
      this.setState({ localValue: formattedValue, isChecked: true });
    } else {
      this.props.update<Conv1DAttribute>(existingAttribute.id, {
        value: formattedValue,
        name: `${existingAttribute.attributeName} = ${formattedValue}`
      } as Partial<Conv1DAttribute>);
    }
  };

  // Handler for subscript dimension field change (value for index, start/stop/step for slice)
  private handleSubscriptDimensionFieldChange = (index: number, field: 'value' | 'start' | 'stop' | 'step') => (newValue: string | number) => {
    const { existingAttribute, attributeCtor, layerId } = this.props;
    const valueStr = String(newValue).trim();
    const numValue = valueStr === '' ? undefined : parseInt(valueStr, 10);

    if (valueStr !== '' && isNaN(numValue!)) return; // Invalid input

    const newDimensions = [...this.state.subscriptDimensions];
    newDimensions[index] = { ...newDimensions[index], [field]: numValue };

    this.setState({ subscriptDimensions: newDimensions });

    const formattedValue = this.formatSubscriptIndices(newDimensions);

    if (!existingAttribute) {
      const instance = new attributeCtor({ owner: layerId });
      instance.value = formattedValue;
      instance.name = `${instance.attributeName} = ${formattedValue}`;
      this.props.create(instance, layerId);
      this.props.appendToParent(instance.id, layerId);
      this.setState({ localValue: formattedValue, isChecked: true });
    } else {
      this.props.update<Conv1DAttribute>(existingAttribute.id, {
        value: formattedValue,
        name: `${existingAttribute.attributeName} = ${formattedValue}`
      } as Partial<Conv1DAttribute>);
    }
  };

  // Handler to add a new subscript dimension
  private handleAddSubscriptDimension = () => {
    const { existingAttribute, attributeCtor, layerId } = this.props;

    const newDimensions = [...this.state.subscriptDimensions, { type: 'index', value: 0 }];
    this.setState({ subscriptDimensions: newDimensions });

    const formattedValue = this.formatSubscriptIndices(newDimensions);

    if (!existingAttribute) {
      const instance = new attributeCtor({ owner: layerId });
      instance.value = formattedValue;
      instance.name = `${instance.attributeName} = ${formattedValue}`;
      this.props.create(instance, layerId);
      this.props.appendToParent(instance.id, layerId);
      this.setState({ localValue: formattedValue, isChecked: true });
    } else {
      this.props.update<Conv1DAttribute>(existingAttribute.id, {
        value: formattedValue,
        name: `${existingAttribute.attributeName} = ${formattedValue}`
      } as Partial<Conv1DAttribute>);
    }
  };

  // Handler to remove a subscript dimension at given index
  private handleRemoveSubscriptDimension = (index: number) => {
    const { existingAttribute } = this.props;
    const newDimensions = this.state.subscriptDimensions.filter((_, i) => i !== index);

    this.setState({ subscriptDimensions: newDimensions });

    if (newDimensions.length > 0) {
      const formattedValue = this.formatSubscriptIndices(newDimensions);
      if (existingAttribute) {
        this.props.update<Conv1DAttribute>(existingAttribute.id, {
          value: formattedValue,
          name: `${existingAttribute.attributeName} = ${formattedValue}`
        } as Partial<Conv1DAttribute>);
      }
    } else if (existingAttribute) {
      this.props.delete(existingAttribute.id);
      this.setState({ localValue: '' });
    }
  };

  // Handler for repeat_dim dimension change
  private handleRepeatDimChange = (index: number) => (newValue: string | number) => {
    const valueStr = String(newValue);
    const { existingAttribute, attributeCtor, layerId } = this.props;

    const newDimensions = [...this.state.repeatDimensions];
    newDimensions[index] = valueStr;

    this.setState({ repeatDimensions: newDimensions });

    // Only update/create attribute if we have at least one non-empty dimension
    const nonEmptyDimensions = newDimensions.filter(d => d.trim() !== '');
    if (nonEmptyDimensions.length > 0) {
      const formattedValue = this.formatRepeatDim(newDimensions);

      if (!existingAttribute) {
        const instance = new attributeCtor({ owner: layerId });
        instance.value = formattedValue;
        instance.name = `${instance.attributeName} = ${formattedValue}`;
        this.props.create(instance, layerId);
        this.props.appendToParent(instance.id, layerId);
        this.setState({ localValue: formattedValue, isChecked: true });
      } else {
        this.props.update<Conv1DAttribute>(existingAttribute.id, {
          value: formattedValue,
          name: `${existingAttribute.attributeName} = ${formattedValue}`
        } as Partial<Conv1DAttribute>);
      }
    } else if (existingAttribute && nonEmptyDimensions.length === 0) {
      // Delete if all dimensions are empty
      this.props.delete(existingAttribute.id);
      this.setState({ localValue: '' });
    }
  };

  // Handler to add a new repeat_dim dimension
  private handleAddRepeatDim = () => {
    this.setState((prevState) => ({
      repeatDimensions: [...prevState.repeatDimensions, '']
    }));
  };

  // Handler to remove a repeat_dim dimension at given index
  private handleRemoveRepeatDim = (index: number) => {
    const { existingAttribute } = this.props;
    const newDimensions = this.state.repeatDimensions.filter((_, i) => i !== index);

    this.setState({ repeatDimensions: newDimensions });

    // Update or delete attribute based on remaining dimensions
    const filteredDimensions = newDimensions.filter(d => d.trim() !== '');
    if (filteredDimensions.length > 0) {
      const formattedValue = this.formatRepeatDim(newDimensions);
      if (existingAttribute) {
        this.props.update<Conv1DAttribute>(existingAttribute.id, {
          value: formattedValue,
          name: `${existingAttribute.attributeName} = ${formattedValue}`
        } as Partial<Conv1DAttribute>);
      }
    } else if (existingAttribute) {
      this.props.delete(existingAttribute.id);
      this.setState({ localValue: '' });
    }
  };

  // Handler to change a pad_amount pair field (left or right)
  private handlePadAmountPairChange = (index: number, field: 'left' | 'right') => (newValue: string | number) => {
    const valueStr = String(newValue);
    const { existingAttribute, attributeCtor, layerId } = this.props;

    const newPairs = [...this.state.padAmountPairs];
    newPairs[index] = { ...newPairs[index], [field]: valueStr };

    this.setState({ padAmountPairs: newPairs });

    // Only update/create attribute if we have at least one valid pair
    const validPairs = newPairs.filter(p =>
      /^-?\d+$/.test(p.left.trim()) && /^-?\d+$/.test(p.right.trim())
    );
    if (validPairs.length > 0) {
      const formattedValue = this.formatPadAmount(newPairs);

      if (!existingAttribute) {
        const instance = new attributeCtor({ owner: layerId });
        instance.value = formattedValue;
        instance.name = `${instance.attributeName} = ${formattedValue}`;
        this.props.create(instance, layerId);
        this.props.appendToParent(instance.id, layerId);
        this.setState({ localValue: formattedValue, isChecked: true });
      } else {
        this.props.update<Conv1DAttribute>(existingAttribute.id, {
          value: formattedValue,
          name: `${existingAttribute.attributeName} = ${formattedValue}`
        } as Partial<Conv1DAttribute>);
      }
    } else if (existingAttribute && validPairs.length === 0) {
      // Delete if no valid pairs
      this.props.delete(existingAttribute.id);
      this.setState({ localValue: '' });
    }
  };

  // Handler to add a new pad_amount pair
  private handleAddPadAmountPair = () => {
    this.setState((prevState) => ({
      padAmountPairs: [...prevState.padAmountPairs, { left: '', right: '' }]
    }));
  };

  // Handler to remove a pad_amount pair at given index
  private handleRemovePadAmountPair = (index: number) => {
    const { existingAttribute } = this.props;
    const newPairs = this.state.padAmountPairs.filter((_, i) => i !== index);

    this.setState({ padAmountPairs: newPairs });

    // Update or delete attribute based on remaining pairs
    const validPairs = newPairs.filter(p =>
      /^-?\d+$/.test(p.left.trim()) && /^-?\d+$/.test(p.right.trim())
    );
    if (validPairs.length > 0) {
      const formattedValue = this.formatPadAmount(newPairs);
      if (existingAttribute) {
        this.props.update<Conv1DAttribute>(existingAttribute.id, {
          value: formattedValue,
          name: `${existingAttribute.attributeName} = ${formattedValue}`
        } as Partial<Conv1DAttribute>);
      }
    } else if (existingAttribute) {
      this.props.delete(existingAttribute.id);
      this.setState({ localValue: '' });
    }
  };

  render() {
    const { label, attributeType, attributeValue, predecessorNames, tensorOpNames, tnsType } = this.props;
    const { isChecked, tensorSelections } = this.state;
    const config = getWidgetConfig(attributeType);

    // Always use Redux value if available (handles external updates like dimension change)
    const localValue = attributeValue || '';

    // For dropdowns: if the stored value is not in the options list (e.g. legacy values like
    // 'zeros' for padding or 'output' for return_type), fall back to the config's defaultValue.
    const displayValue = (config.widget === 'dropdown' && config.options && !config.options.includes(localValue))
      ? config.defaultValue ?? ''
      : localValue;

    // Determine category for layers_of_tensors widget
    const category: TnsTypeCategory = tnsType ? getTnsTypeCategory(tnsType) : 'binary';
    const initialCount = (category === 'unary') ? 1 : 2;

    // Ensure we have enough elements in tensorSelections array
    const displaySelections = [...tensorSelections];
    while (displaySelections.length < initialCount) {
      displaySelections.push('');
    }

    // Ensure subscriptDimensions has at least one element when displayed
    const displaySubscriptDimensions = this.state.subscriptDimensions.length > 0
      ? [...this.state.subscriptDimensions]
      : [''];

    // Ensure repeatDimensions has at least one element when displayed
    const displayRepeatDimensions = this.state.repeatDimensions.length > 0
      ? [...this.state.repeatDimensions]
      : [''];

    return (
      <div style={{ marginTop: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', width: '100%' }}>
          <input
            type="checkbox"
            checked={isChecked}
            onChange={this.handleCheckboxChange}
            style={{ marginTop: '4px' }}
          />
          <AttributeInputContainer style={
            isChecked && config.widget === 'layers_of_tensors'
              ? { flexDirection: 'column', alignItems: 'flex-start' }
              : undefined
          }>
            <AttributeLabel style={
              isChecked && config.widget === 'layers_of_tensors'
                ? { display: 'block', marginBottom: '4px' }
                : undefined
            }>{label} = </AttributeLabel>
            {isChecked ? (
              config.widget === 'layers_of_tensors' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
                  {displaySelections.map((selection, index) => {
                    const ordinal = index === 0 ? '1st' : index === 1 ? '2nd' : `${index + 1}th`;
                    return (
                      <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontSize: '11px', minWidth: '30px' }}>{ordinal}:</span>
                        {category === 'binary' ? (
                          // Binary: allow dropdown OR text input for numeric literals
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexGrow: 1 }}>
                            <Dropdown
                              value={/^-?\d+(\.\d+)?$/.test(selection) ? '' : selection}
                              onChange={this.handleTensorChange(index)}
                              size="sm"
                              outline
                              style={{ flexGrow: 1 }}
                            >
                              {[
                                <Dropdown.Item key="__empty__" value="">
                                  {'(select or enter number)'}
                                </Dropdown.Item>,
                                ...predecessorNames.map(name => (
                                  <Dropdown.Item key={name} value={name}>
                                    {name}
                                  </Dropdown.Item>
                                ))
                              ]}
                            </Dropdown>
                            <span style={{ fontSize: '11px' }}>or</span>
                            <Textfield
                              gutter
                              value={/^-?\d+(\.\d+)?$/.test(selection) ? selection : ''}
                              onChange={(val) => this.handleTensorChange(index)(String(val))}
                              placeholder="numeric"
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
                        )}
                        {category === 'n-ary' && index >= 2 && (
                          <button
                            onClick={() => this.handleRemoveTensorElement(index)}
                            style={{
                              padding: '2px 6px',
                              fontSize: '11px',
                              cursor: 'pointer',
                              background: '#dc3545',
                              color: 'white',
                              border: 'none',
                              borderRadius: '3px'
                            }}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {category === 'n-ary' && (
                    <button
                      onClick={this.handleAddTensorElement}
                      style={{
                        padding: '4px 8px',
                        fontSize: '11px',
                        cursor: 'pointer',
                        background: '#28a745',
                        color: 'white',
                        border: 'none',
                        borderRadius: '3px',
                        marginTop: '4px'
                      }}
                    >
                      + Add Element
                    </button>
                  )}
                </div>
              ) : config.widget === 'subscript_indices' ? (
                <span style={{ color: '#999' }}>see below</span>
              ) : config.widget === 'repeat_dim' ? (
                <span style={{ color: '#999' }}>see below</span>
              ) : config.widget === 'pad_amount' ? (
                <span style={{ color: '#999' }}>see below</span>
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
              ) : config.widget === 'multiselect' ? (
                <MultiSelectContainer onClick={(e) => e.stopPropagation()}>
                  <DropdownButton
                    ref={this.multiSelectButtonRef}
                    color="primary"
                    onClick={this.toggleMultiSelect}
                    outline={true}
                    size="sm"
                  >
                    {(() => {
                      const rawValue = localValue || '[]';
                      const cleanedValue = rawValue.replace(/^\[|\]$/g, '');
                      const selectedValues = cleanedValue ? cleanedValue.split(',').map(v => v.trim()) : [];
                      return selectedValues.length > 0 ? `[${selectedValues.join(', ')}]` : 'Select values';
                    })()}
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
                      {config.options!.map(option => (
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
              ) : (
                <Textfield
                  key={this.state.submitResetKey}
                  gutter
                  value={localValue}
                  onChange={this.handleValidatedTextChange}
                  onSubmit={this.handleValidatedTextSubmit}
                  placeholder={config.placeholder || "value"}
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
        {!this.state.validationError && this.props.existingAttribute?.attributeName === 'split_sizes' && isChecked && (
          <div style={{
            fontSize: '11px',
            color: '#666',
            marginTop: '6px',
            marginLeft: '24px',
            width: 'calc(100% - 24px)'
          }}>
            Either int (number of equal chunks, e.g. 3) or list (size per chunk, e.g. [2,3,5])
          </div>
        )}
        {!this.state.validationError && this.props.existingAttribute?.attributeName === 'split_dim' && isChecked && (
          <div style={{
            fontSize: '11px',
            color: '#666',
            marginTop: '6px',
            marginLeft: '24px',
            width: 'calc(100% - 24px)'
          }}>
            Dimension along which to split (supports negative indexing)
          </div>
        )}
        {!this.state.validationError && this.props.existingAttribute?.attributeName === 'actual_vars' && isChecked && (
          <div style={{
            fontSize: '11px',
            color: '#666',
            marginTop: '6px',
            marginLeft: '24px',
            width: 'calc(100% - 24px)'
          }}>
            Each element is either "output" or "hidden", corresponding to each input in layers_of_tensors
          </div>
        )}
        {!this.state.validationError && this.props.existingAttribute?.attributeName === 'interpolate_size' && isChecked && (
          <div style={{
            fontSize: '11px',
            color: '#666',
            marginTop: '6px',
            marginLeft: '24px',
            width: 'calc(100% - 24px)'
          }}>
            Target dimensions as tuple (H, W) or (D, H, W). Example: (224, 224) for 2D resize
          </div>
        )}
        {config.widget === 'subscript_indices' && isChecked && (
          <>
            <div style={{
              fontSize: '11px',
              color: '#666',
              marginTop: '6px',
              marginLeft: '24px',
              width: 'calc(100% - 24px)'
            }}>
              Each dimension: index (single value) or slice (start:stop:step, all optional)
            </div>
            {displaySubscriptDimensions.map((dimension, index) => (
              <div key={index} style={{ marginTop: '6px', marginLeft: '24px', width: 'calc(100% - 24px)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '11px', minWidth: '40px' }}>Dim {index + 1}:</span>
                  <Dropdown
                    value={dimension.type}
                    onChange={(val) => this.handleSubscriptDimensionTypeChange(index)(val as 'index' | 'slice')}
                    size="sm"
                    outline
                    placeholder="type"
                    style={{ minWidth: '70px', maxWidth: '70px' }}
                  >
                    <Dropdown.Item value="index">index</Dropdown.Item>
                    <Dropdown.Item value="slice">slice</Dropdown.Item>
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
                      <Textfield
                        gutter
                        value={dimension.start !== undefined ? String(dimension.start) : ''}
                        onChange={(val) => this.handleSubscriptDimensionFieldChange(index, 'start')(String(val))}
                        placeholder="start"
                        style={{ flexGrow: 1, minWidth: '50px' }}
                      />
                      <span style={{ fontSize: '11px' }}>:</span>
                      <Textfield
                        gutter
                        value={dimension.stop !== undefined ? String(dimension.stop) : ''}
                        onChange={(val) => this.handleSubscriptDimensionFieldChange(index, 'stop')(String(val))}
                        placeholder="stop"
                        style={{ flexGrow: 1, minWidth: '50px' }}
                      />
                      <span style={{ fontSize: '11px' }}>:</span>
                      <Textfield
                        gutter
                        value={dimension.step !== undefined ? String(dimension.step) : ''}
                        onChange={(val) => this.handleSubscriptDimensionFieldChange(index, 'step')(String(val))}
                        placeholder="step"
                        style={{ flexGrow: 1, minWidth: '50px' }}
                      />
                    </>
                  )}
                  {index > 0 && (
                    <button
                      onClick={() => this.handleRemoveSubscriptDimension(index)}
                      style={{
                        padding: '2px 6px',
                        fontSize: '11px',
                        cursor: 'pointer',
                        background: '#dc3545',
                        color: 'white',
                        border: 'none',
                        borderRadius: '3px',
                        flexShrink: 0
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))}
            <button
              onClick={this.handleAddSubscriptDimension}
              style={{
                padding: '4px 8px',
                fontSize: '11px',
                cursor: 'pointer',
                background: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                marginTop: '6px',
                marginLeft: '24px'
              }}
            >
              + Add Dimension
            </button>
            <div style={{
              marginTop: '6px',
              marginLeft: '24px',
              padding: '6px 8px',
              background: '#f5f5f5',
              border: '1px solid #ddd',
              borderRadius: '3px',
              fontSize: '11px',
              fontFamily: 'monospace',
              color: '#333',
              width: 'calc(100% - 24px - 16px)'
            }}>
              <strong>Value:</strong> {this.formatSubscriptIndicesDisplay(this.state.subscriptDimensions)}
            </div>
          </>
        )}
        {config.widget === 'repeat_dim' && isChecked && (
          <>
            <div style={{
              fontSize: '11px',
              color: '#666',
              marginTop: '6px',
              marginLeft: '24px',
              width: 'calc(100% - 24px)'
            }}>
              List of integers or strings (layer/tensorop names for dynamic values). Example: [1, 'op_3', 1] means repeat 1x on dim 0, op_3 times on dim 1, 1x on dim 2.
            </div>
            {displayRepeatDimensions.map((dimension, index) => (
              <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px', marginLeft: '24px', width: 'calc(100% - 24px)' }}>
                <span style={{ fontSize: '11px', minWidth: '50px' }}>Dim {index + 1}:</span>
                <Dropdown
                  value={/^-?\d+$/.test(dimension.trim()) ? '' : dimension}
                  onChange={(val) => this.handleRepeatDimChange(index)(String(val))}
                  size="sm"
                  outline
                  style={{ flexGrow: 1 }}
                >
                  {[
                    <Dropdown.Item key="__empty__" value="">
                      {'(select layer/tensorop)'}
                    </Dropdown.Item>,
                    ...predecessorNames.map(name => (
                      <Dropdown.Item key={name} value={name}>
                        {name}
                      </Dropdown.Item>
                    ))
                  ]}
                </Dropdown>
                <span style={{ fontSize: '11px' }}>or</span>
                <Textfield
                  gutter
                  value={/^-?\d+$/.test(dimension.trim()) ? dimension : ''}
                  onChange={(val) => this.handleRepeatDimChange(index)(String(val))}
                  placeholder="enter int"
                  style={{ width: '80px' }}
                />
                {index > 0 && (
                  <button
                    onClick={() => this.handleRemoveRepeatDim(index)}
                    style={{
                      padding: '2px 6px',
                      fontSize: '11px',
                      cursor: 'pointer',
                      background: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '3px'
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={this.handleAddRepeatDim}
              style={{
                padding: '4px 8px',
                fontSize: '11px',
                cursor: 'pointer',
                background: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                marginTop: '6px',
                marginLeft: '24px'
              }}
            >
              + Add Dimension
            </button>
            <div style={{
              marginTop: '6px',
              marginLeft: '24px',
              padding: '6px 8px',
              background: '#f5f5f5',
              border: '1px solid #ddd',
              borderRadius: '3px',
              fontSize: '11px',
              fontFamily: 'monospace',
              color: '#333',
              width: 'calc(100% - 24px - 16px)'
            }}>
              <strong>Value:</strong> {this.formatRepeatDim(this.state.repeatDimensions)}
            </div>
          </>
        )}
        {config.widget === 'pad_amount' && isChecked && (
          <>
            <div style={{
              fontSize: '11px',
              color: '#666',
              marginTop: '6px',
              marginLeft: '24px',
              width: 'calc(100% - 24px)'
            }}>
              List of [left, right] integer pairs for padding. Example: [[1, 6], [2, 3]] means pad dimension 0 with 1 on left and 6 on right, dimension 1 with 2 on left and 3 on right.
            </div>
            {this.state.padAmountPairs.map((pair, index) => (
              <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px', marginLeft: '24px', width: 'calc(100% - 24px)' }}>
                <span style={{ fontSize: '11px', minWidth: '50px' }}>Dim {index + 1}:</span>
                <span style={{ fontSize: '11px' }}>left:</span>
                <Textfield
                  gutter
                  value={pair.left}
                  onChange={(val) => this.handlePadAmountPairChange(index, 'left')(String(val))}
                  placeholder="int"
                  style={{ width: '60px' }}
                />
                <span style={{ fontSize: '11px' }}>right:</span>
                <Textfield
                  gutter
                  value={pair.right}
                  onChange={(val) => this.handlePadAmountPairChange(index, 'right')(String(val))}
                  placeholder="int"
                  style={{ width: '60px' }}
                />
                {index > 0 && (
                  <button
                    onClick={() => this.handleRemovePadAmountPair(index)}
                    style={{
                      padding: '2px 6px',
                      fontSize: '11px',
                      cursor: 'pointer',
                      background: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '3px'
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={this.handleAddPadAmountPair}
              style={{
                padding: '4px 8px',
                fontSize: '11px',
                cursor: 'pointer',
                background: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                marginTop: '6px',
                marginLeft: '24px'
              }}
            >
              + Add Dimension
            </button>
            <div style={{
              marginTop: '6px',
              marginLeft: '24px',
              padding: '6px 8px',
              background: '#f5f5f5',
              border: '1px solid #ddd',
              borderRadius: '3px',
              fontSize: '11px',
              fontFamily: 'monospace',
              color: '#333',
              width: 'calc(100% - 24px - 16px)'
            }}>
              <strong>Value:</strong> {this.formatPadAmount(this.state.padAmountPairs)}
            </div>
          </>
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