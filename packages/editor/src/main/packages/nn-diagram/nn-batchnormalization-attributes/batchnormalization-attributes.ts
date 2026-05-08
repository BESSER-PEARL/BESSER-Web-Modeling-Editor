import { NNElementType } from '..';
import { NNComponentAttribute } from '../nn-component-attribute';
import { UMLElementType } from '../../uml-element-type';
import { IUMLElement } from '../../../services/uml-element/uml-element';
import { IUMLClassifierMember } from '../../common/uml-classifier/uml-classifier-member';
import { Visibility } from '../../common/uml-classifier/uml-classifier-member';
import { DeepPartial } from 'redux';
import * as Apollon from '../../../typings';

// Base interface for all BatchNormalization attributes
export interface IBatchNormalizationAttribute extends IUMLElement {
  attributeName: string;
  value: string;
  visibility?: Visibility;
  isMandatory?: boolean;
}

// Base class for BatchNormalization attributes
export abstract class BatchNormalizationAttribute extends NNComponentAttribute implements IBatchNormalizationAttribute {
  public attributeName: string;
  public value: string;
  public isMandatory: boolean;

  constructor(values?: DeepPartial<IBatchNormalizationAttribute>) {
    super({
      ...values,
      visibility: values?.visibility,
    } as DeepPartial<IUMLClassifierMember>);

    this.attributeName = '';
    this.value = '';
    this.isMandatory = false;
    this.visibility = 'public';

    if (values) {
      if (values.attributeName !== undefined) {
        this.attributeName = values.attributeName;
      }
      if (values.value !== undefined) {
        this.value = values.value;
      }
      if (values.isMandatory !== undefined) {
        this.isMandatory = values.isMandatory;
      }
      if (values.visibility !== undefined) {
        this.visibility = values.visibility;
      }
    }

    this.name = `${this.attributeName} = ${this.value}`;
  }

  serialize() {
    return {
      ...super.serialize(),
      attributeName: this.attributeName,
      value: this.value,
      isMandatory: this.isMandatory,
      visibility: this.visibility,
    };
  }

  deserialize<T extends Apollon.UMLModelElement>(values: T & IBatchNormalizationAttribute) {
    super.deserialize(values);
    if (values.attributeName !== undefined) {
      this.attributeName = values.attributeName;
    }
    if (values.value !== undefined) {
      this.value = values.value;
    }
    if (values.isMandatory !== undefined) {
      this.isMandatory = values.isMandatory;
    }
    if (values.visibility !== undefined) {
      this.visibility = values.visibility;
    }
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

// Mandatory attributes
export class NameAttributeBatchNormalization extends BatchNormalizationAttribute {
  type: UMLElementType = NNElementType.NameAttributeBatchNormalization;
  constructor(values?: DeepPartial<IBatchNormalizationAttribute>) {
    super({ attributeName: 'name', value: 'BatchNorm_layer', isMandatory: true, ...values });
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class NumFeaturesAttributeBatchNormalization extends BatchNormalizationAttribute {
  type: UMLElementType = NNElementType.NumFeaturesAttributeBatchNormalization;
  constructor(values?: DeepPartial<IBatchNormalizationAttribute>) {
    super({ attributeName: 'num_features', value: '128', isMandatory: true, ...values });
    this.attributeType = 'int';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class DimensionAttributeBatchNormalization extends BatchNormalizationAttribute {
  type: UMLElementType = NNElementType.DimensionAttributeBatchNormalization;
  constructor(values?: DeepPartial<IBatchNormalizationAttribute>) {
    super({ attributeName: 'dimension', value: '2D', isMandatory: true, ...values });
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

// Optional attributes
export class ActvFuncAttributeBatchNormalization extends BatchNormalizationAttribute {
  type: UMLElementType = NNElementType.ActvFuncAttributeBatchNormalization;
  constructor(values?: DeepPartial<IBatchNormalizationAttribute>) {
    super({ attributeName: 'actv_func', value: 'relu', isMandatory: false, ...values });
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class NameModuleInputAttributeBatchNormalization extends BatchNormalizationAttribute {
  type: UMLElementType = NNElementType.NameModuleInputAttributeBatchNormalization;
  constructor(values?: DeepPartial<IBatchNormalizationAttribute>) {
    super({ attributeName: 'name_module_input', value: '', isMandatory: false, ...values });
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class InputReusedAttributeBatchNormalization extends BatchNormalizationAttribute {
  type: UMLElementType = NNElementType.InputReusedAttributeBatchNormalization;
  constructor(values?: DeepPartial<IBatchNormalizationAttribute>) {
    super({ attributeName: 'input_reused', value: 'false', isMandatory: false, ...values });
    this.attributeType = 'bool';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}
