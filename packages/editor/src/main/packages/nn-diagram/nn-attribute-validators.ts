/**
 * Validation of free-text NN attribute values, shared by the mandatory
 * attribute popup and the optional attribute rows.
 *
 * One validator per value shape, selected by attribute name first (the few
 * attributes with their own grammar) and by declared attribute type
 * otherwise. The two dispatchers implement the editing contract every text
 * widget follows:
 *   - while typing (onChange): a complete value is committed, an incomplete
 *     one is left alone, an invalid one shows its message;
 *   - on submit (blur/enter): a complete value is committed, anything else
 *     is replaced by the validator's fallback and the field is reset.
 */
import {
  getAttributeDefaultValue,
  getListExpectation,
  LIST_IDENTIFIER_PERMISSIVE_REGEX,
  LIST_IDENTIFIER_STRICT_REGEX,
  LIST_PERMISSIVE_REGEX,
  LIST_STRICT_REGEX,
} from './nn-validation-defaults';

export type ValidationStatus = 'valid' | 'intermediate' | 'invalid';

export interface ValidationContext {
  /** Metamodel attribute name, e.g. 'input_var'. */
  attributeName: string;
  /** Declared value type of the attribute: 'int', 'float', 'List', 'str', ... */
  attributeType: string;
  /** NNElementType of the attribute element (drives list expectations). */
  elementType: string;
  ownerId: string | null | undefined;
  elements: Record<string, any>;
  /** Stored value; the default fallback derives from it when no configured default exists. */
  currentValue: string;
  translate: (key: string) => string;
}

export interface AttributeValidator {
  check(value: string, ctx: ValidationContext): ValidationStatus;
  /** Message for a value that failed `check` (already translated). */
  message(value: string, ctx: ValidationContext): string;
  /** Value written back when a submit is not valid ('' clears the field). */
  fallback(ctx: ValidationContext): string;
  /** Also show the message when an incomplete value is submitted. */
  errorOnIntermediateSubmit?: boolean;
}

export interface ChangeOutcome {
  /** Whether the typed value is complete and should be stored. */
  commit: boolean;
  error: string | null;
}

export interface SubmitOutcome {
  /** Value to store. */
  value: string;
  error: string | null;
  /** Whether the text field must be re-mounted to show the stored value. */
  reset: boolean;
}

/** Fill `{name}` placeholders of a translated template. */
export function interpolate(template: string, vars: Record<string, string | number>): string {
  return Object.keys(vars).reduce(
    (text, name) => text.split(`{${name}}`).join(String(vars[name])),
    template,
  );
}

const IDENTIFIER_START_REGEX = /^[a-zA-Z]/;
const INT_REGEX = /^-?\d+$/;
// Tuple of integers with matched parentheses, e.g. (224, 224) or (112, 112, 112)
const TUPLE_STRICT_REGEX = /^\(\s*\d+(\s*,\s*\d+)*\s*\)$/;
const TUPLE_PERMISSIVE_REGEX = /^(\((\d+(\s*,\s*\d+)*(\s*,?\s*)?)?\)?)$/;

const defaultOf = (ctx: ValidationContext): string =>
  getAttributeDefaultValue({ attributeName: ctx.attributeName, value: ctx.currentValue });

/** Identifier (input_var): must start with a letter. */
const identifierValidator: AttributeValidator = {
  check: (value) => (value === '' ? 'intermediate' : IDENTIFIER_START_REGEX.test(value) ? 'valid' : 'invalid'),
  message: (_value, ctx) => ctx.translate('popup.nn.validation.identifierStart'),
  fallback: () => '',
};

/** Tuple of integers (interpolate_size). */
const tupleValidator: AttributeValidator = {
  check: (value) => {
    if (value === '' || TUPLE_PERMISSIVE_REGEX.test(value)) {
      return TUPLE_STRICT_REGEX.test(value) ? 'valid' : 'intermediate';
    }
    return 'invalid';
  },
  message: (_value, ctx) => ctx.translate('popup.nn.validation.tuple'),
  fallback: () => '',
  errorOnIntermediateSubmit: true,
};

const intValidator: AttributeValidator = {
  check: (value) => (value === '' || value === '-' ? 'intermediate' : INT_REGEX.test(value) ? 'valid' : 'invalid'),
  message: (_value, ctx) => interpolate(ctx.translate('popup.nn.validation.integer'), { example: defaultOf(ctx) }),
  fallback: defaultOf,
};

const isIntermediateNumber = (value: string): boolean =>
  value === '' || value === '-' || value === '.' || /^-?\d*\.$/.test(value);

const floatValidator: AttributeValidator = {
  check: (value) => {
    if (isIntermediateNumber(value)) return 'intermediate';
    return !isNaN(Number(value)) ? 'valid' : 'invalid';
  },
  message: (_value, ctx) => interpolate(ctx.translate('popup.nn.validation.number'), { example: defaultOf(ctx) }),
  fallback: defaultOf,
};

/** Float restricted to [0, 1] (dropout_rate). */
const unitRangeValidator: AttributeValidator = {
  check: (value, ctx) => {
    const status = floatValidator.check(value, ctx);
    if (status !== 'valid') return status;
    const numeric = Number(value);
    return numeric < 0 || numeric > 1 ? 'invalid' : 'valid';
  },
  message: (value, ctx) => {
    if (floatValidator.check(value, ctx) === 'invalid') return floatValidator.message(value, ctx);
    return interpolate(ctx.translate('popup.nn.validation.unitRange'), { example: defaultOf(ctx) });
  },
  fallback: defaultOf,
};

/** Integer (number of chunks) or list of integers (size per chunk) - split_sizes. */
const intOrListValidator: AttributeValidator = {
  check: (value) => {
    if (value === '' || value === '-') return 'intermediate';
    if (INT_REGEX.test(value) || LIST_STRICT_REGEX.test(value)) return 'valid';
    return LIST_PERMISSIVE_REGEX.test(value) ? 'intermediate' : 'invalid';
  },
  message: (_value, ctx) => ctx.translate('popup.nn.validation.intOrList'),
  fallback: () => '',
};

const listTypeLabel = (ctx: ValidationContext, isStringList: boolean, count: number | null): string => {
  const plural = count === null || count > 1;
  if (isStringList) {
    return ctx.translate(plural ? 'popup.nn.validation.typeStrings' : 'popup.nn.validation.typeString');
  }
  return ctx.translate(plural ? 'popup.nn.validation.typeIntegers' : 'popup.nn.validation.typeInteger');
};

const countListItems = (value: string): number =>
  value.replace(/^\[|\]$/g, '').split(',').filter((s) => s.trim() !== '').length;

/** List of integers or identifiers whose expected length may be fixed by the element type. */
const listValidator: AttributeValidator = {
  check: (value, ctx) => {
    const expected = getListExpectation(ctx.elementType, ctx.ownerId, ctx.elements);
    const isStringList = expected.type === 'string';
    const strictRegex = isStringList ? LIST_IDENTIFIER_STRICT_REGEX : LIST_STRICT_REGEX;
    const permissiveRegex = isStringList ? LIST_IDENTIFIER_PERMISSIVE_REGEX : LIST_PERMISSIVE_REGEX;
    if (strictRegex.test(value)) {
      return expected.count !== null && countListItems(value) !== expected.count ? 'invalid' : 'valid';
    }
    return value === '' || permissiveRegex.test(value) ? 'intermediate' : 'invalid';
  },
  message: (value, ctx) => {
    const expected = getListExpectation(ctx.elementType, ctx.ownerId, ctx.elements);
    const isStringList = expected.type === 'string';
    if (expected.count !== null) {
      // Wrong number of well-formed items, or malformed input for a fixed-size list
      return interpolate(ctx.translate('popup.nn.validation.listCount'), {
        count: expected.count,
        type: listTypeLabel(ctx, isStringList, expected.count),
        example: expected.example,
      });
    }
    return interpolate(ctx.translate('popup.nn.validation.listOf'), {
      type: listTypeLabel(ctx, isStringList, null),
      example: expected.example,
    });
  },
  fallback: (ctx) => getListExpectation(ctx.elementType, ctx.ownerId, ctx.elements).example,
};

const VALIDATORS_BY_NAME: Record<string, AttributeValidator> = {
  input_var: identifierValidator,
  interpolate_size: tupleValidator,
  split_sizes: intOrListValidator,
  dropout_rate: unitRangeValidator,
};

const VALIDATORS_BY_TYPE: Record<string, AttributeValidator> = {
  int: intValidator,
  float: floatValidator,
  List: listValidator,
};

/** The validator for an attribute, or null when its values are stored as typed. */
export function getAttributeValidator(attributeName: string, attributeType: string): AttributeValidator | null {
  return VALIDATORS_BY_NAME[attributeName] ?? VALIDATORS_BY_TYPE[attributeType] ?? null;
}

/** Live validation while typing; null when the attribute has no validator. */
export function validateOnChange(value: string, ctx: ValidationContext): ChangeOutcome | null {
  const validator = getAttributeValidator(ctx.attributeName, ctx.attributeType);
  if (!validator) return null;
  const status = validator.check(value, ctx);
  if (status === 'valid') return { commit: true, error: null };
  if (status === 'intermediate') return { commit: false, error: null };
  return { commit: false, error: validator.message(value, ctx) };
}

/** Validation on submit (blur/enter); null when the attribute has no validator. */
export function validateOnSubmit(value: string, ctx: ValidationContext): SubmitOutcome | null {
  const validator = getAttributeValidator(ctx.attributeName, ctx.attributeType);
  if (!validator) return null;
  const status = validator.check(value, ctx);
  if (status === 'valid') return { value, error: null, reset: false };
  const showError = status === 'invalid' || (validator.errorOnIntermediateSubmit === true && value !== '');
  return {
    value: validator.fallback(ctx),
    error: showError ? validator.message(value, ctx) : null,
    reset: true,
  };
}
