/**
 * A method was rendered like an attribute ("+ tesr: str", no parentheses), and
 * the method popup saved that text back as the name on the next edit, which
 * the backend then rejected ("Name cannot contain spaces").
 */
import { describe, expect, it } from 'vitest';

import { UMLClassMethod } from '../../../../editor/src/main/packages/uml-class-diagram/uml-class-method/uml-class-method';

describe('UMLClassMethod.withParentheses (a method typed in the class popup)', () => {
  it.each([
    ['tesr', 'tesr()'],
    ['tesr: int', 'tesr(): int'],
    ['+ tesr: int', '+ tesr(): int'],
    ['  find(title: str): Book ', 'find(title: str): Book'],
  ])('%s -> %s', (typed, stored) => {
    expect(UMLClassMethod.withParentheses(typed)).toBe(stored);
  });
});

describe('UMLClassMethod.displayName', () => {
  it('renders a bare name as a method signature', () => {
    expect(new UMLClassMethod({ name: 'tesr' }).displayName).toBe('+ tesr(): str');
  });

  it('keeps parameters and appends the return type once', () => {
    expect(new UMLClassMethod({ name: 'find(title: str)', attributeType: 'Book' }).displayName).toBe(
      '+ find(title: str): Book',
    );
    expect(new UMLClassMethod({ name: 'count(): int', attributeType: 'str' }).displayName).toBe('+ count(): int');
  });

  it('uses the visibility and omits an empty return type', () => {
    expect(new UMLClassMethod({ name: 'reset', visibility: 'private', attributeType: '' }).displayName).toBe(
      '- reset()',
    );
  });

  it('leaves a legacy full signature untouched', () => {
    expect(new UMLClassMethod({ name: '+ notify(sms: str): any' }).displayName).toBe('+ notify(sms: str): any');
  });
});
