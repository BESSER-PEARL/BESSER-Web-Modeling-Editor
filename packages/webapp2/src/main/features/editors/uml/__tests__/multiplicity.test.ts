import { describe, it, expect } from 'vitest';
import { parseMultiplicity, toERCardinality } from '@besser/wme';

describe('parseMultiplicity', () => {
  it('parses range form "1..1"', () => {
    expect(parseMultiplicity('1..1')).toEqual({ min: '1', max: '1' });
  });

  it('parses range form "0..*"', () => {
    expect(parseMultiplicity('0..*')).toEqual({ min: '0', max: '*' });
  });

  it('parses numeric range form "2..5"', () => {
    expect(parseMultiplicity('2..5')).toEqual({ min: '2', max: '5' });
  });

  it('expands bare "*" to "0..*"', () => {
    expect(parseMultiplicity('*')).toEqual({ min: '0', max: '*' });
  });

  it('expands bare number "3" to "3..3"', () => {
    expect(parseMultiplicity('3')).toEqual({ min: '3', max: '3' });
  });

  it('trims surrounding whitespace', () => {
    expect(parseMultiplicity('  1..*  ')).toEqual({ min: '1', max: '*' });
    expect(parseMultiplicity(' 1 .. 5 ')).toEqual({ min: '1', max: '5' });
  });

  it('returns null for empty or whitespace-only input', () => {
    expect(parseMultiplicity('')).toBeNull();
    expect(parseMultiplicity('   ')).toBeNull();
  });

  it('returns null for malformed ranges', () => {
    expect(parseMultiplicity('1..')).toBeNull();
    expect(parseMultiplicity('..*')).toBeNull();
    expect(parseMultiplicity('1..2..3')).toBeNull();
  });
});

describe('toERCardinality', () => {
  it('maps "1..1" to "(1,1)"', () => {
    expect(toERCardinality('1..1')).toBe('(1,1)');
  });

  it('maps shorthand "1" to "(1,1)"', () => {
    expect(toERCardinality('1')).toBe('(1,1)');
  });

  it('maps "0..*" to "(0,N)"', () => {
    expect(toERCardinality('0..*')).toBe('(0,N)');
  });

  it('maps shorthand "*" to "(0,N)"', () => {
    expect(toERCardinality('*')).toBe('(0,N)');
  });

  it('maps "1..*" to "(1,N)"', () => {
    expect(toERCardinality('1..*')).toBe('(1,N)');
  });

  it('collapses identical numeric bounds "5..5" to "(5,5)"', () => {
    expect(toERCardinality('5..5')).toBe('(5,5)');
  });

  it('preserves mixed numeric ranges "2..5" as "(2,5)"', () => {
    expect(toERCardinality('2..5')).toBe('(2,5)');
  });

  it('returns empty string for empty/undefined input', () => {
    expect(toERCardinality('')).toBe('');
    expect(toERCardinality(undefined)).toBe('');
  });

  it('returns malformed input verbatim so user intent is preserved', () => {
    expect(toERCardinality('1..')).toBe('1..');
    expect(toERCardinality('1..2..3')).toBe('1..2..3');
  });
});
