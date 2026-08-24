import { UserModelElementType } from '..';
import { UMLClassifierAttribute } from '../../common/uml-classifier/uml-classifier-attribute';
import { UMLElementType } from '../../uml-element-type';
import { DeepPartial } from 'redux';
import * as Apollon from '../../../typings';
import { IUMLElement } from '../../../services/uml-element/uml-element';
import { UserPersonalizationSpec, isUserPersonalizationSpec } from '../personalization-spec';

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
  personalization?: UserPersonalizationSpec;
};

export interface IUMLUserModelAttribute extends IUMLElement {
  attributeId?: string;
  attributeOperator?: UserModelAttributeComparator;
  personalization?: UserPersonalizationSpec;
}

export class UMLUserModelAttribute extends UMLClassifierAttribute {
  type: UMLElementType = UserModelElementType.UserModelAttribute;
  attributeId?: string;
  attributeOperator: UserModelAttributeComparator = DEFAULT_COMPARATOR;
  /**
   * Attribute-level personalization spec (content / presentation / modality).
   * Aggregated together with the profile-level spec by the webapp. See
   * personalization-spec.ts.
   */
  personalization?: UserPersonalizationSpec;

  /**
   * User-model attributes are matching criteria (e.g. `age >= 18`) rendered
   * instance-style — the whole expression lives in `name`. Return it verbatim,
   * mirroring UMLObjectAttribute, so the inherited classifier formatting never
   * injects the visibility symbol / `: type` suffix (which would otherwise
   * appear once `attributeType` defaults to `str` after a save/reload).
   */
  get displayName(): string {
    return this.name;
  }

  constructor(values?: DeepPartial<UserModelAttributeInit>) {
    super(values);
    if (values?.attributeId) {
      this.attributeId = values.attributeId;
    }
    if (typeof values?.attributeOperator === 'string') {
      this.attributeOperator = normalizeUserModelAttributeComparator(values.attributeOperator);
    }
    if (isUserPersonalizationSpec(values?.personalization)) {
      this.personalization = values!.personalization as UserPersonalizationSpec;
    }
  }

  serialize() {
    return {
      ...super.serialize(),
      attributeId: this.attributeId,
      attributeOperator: this.attributeOperator,
      personalization: this.personalization,
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
    if ('personalization' in values && isUserPersonalizationSpec((values as any).personalization)) {
      this.personalization = (values as any).personalization;
    }
  }
}
