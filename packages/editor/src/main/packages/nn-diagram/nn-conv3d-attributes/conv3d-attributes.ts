import { NNElementType } from '..';
import { NNComponentAttribute } from '../nn-component-attribute';
import { UMLElementType } from '../../uml-element-type';
import { IUMLElement } from '../../../services/uml-element/uml-element';
import { IUMLClassifierMember } from '../../common/uml-classifier/uml-classifier-member';
import { Visibility } from '../../common/uml-classifier/uml-classifier-member';
import { DeepPartial } from 'redux';
import * as Apollon from '../../../typings';

// Base interface for all Conv3D attributes
export interface IConv3DAttribute extends IUMLElement {
  attributeName: string;
  value: string;
  visibility?: Visibility;
  isMandatory?: boolean;
}

// Base class for Conv3D attributes
export abstract class Conv3DAttribute extends NNComponentAttribute implements IConv3DAttribute {
  public attributeName: string;
  public value: string;
  public isMandatory: boolean;

  constructor(values?: DeepPartial<IConv3DAttribute>) {
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

  deserialize<T extends Apollon.UMLModelElement>(values: T & IConv3DAttribute) {
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

// Mandatory attributes - Conv3D
export class NameAttributeConv3D extends Conv3DAttribute {
  type: UMLElementType = NNElementType.NameAttributeConv3D;
  constructor(values?: DeepPartial<IConv3DAttribute>) {
    super({ attributeName: 'name', value: 'conv3d_layer', isMandatory: true, ...values });
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class KernelDimAttributeConv3D extends Conv3DAttribute {
  type: UMLElementType = NNElementType.KernelDimAttributeConv3D;
  constructor(values?: DeepPartial<IConv3DAttribute>) {
    super({ attributeName: 'kernel_dim', value: '[3, 3, 3]', isMandatory: true, ...values });
    this.attributeType = 'List';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class OutChannelsAttributeConv3D extends Conv3DAttribute {
  type: UMLElementType = NNElementType.OutChannelsAttributeConv3D;
  constructor(values?: DeepPartial<IConv3DAttribute>) {
    super({ attributeName: 'out_channels', value: '16', isMandatory: true, ...values });
    this.attributeType = 'int';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

// Optional attributes - Conv3D
export class StrideDimAttributeConv3D extends Conv3DAttribute {
  type: UMLElementType = NNElementType.StrideDimAttributeConv3D;
  constructor(values?: DeepPartial<IConv3DAttribute>) {
    super({ attributeName: 'stride_dim', value: '[1, 1, 1]', isMandatory: false, ...values });
    this.attributeType = 'List';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class InChannelsAttributeConv3D extends Conv3DAttribute {
  type: UMLElementType = NNElementType.InChannelsAttributeConv3D;
  constructor(values?: DeepPartial<IConv3DAttribute>) {
    super({ attributeName: 'in_channels', value: '3', isMandatory: false, ...values });
    this.attributeType = 'int';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class PaddingAmountAttributeConv3D extends Conv3DAttribute {
  type: UMLElementType = NNElementType.PaddingAmountAttributeConv3D;
  constructor(values?: DeepPartial<IConv3DAttribute>) {
    super({ attributeName: 'padding_amount', value: '0', isMandatory: false, ...values });
    this.attributeType = 'int';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class PaddingTypeAttributeConv3D extends Conv3DAttribute {
  type: UMLElementType = NNElementType.PaddingTypeAttributeConv3D;
  constructor(values?: DeepPartial<IConv3DAttribute>) {
    super({ attributeName: 'padding_type', value: 'valid', isMandatory: false, ...values });
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class ActvFuncAttributeConv3D extends Conv3DAttribute {
  type: UMLElementType = NNElementType.ActvFuncAttributeConv3D;
  constructor(values?: DeepPartial<IConv3DAttribute>) {
    super({ attributeName: 'actv_func', value: 'relu', isMandatory: false, ...values });
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class NameModuleInputAttributeConv3D extends Conv3DAttribute {
  type: UMLElementType = NNElementType.NameModuleInputAttributeConv3D;
  constructor(values?: DeepPartial<IConv3DAttribute>) {
    super({ attributeName: 'name_module_input', value: '', isMandatory: false, ...values });
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class InputReusedAttributeConv3D extends Conv3DAttribute {
  type: UMLElementType = NNElementType.InputReusedAttributeConv3D;
  constructor(values?: DeepPartial<IConv3DAttribute>) {
    super({ attributeName: 'input_reused', value: 'false', isMandatory: false, ...values });
    this.attributeType = 'bool';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class PermuteInAttributeConv3D extends Conv3DAttribute {
  type: UMLElementType = NNElementType.PermuteInAttributeConv3D;
  constructor(values?: DeepPartial<IConv3DAttribute>) {
    super({ attributeName: 'permute_in', value: 'false', isMandatory: false, ...values });
    this.attributeType = 'bool';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class PermuteOutAttributeConv3D extends Conv3DAttribute {
  type: UMLElementType = NNElementType.PermuteOutAttributeConv3D;
  constructor(values?: DeepPartial<IConv3DAttribute>) {
    super({ attributeName: 'permute_out', value: 'false', isMandatory: false, ...values });
    this.attributeType = 'bool';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}
