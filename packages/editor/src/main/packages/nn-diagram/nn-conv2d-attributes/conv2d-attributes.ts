import { NNElementType } from '..';
import { NNComponentAttribute } from '../nn-component-attribute';
import { UMLElementType } from '../../uml-element-type';
import { IUMLElement } from '../../../services/uml-element/uml-element';
import { IUMLClassifierMember } from '../../common/uml-classifier/uml-classifier-member';
import { Visibility } from '../../common/uml-classifier/uml-classifier-member';
import { DeepPartial } from 'redux';
import * as Apollon from '../../../typings';

// Base interface for all Conv2D attributes
export interface IConv2DAttribute extends IUMLElement {
  attributeName: string;
  value: string;
  visibility?: Visibility;
  isMandatory?: boolean;
}

// Base class for Conv2D attributes
export abstract class Conv2DAttribute extends NNComponentAttribute implements IConv2DAttribute {
  public attributeName: string;
  public value: string;
  public isMandatory: boolean;

  constructor(values?: DeepPartial<IConv2DAttribute>) {
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

  deserialize<T extends Apollon.UMLModelElement>(values: T & IConv2DAttribute) {
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

// Mandatory attributes - Conv2D
export class NameAttributeConv2D extends Conv2DAttribute {
  type: UMLElementType = NNElementType.NameAttributeConv2D;
  constructor(values?: DeepPartial<IConv2DAttribute>) {
    super({ attributeName: 'name', value: 'conv2d_layer', isMandatory: true, ...values });
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class KernelDimAttributeConv2D extends Conv2DAttribute {
  type: UMLElementType = NNElementType.KernelDimAttributeConv2D;
  constructor(values?: DeepPartial<IConv2DAttribute>) {
    super({ attributeName: 'kernel_dim', value: '[3, 3]', isMandatory: true, ...values });
    this.attributeType = 'List';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class OutChannelsAttributeConv2D extends Conv2DAttribute {
  type: UMLElementType = NNElementType.OutChannelsAttributeConv2D;
  constructor(values?: DeepPartial<IConv2DAttribute>) {
    super({ attributeName: 'out_channels', value: '16', isMandatory: true, ...values });
    this.attributeType = 'int';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

// Optional attributes - Conv2D
export class StrideDimAttributeConv2D extends Conv2DAttribute {
  type: UMLElementType = NNElementType.StrideDimAttributeConv2D;
  constructor(values?: DeepPartial<IConv2DAttribute>) {
    super({ attributeName: 'stride_dim', value: '[1, 1]', isMandatory: false, ...values });
    this.attributeType = 'List';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class InChannelsAttributeConv2D extends Conv2DAttribute {
  type: UMLElementType = NNElementType.InChannelsAttributeConv2D;
  constructor(values?: DeepPartial<IConv2DAttribute>) {
    super({ attributeName: 'in_channels', value: '3', isMandatory: false, ...values });
    this.attributeType = 'int';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class PaddingAmountAttributeConv2D extends Conv2DAttribute {
  type: UMLElementType = NNElementType.PaddingAmountAttributeConv2D;
  constructor(values?: DeepPartial<IConv2DAttribute>) {
    super({ attributeName: 'padding_amount', value: '0', isMandatory: false, ...values });
    this.attributeType = 'int';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class PaddingTypeAttributeConv2D extends Conv2DAttribute {
  type: UMLElementType = NNElementType.PaddingTypeAttributeConv2D;
  constructor(values?: DeepPartial<IConv2DAttribute>) {
    super({ attributeName: 'padding_type', value: 'valid', isMandatory: false, ...values });
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class ActvFuncAttributeConv2D extends Conv2DAttribute {
  type: UMLElementType = NNElementType.ActvFuncAttributeConv2D;
  constructor(values?: DeepPartial<IConv2DAttribute>) {
    super({ attributeName: 'actv_func', value: 'relu', isMandatory: false, ...values });
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class NameModuleInputAttributeConv2D extends Conv2DAttribute {
  type: UMLElementType = NNElementType.NameModuleInputAttributeConv2D;
  constructor(values?: DeepPartial<IConv2DAttribute>) {
    super({ attributeName: 'name_module_input', value: '', isMandatory: false, ...values });
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class InputReusedAttributeConv2D extends Conv2DAttribute {
  type: UMLElementType = NNElementType.InputReusedAttributeConv2D;
  constructor(values?: DeepPartial<IConv2DAttribute>) {
    super({ attributeName: 'input_reused', value: 'false', isMandatory: false, ...values });
    this.attributeType = 'bool';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class PermuteInAttributeConv2D extends Conv2DAttribute {
  type: UMLElementType = NNElementType.PermuteInAttributeConv2D;
  constructor(values?: DeepPartial<IConv2DAttribute>) {
    super({ attributeName: 'permute_in', value: 'false', isMandatory: false, ...values });
    this.attributeType = 'bool';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class PermuteOutAttributeConv2D extends Conv2DAttribute {
  type: UMLElementType = NNElementType.PermuteOutAttributeConv2D;
  constructor(values?: DeepPartial<IConv2DAttribute>) {
    super({ attributeName: 'permute_out', value: 'false', isMandatory: false, ...values });
    this.attributeType = 'bool';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}
