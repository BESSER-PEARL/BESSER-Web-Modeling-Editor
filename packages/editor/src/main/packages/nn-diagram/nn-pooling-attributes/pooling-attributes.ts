import { NNElementType } from '..';
import { NNComponentAttribute } from '../nn-component-attribute';
import { UMLElementType } from '../../uml-element-type';
import { IUMLElement } from '../../../services/uml-element/uml-element';
import { IUMLClassifierMember } from '../../common/uml-classifier/uml-classifier-member';
import { Visibility } from '../../common/uml-classifier/uml-classifier-member';
import { DeepPartial } from 'redux';
import * as Apollon from '../../../typings';

// Base interface for all Pooling attributes
export interface IPoolingAttribute extends IUMLElement {
  attributeName: string;
  value: string;
  visibility?: Visibility;
  isMandatory?: boolean;
}

// Base class for Pooling attributes
export abstract class PoolingAttribute extends NNComponentAttribute implements IPoolingAttribute {
  public attributeName: string;
  public value: string;
  public isMandatory: boolean;

  constructor(values?: DeepPartial<IPoolingAttribute>) {
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

  deserialize<T extends Apollon.UMLModelElement>(values: T & IPoolingAttribute) {
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
export class NameAttributePooling extends PoolingAttribute {
  type: UMLElementType = NNElementType.NameAttributePooling;
  constructor(values?: DeepPartial<IPoolingAttribute>) {
    super({ attributeName: 'name', value: 'Pooling_layer', isMandatory: true, ...values });
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class PoolingTypeAttributePooling extends PoolingAttribute {
  type: UMLElementType = NNElementType.PoolingTypeAttributePooling;
  constructor(values?: DeepPartial<IPoolingAttribute>) {
    super({ attributeName: 'pooling_type', value: 'max', isMandatory: true, ...values });
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class DimensionAttributePooling extends PoolingAttribute {
  type: UMLElementType = NNElementType.DimensionAttributePooling;
  constructor(values?: DeepPartial<IPoolingAttribute>) {
    super({ attributeName: 'dimension', value: '2D', isMandatory: true, ...values });
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

// Optional attributes
export class KernelDimAttributePooling extends PoolingAttribute {
  type: UMLElementType = NNElementType.KernelDimAttributePooling;
  constructor(values?: DeepPartial<IPoolingAttribute>) {
    super({ attributeName: 'kernel_dim', value: '[3, 3]', isMandatory: false, ...values });
    this.attributeType = 'List';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class StrideDimAttributePooling extends PoolingAttribute {
  type: UMLElementType = NNElementType.StrideDimAttributePooling;
  constructor(values?: DeepPartial<IPoolingAttribute>) {
    super({ attributeName: 'stride_dim', value: '[1, 1]', isMandatory: false, ...values });
    this.attributeType = 'List';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class PaddingAmountAttributePooling extends PoolingAttribute {
  type: UMLElementType = NNElementType.PaddingAmountAttributePooling;
  constructor(values?: DeepPartial<IPoolingAttribute>) {
    super({ attributeName: 'padding_amount', value: '0', isMandatory: false, ...values });
    this.attributeType = 'int';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class PaddingTypeAttributePooling extends PoolingAttribute {
  type: UMLElementType = NNElementType.PaddingTypeAttributePooling;
  constructor(values?: DeepPartial<IPoolingAttribute>) {
    super({ attributeName: 'padding_type', value: 'valid', isMandatory: false, ...values });
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class OutputDimAttributePooling extends PoolingAttribute {
  type: UMLElementType = NNElementType.OutputDimAttributePooling;
  constructor(values?: DeepPartial<IPoolingAttribute>) {
    super({ attributeName: 'output_dim', value: '[16, 16]', isMandatory: false, ...values });
    this.attributeType = 'List';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class ActvFuncAttributePooling extends PoolingAttribute {
  type: UMLElementType = NNElementType.ActvFuncAttributePooling;
  constructor(values?: DeepPartial<IPoolingAttribute>) {
    super({ attributeName: 'actv_func', value: 'relu', isMandatory: false, ...values });
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class NameModuleInputAttributePooling extends PoolingAttribute {
  type: UMLElementType = NNElementType.NameModuleInputAttributePooling;
  constructor(values?: DeepPartial<IPoolingAttribute>) {
    super({ attributeName: 'name_module_input', value: '', isMandatory: false, ...values });
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class InputReusedAttributePooling extends PoolingAttribute {
  type: UMLElementType = NNElementType.InputReusedAttributePooling;
  constructor(values?: DeepPartial<IPoolingAttribute>) {
    super({ attributeName: 'input_reused', value: 'false', isMandatory: false, ...values });
    this.attributeType = 'bool';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class PermuteInAttributePooling extends PoolingAttribute {
  type: UMLElementType = NNElementType.PermuteInAttributePooling;
  constructor(values?: DeepPartial<IPoolingAttribute>) {
    super({ attributeName: 'permute_in', value: 'false', isMandatory: false, ...values });
    this.attributeType = 'bool';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class PermuteOutAttributePooling extends PoolingAttribute {
  type: UMLElementType = NNElementType.PermuteOutAttributePooling;
  constructor(values?: DeepPartial<IPoolingAttribute>) {
    super({ attributeName: 'permute_out', value: 'false', isMandatory: false, ...values });
    this.attributeType = 'bool';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}
