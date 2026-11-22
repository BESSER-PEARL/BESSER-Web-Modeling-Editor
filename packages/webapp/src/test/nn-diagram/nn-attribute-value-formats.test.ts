import { describe, expect, it } from 'vitest';
import {
  formatLayersOfTensors,
  formatPadAmount,
  formatRepeatDim,
  formatSubscriptIndices,
  formatSubscriptIndicesDisplay,
  isCompletePadAmountPair,
  parseLayersOfTensors,
  parsePadAmount,
  parseRepeatDim,
  parseSubscriptIndices,
} from '../../../../editor/src/main/packages/nn-diagram/nn-attribute-value-formats';

describe('layers_of_tensors', () => {
  it('round-trips names and numeric literals', () => {
    const value = "['conv_1', 1.5, -2]";
    expect(parseLayersOfTensors(value)).toEqual(['conv_1', '1.5', '-2']);
    expect(formatLayersOfTensors(parseLayersOfTensors(value))).toBe(value);
  });

  it('treats empty input as no selection', () => {
    expect(parseLayersOfTensors('')).toEqual([]);
    expect(parseLayersOfTensors('[]')).toEqual([]);
    expect(formatLayersOfTensors([])).toBe('[]');
  });
});

describe('subscript_indices', () => {
  const dims = [
    { type: 'index' as const, value: 0 },
    { type: 'slice' as const, start: 1, stop: 5 },
    { type: 'slice' as const },
    { type: 'slice' as const, start: 0, stop: 10, step: 2 },
  ];

  it('round-trips through the backend JSON form', () => {
    const json = formatSubscriptIndices(dims);
    expect(JSON.parse(json)).toEqual([
      { type: 'index', value: 0 },
      { type: 'slice', start: 1, stop: 5 },
      { type: 'slice' },
      { type: 'slice', start: 0, stop: 10, step: 2 },
    ]);
    expect(parseSubscriptIndices(json)).toEqual(dims);
  });

  it('renders the python-like preview', () => {
    expect(formatSubscriptIndicesDisplay(dims)).toBe('[0, 1:5, :, 0:10:2]');
  });

  it('ignores malformed input', () => {
    expect(parseSubscriptIndices('not json')).toEqual([]);
    expect(parseSubscriptIndices('{"type": "index"}')).toEqual([]);
  });
});

describe('repeat_dim', () => {
  it('round-trips integers and tensorop names', () => {
    const value = "[1, 'op_3', 2]";
    expect(parseRepeatDim(value)).toEqual(['1', 'op_3', '2']);
    expect(formatRepeatDim(parseRepeatDim(value))).toBe(value);
  });

  it('skips empty entries when formatting', () => {
    expect(formatRepeatDim(['1', '', ' 2 '])).toBe('[1, 2]');
    expect(formatRepeatDim(['', ''])).toBe('[]');
  });
});

describe('pad_amount', () => {
  it('round-trips [left, right] pairs', () => {
    const value = '[[1, 6], [2, 3]]';
    expect(parsePadAmount(value)).toEqual([
      { left: '1', right: '6' },
      { left: '2', right: '3' },
    ]);
    expect(formatPadAmount(parsePadAmount(value))).toBe(value);
  });

  it('only keeps pairs with two integers', () => {
    expect(isCompletePadAmountPair({ left: '1', right: '' })).toBe(false);
    expect(isCompletePadAmountPair({ left: '-1', right: '0' })).toBe(true);
    expect(formatPadAmount([{ left: '1', right: '' }, { left: '2', right: '3' }])).toBe('[[2, 3]]');
    expect(formatPadAmount([{ left: '1', right: '' }])).toBe('[]');
  });
});
