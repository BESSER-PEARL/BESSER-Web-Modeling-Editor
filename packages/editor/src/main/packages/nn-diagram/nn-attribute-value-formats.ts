/**
 * Parse/format helpers for the structured NN attribute values that the
 * optional-attribute widgets edit as arrays (layers_of_tensors,
 * subscript_indices, repeat_dim, pad_amount). Pure functions: the stored
 * attribute value is always the string form, the widgets work on the
 * parsed form.
 */

export interface SubscriptDimension {
  type: 'index' | 'slice';
  value?: number;
  start?: number;
  stop?: number;
  step?: number;
}

export interface PadAmountPair {
  left: string;
  right: string;
}

const INT_REGEX = /^-?\d+$/;

/** Parse a layers_of_tensors value like "['a', 'b']" or "['x', 1.5]" into its elements. */
export function parseLayersOfTensors(value: string): string[] {
  if (!value || value === '[]') return [];
  const cleaned = value.replace(/^\[|\]$/g, '');
  // Quoted strings or numbers (including floats and negative numbers)
  const matches = cleaned.match(/('[^']*'|"[^"]*"|-?\d+(\.\d+)?)/g) || [];
  return matches.map((s) => s.replace(/^['"]|['"]$/g, '').trim());
}

/** Format layers_of_tensors elements: strings quoted, numbers as-is. */
export function formatLayersOfTensors(selections: string[]): string {
  if (!selections || selections.length === 0) return '[]';
  const formatted = selections.map((item) => (/^-?\d+(\.\d+)?$/.test(item) ? item : `'${item}'`));
  return `[${formatted.join(', ')}]`;
}

/** Parse a subscript_indices JSON value like '[{"type": "index", "value": 0}, {"type": "slice", "start": 1, "stop": 5}]'. */
export function parseSubscriptIndices(value: string): SubscriptDimension[] {
  if (!value || value === '[]') return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => {
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
}

/** Format subscript dimensions as the JSON string the backend expects. */
export function formatSubscriptIndices(dimensions: SubscriptDimension[]): string {
  if (!dimensions || dimensions.length === 0) return '[]';
  const formatted = dimensions.map((dim) => {
    if (dim.type === 'index') {
      return { type: 'index', value: dim.value };
    }
    const slice: any = { type: 'slice' };
    if (dim.start !== undefined) slice.start = dim.start;
    if (dim.stop !== undefined) slice.stop = dim.stop;
    if (dim.step !== undefined) slice.step = dim.step;
    return slice;
  });
  return JSON.stringify(formatted);
}

/** Human-readable subscript preview: [0, 1:5, :, -1]. */
export function formatSubscriptIndicesDisplay(dimensions: SubscriptDimension[]): string {
  if (!dimensions || dimensions.length === 0) return '[]';
  const formatted = dimensions.map((dim) => {
    if (dim.type === 'index') {
      return dim.value !== undefined ? String(dim.value) : '0';
    }
    const start = dim.start !== undefined ? String(dim.start) : '';
    const stop = dim.stop !== undefined ? String(dim.stop) : '';
    const step = dim.step !== undefined ? String(dim.step) : '';
    if (start === '' && stop === '' && step === '') return ':';
    if (step === '') return `${start}:${stop}`;
    return `${start}:${stop}:${step}`;
  });
  return `[${formatted.join(', ')}]`;
}

/** Parse a repeat_dim value like "[1, 'op_3', 2]" into its elements. */
export function parseRepeatDim(value: string): string[] {
  if (!value || value === '[]') return [];
  const cleaned = value.replace(/^\[|\]$/g, '').trim();
  if (!cleaned) return [];
  const matches = cleaned.match(/('[^']*'|"[^"]*"|-?\d+)/g) || [];
  return matches.map((m) => m.replace(/^['"]|['"]$/g, ''));
}

/** Format repeat_dim elements: integers as-is, tensorop names quoted; empty entries are skipped. */
export function formatRepeatDim(dimensions: string[]): string {
  if (!dimensions || dimensions.length === 0) return '[]';
  const nonEmpty = dimensions.filter((d) => d.trim() !== '');
  if (nonEmpty.length === 0) return '[]';
  const formatted = nonEmpty.map((d) => {
    const trimmed = d.trim();
    return INT_REGEX.test(trimmed) ? trimmed : `'${trimmed}'`;
  });
  return `[${formatted.join(', ')}]`;
}

/** Parse a pad_amount value "[[1, 6], [2, 3]]" into {left, right} pairs. */
export function parsePadAmount(value: string): PadAmountPair[] {
  if (!value || value === '[]' || value === '[[]]') return [];
  try {
    const cleaned = value.replace(/^\[|\]$/g, '').trim();
    if (!cleaned) return [];
    const pairMatches = cleaned.match(/\[([^\]]+)\]/g);
    if (!pairMatches) return [];
    return pairMatches.map((pair) => {
      const parts = pair.replace(/^\[|\]$/g, '').split(',').map((p) => p.trim());
      return { left: parts[0] || '', right: parts[1] || '' };
    });
  } catch {
    return [];
  }
}

/** A pad pair counts only when both sides are integers. */
export function isCompletePadAmountPair(pair: PadAmountPair): boolean {
  return INT_REGEX.test(pair.left.trim()) && INT_REGEX.test(pair.right.trim());
}

/** Format {left, right} pairs as "[[1, 6], [2, 3]]"; incomplete pairs are skipped. */
export function formatPadAmount(pairs: PadAmountPair[]): string {
  if (!pairs || pairs.length === 0) return '[]';
  const validPairs = pairs.filter(isCompletePadAmountPair);
  if (validPairs.length === 0) return '[]';
  return `[${validPairs.map((p) => `[${p.left.trim()}, ${p.right.trim()}]`).join(', ')}]`;
}
