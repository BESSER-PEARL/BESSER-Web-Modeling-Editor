import { NNElementType } from '..';
import { NNComponentAttribute } from '../nn-component-attribute';
import { UMLElementType } from '../../uml-element-type';
import { IUMLElement } from '../../../services/uml-element/uml-element';
import { IUMLClassifierMember } from '../../common/uml-classifier/uml-classifier-member';
import { Visibility } from '../../common/uml-classifier/uml-classifier-member';
import { DeepPartial } from 'redux';
import * as Apollon from '../../../typings';

// Base interface for all LayerNormalization attributes
export interface ILayerNormalizationAttribute extends IUMLElement {
  attributeName: string;
  value: string;
  visibility?: Visibility;
  isMandatory?: boolean;
}

// Base class for LayerNormalization attributes
export abstract class LayerNormalizationAttribute extends NNComponentAttribute implements ILayerNormalizationAttribute {
  public attributeName: string;
  public value: string;
  public isMandatory: boolean;

  constructor(values?: DeepPartial<ILayerNormalizationAttribute>) {
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

  deserialize<T extends Apollon.UMLModelElement>(values: T & ILayerNormalizationAttribute) {
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
export class NameAttributeLayerNormalization extends LayerNormalizationAttribute {
  type: UMLElementType = NNElementType.NameAttributeLayerNormalization;
  constructor(values?: DeepPartial<ILayerNormalizationAttribute>) {
    super({ attributeName: 'name', value: 'LayerNorm_layer', isMandatory: true, ...values });
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class NormalizedShapeAttributeLayerNormalization extends LayerNormalizationAttribute {
  type: UMLElementType = NNElementType.NormalizedShapeAttributeLayerNormalization;
  constructor(values?: DeepPartial<ILayerNormalizationAttribute>) {
    super({ attributeName: 'normalized_shape', value: '[-1]', isMandatory: true, ...values });
    this.attributeType = 'List';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

// Optional attributes
export class ActvFuncAttributeLayerNormalization extends LayerNormalizationAttribute {
  type: UMLElementType = NNElementType.ActvFuncAttributeLayerNormalization;
  constructor(values?: DeepPartial<ILayerNormalizationAttribute>) {
    super({ attributeName: 'actv_func', value: 'relu', isMandatory: false, ...values });
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class NameModuleInputAttributeLayerNormalization extends LayerNormalizationAttribute {
  type: UMLElementType = NNElementType.NameModuleInputAttributeLayerNormalization;
  constructor(values?: DeepPartial<ILayerNormalizationAttribute>) {
    super({ attributeName: 'name_module_input', value: '', isMandatory: false, ...values });
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class InputReusedAttributeLayerNormalization extends LayerNormalizationAttribute {
  type: UMLElementType = NNElementType.InputReusedAttributeLayerNormalization;
  constructor(values?: DeepPartial<ILayerNormalizationAttribute>) {
    super({ attributeName: 'input_reused', value: 'false', isMandatory: false, ...values });
    this.attributeType = 'bool';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}
