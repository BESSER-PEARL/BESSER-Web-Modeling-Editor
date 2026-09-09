import { describe, expect, it } from 'vitest';
import en from '../../../../i18n/en/editor.json';
import {
  getAttributeValidator,
  interpolate,
  validateOnChange,
  validateOnSubmit,
  ValidationContext,
} from '../../../../editor/src/main/packages/nn-diagram/nn-attribute-validators';
import { NNElementType } from '../../../../editor/src/main/packages/nn-diagram';

// Same lookup the editor's I18nProvider performs: dotted key into the English bundle
const translate = (key: string): string =>
  key.split('.').reduce((result: any, part) => result[part], en as any);

function ctx(overrides: Partial<ValidationContext>): ValidationContext {
  return {
    attributeName: 'attr',
    attributeType: 'str',
    elementType: 'Whatever',
    ownerId: null,
    elements: {},
    currentValue: '',
    translate,
    ...overrides,
  };
}

describe('interpolate', () => {
  it('fills every placeholder, repeated ones included', () => {
    expect(interpolate('{n} of {n} - {x}', { n: 2, x: 'y' })).toBe('2 of 2 - y');
  });
});

describe('getAttributeValidator', () => {
  it('prefers the attribute name over the declared type', () => {
    expect(getAttributeValidator('split_sizes', 'List')).toBe(getAttributeValidator('split_sizes', 'str'));
    expect(getAttributeValidator('dropout_rate', 'float')).not.toBe(getAttributeValidator('other', 'float'));
  });

  it('has no validator for attributes stored as typed', () => {
    expect(getAttributeValidator('name', 'str')).toBeNull();
    expect(validateOnChange('x', ctx({ attributeName: 'name' }))).toBeNull();
    expect(validateOnSubmit('x', ctx({ attributeName: 'name' }))).toBeNull();
  });
});

describe('int attributes', () => {
  const c = ctx({ attributeName: 'epochs', attributeType: 'int' });

  it('commits complete integers and waits on partial input', () => {
    expect(validateOnChange('12', c)).toEqual({ commit: true, error: null });
    expect(validateOnChange('-', c)).toEqual({ commit: false, error: null });
    expect(validateOnChange('', c)).toEqual({ commit: false, error: null });
  });

  it('explains invalid input with the attribute default as example', () => {
    expect(validateOnChange('1.5', c)).toEqual({ commit: false, error: 'Must be an integer. Example: 10' });
  });

  it('falls back to the default on an invalid submit, silently on an incomplete one', () => {
    expect(validateOnSubmit('7', c)).toEqual({ value: '7', error: null, reset: false });
    expect(validateOnSubmit('abc', c)).toEqual({ value: '10', error: 'Must be an integer. Example: 10', reset: true });
    expect(validateOnSubmit('-', c)).toEqual({ value: '10', error: null, reset: true });
  });
});

describe('float attributes', () => {
  const c = ctx({ attributeName: 'learning_rate', attributeType: 'float' });

  it('treats a trailing decimal point as still typing', () => {
    expect(validateOnChange('0.', c)).toEqual({ commit: false, error: null });
    expect(validateOnChange('0.01', c)).toEqual({ commit: true, error: null });
    expect(validateOnChange('x', c)).toEqual({ commit: false, error: 'Must be a number. Example: 0.001' });
  });

  it('keeps dropout_rate inside [0, 1]', () => {
    const rate = ctx({ attributeName: 'dropout_rate', attributeType: 'float' });
    expect(validateOnChange('0.3', rate)).toEqual({ commit: true, error: null });
    expect(validateOnChange('1.5', rate)).toEqual({ commit: false, error: 'Must be between 0 and 1. Example: 0.5' });
    expect(validateOnSubmit('2', rate)).toEqual({ value: '0.5', error: 'Must be between 0 and 1. Example: 0.5', reset: true });
  });
});

describe('identifier attributes (input_var)', () => {
  const c = ctx({ attributeName: 'input_var', attributeType: 'str' });

  it('requires a leading letter', () => {
    expect(validateOnChange('x1', c)).toEqual({ commit: true, error: null });
    expect(validateOnChange('1x', c)).toEqual({ commit: false, error: 'Must start with an alphabet letter (a-z, A-Z)' });
  });

  it('clears the field on an invalid submit', () => {
    expect(validateOnSubmit('1x', c)).toEqual({ value: '', error: 'Must start with an alphabet letter (a-z, A-Z)', reset: true });
    expect(validateOnSubmit('', c)).toEqual({ value: '', error: null, reset: true });
  });
});

describe('tuple attributes (interpolate_size)', () => {
  const c = ctx({ attributeName: 'interpolate_size', attributeType: 'str' });

  it('accepts complete tuples and tolerates partial ones while typing', () => {
    expect(validateOnChange('(224, 224)', c)).toEqual({ commit: true, error: null });
    expect(validateOnChange('(224,', c)).toEqual({ commit: false, error: null });
    expect(validateOnChange('224', c)).toEqual({ commit: false, error: 'Must be a tuple of integers. Example: (224, 224)' });
  });

  it('reports an incomplete tuple on submit', () => {
    expect(validateOnSubmit('(224,', c)).toEqual({ value: '', error: 'Must be a tuple of integers. Example: (224, 224)', reset: true });
  });
});

describe('split_sizes', () => {
  const c = ctx({ attributeName: 'split_sizes', attributeType: 'List' });

  it('accepts an integer or a list of integers', () => {
    expect(validateOnChange('3', c)).toEqual({ commit: true, error: null });
    expect(validateOnChange('[2, 3, 5]', c)).toEqual({ commit: true, error: null });
    expect(validateOnChange('[2,', c)).toEqual({ commit: false, error: null });
    expect(validateOnChange('a', c)).toEqual({
      commit: false,
      error: 'Must be an integer (e.g., 3) or a list of integers (e.g., [2,3,5])',
    });
  });
});

describe('list attributes', () => {
  it('enforces the expected item count with a singular/plural label', () => {
    const conv2dKernel = ctx({
      attributeName: 'kernel_dim',
      attributeType: 'List',
      elementType: NNElementType.KernelDimAttributeConv2D,
    });
    expect(validateOnChange('[3, 3]', conv2dKernel)).toEqual({ commit: true, error: null });
    expect(validateOnChange('[3]', conv2dKernel)).toEqual({
      commit: false,
      error: 'Must be a list with 2 integers. Example: [3, 3]',
    });
    const conv1dKernel = ctx({
      attributeName: 'kernel_dim',
      attributeType: 'List',
      elementType: NNElementType.KernelDimAttributeConv1D,
    });
    expect(validateOnChange('[3, 3]', conv1dKernel)).toEqual({
      commit: false,
      error: 'Must be a list with 1 integer. Example: [3]',
    });
  });

  it('falls back to the example list on submit', () => {
    const permute = ctx({
      attributeName: 'permute_dim',
      attributeType: 'List',
      elementType: NNElementType.PermuteDimAttributeTensorOp,
    });
    expect(validateOnSubmit('[0, 2, 1]', permute)).toEqual({ value: '[0, 2, 1]', error: null, reset: false });
    expect(validateOnSubmit('[0,', permute)).toEqual({ value: '[0, 2, 1]', error: null, reset: true });
    expect(validateOnSubmit('nope', permute)).toEqual({
      value: '[0, 2, 1]',
      error: 'Must be a list of integers. Example: [0, 2, 1]',
      reset: true,
    });
  });

  it('validates identifier lists for string-typed expectations', () => {
    const outputVars = ctx({
      attributeName: 'output_vars',
      attributeType: 'List',
      elementType: NNElementType.OutputVarsAttributeTensorOp,
    });
    expect(validateOnChange('[x1, x2]', outputVars)).toEqual({ commit: true, error: null });
    expect(validateOnChange('[1, 2]', outputVars)).toEqual({
      commit: false,
      error: 'Must be a list of strings. Example: [x1, x2, x3]',
    });
  });
});
