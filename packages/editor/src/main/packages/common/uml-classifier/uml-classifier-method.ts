import { UMLClassifierMember, VISIBILITY_SYMBOLS } from './uml-classifier-member';

export abstract class UMLClassifierMethod extends UMLClassifierMember {
  /** `tesr` -> `tesr()`, `+ tesr: int` -> `+ tesr(): int`; a signature with parentheses is kept. */
  static withParentheses(value: string): string {
    const trimmed = value.trim();
    if (!trimmed || trimmed.includes('(')) {
      return trimmed;
    }
    const colon = trimmed.indexOf(':');
    return colon < 0
      ? `${trimmed}()`
      : `${trimmed.substring(0, colon).trim()}(): ${trimmed.substring(colon + 1).trim()}`;
  }

  /** `+ name(params): returnType`; the popup edits this text and saves it as the name. */
  get displayName(): string {
    if (!this.name || /^[+\-#~]\s/.test(this.name)) {
      return this.name;
    }
    const signature = this.name.includes('(') ? this.name : `${this.name}()`;
    const declaresType = signature.substring(signature.lastIndexOf(')') + 1).trim().startsWith(':');
    const returnType = !declaresType && this.attributeType ? `: ${this.attributeType}` : '';
    return `${VISIBILITY_SYMBOLS[this.visibility] || '+'} ${signature}${returnType}`;
  }
}
