import { UserModelElementType } from '..';
import { UMLClassifierAttribute } from '../../common/uml-classifier/uml-classifier-attribute';
import { UMLElementType } from '../../uml-element-type';
import { DeepPartial } from 'redux';
import * as Apollon from '../../../typings';
import { IUMLElement } from '../../../services/uml-element/uml-element';

export const USER_MODEL_ATTRIBUTE_COMPARATORS = ['<', '<=', '==', '>=', '>'] as const;
export type UserModelAttributeComparator = typeof USER_MODEL_ATTRIBUTE_COMPARATORS[number];

const DEFAULT_COMPARATOR: UserModelAttributeComparator = '==';

export const normalizeUserModelAttributeComparator = (
  raw?: string,
): UserModelAttributeComparator => {
  if (!raw) {
    return DEFAULT_COMPARATOR;
  }
  if (raw === '=') {
    return '==';
  }
  return USER_MODEL_ATTRIBUTE_COMPARATORS.includes(raw as UserModelAttributeComparator)
    ? (raw as UserModelAttributeComparator)
    : DEFAULT_COMPARATOR;
};

const extractComparatorFromName = (name?: string): UserModelAttributeComparator => {
  if (!name) {
    return DEFAULT_COMPARATOR;
  }
  const match = name.match(/^(?:.*?)(<=|>=|==|=|<|>)/);
  return normalizeUserModelAttributeComparator(match ? match[1] : undefined);
};

type UserModelAttributeInit = IUMLElement & {
  attributeId?: string;
  attributeOperator?: UserModelAttributeComparator;
};

export interface IUMLUserModelAttribute extends IUMLElement {
  attributeId?: string;
  attributeOperator?: UserModelAttributeComparator;
}

export class UMLUserModelAttribute extends UMLClassifierAttribute {
  type: UMLElementType = UserModelElementType.UserModelAttribute;
  attributeId?: string;
  attributeOperator: UserModelAttributeComparator = DEFAULT_COMPARATOR;

  constructor(values?: DeepPartial<UserModelAttributeInit>) {
    super(values);
    if (values?.attributeId) {
      this.attributeId = values.attributeId;
    }
    if (typeof values?.attributeOperator === 'string') {
      this.attributeOperator = normalizeUserModelAttributeComparator(values.attributeOperator);
    }
  }

  serialize() {
    return {
      ...super.serialize(),
      attributeId: this.attributeId,
      attributeOperator: this.attributeOperator,
    };
  }

  deserialize<T extends Apollon.UMLModelElement>(values: T, children?: Apollon.UMLModelElement[]): void {
    super.deserialize(values, children);
    if ('attributeId' in values && typeof values.attributeId === 'string') {
      this.attributeId = values.attributeId;
    }
    if ('attributeOperator' in values && typeof values.attributeOperator === 'string') {
      this.attributeOperator = normalizeUserModelAttributeComparator(values.attributeOperator);
    } else if (typeof this.name === 'string') {
      this.attributeOperator = extractComparatorFromName(this.name);
    }
  }
}
