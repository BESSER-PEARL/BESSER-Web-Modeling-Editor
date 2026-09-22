import { NNElementType } from '..';
import { NNComponentAttribute } from '../nn-component-attribute';
import { UMLElementType } from '../../uml-element-type';
import { IUMLElement } from '../../../services/uml-element/uml-element';
import { IUMLClassifierMember } from '../../common/uml-classifier/uml-classifier-member';
import { Visibility } from '../../common/uml-classifier/uml-classifier-member';
import { DeepPartial } from 'redux';
import * as Apollon from '../../../typings';

// Base interface for all Conv1D attributes
export interface IConv1DAttribute extends IUMLElement {
  attributeName: string;
  value: string;
  visibility?: Visibility;
  isMandatory?: boolean;
}

// Base class for Conv1D attributes
export abstract class Conv1DAttribute extends NNComponentAttribute implements IConv1DAttribute {
  public attributeName: string;
  public value: string;
  public isMandatory: boolean;

  constructor(values?: DeepPartial<IConv1DAttribute>) {
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

  deserialize<T extends Apollon.UMLModelElement>(values: T & IConv1DAttribute) {
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
export class NameAttributeConv1D extends Conv1DAttribute {
  type: UMLElementType = NNElementType.NameAttributeConv1D;
  constructor(values?: DeepPartial<IConv1DAttribute>) {
    super({ attributeName: 'name', value: 'conv1d_layer', isMandatory: true, ...values });
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class KernelDimAttributeConv1D extends Conv1DAttribute {
  type: UMLElementType = NNElementType.KernelDimAttributeConv1D;
  constructor(values?: DeepPartial<IConv1DAttribute>) {
    super({ attributeName: 'kernel_dim', value: '[3]', isMandatory: true, ...values });
    this.attributeType = 'List';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class OutChannelsAttributeConv1D extends Conv1DAttribute {
  type: UMLElementType = NNElementType.OutChannelsAttributeConv1D;
  constructor(values?: DeepPartial<IConv1DAttribute>) {
    super({ attributeName: 'out_channels', value: '16', isMandatory: true, ...values });
    this.attributeType = 'int';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

// Optional attributes
export class StrideDimAttributeConv1D extends Conv1DAttribute {
  type: UMLElementType = NNElementType.StrideDimAttributeConv1D;
  constructor(values?: DeepPartial<IConv1DAttribute>) {
    super({ attributeName: 'stride_dim', value: '[1]', isMandatory: false, ...values });
    this.attributeType = 'List';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class InChannelsAttributeConv1D extends Conv1DAttribute {
  type: UMLElementType = NNElementType.InChannelsAttributeConv1D;
  constructor(values?: DeepPartial<IConv1DAttribute>) {
    super({ attributeName: 'in_channels', value: '3', isMandatory: false, ...values });
    this.attributeType = 'int';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class PaddingAmountAttributeConv1D extends Conv1DAttribute {
  type: UMLElementType = NNElementType.PaddingAmountAttributeConv1D;
  constructor(values?: DeepPartial<IConv1DAttribute>) {
    super({ attributeName: 'padding_amount', value: '0', isMandatory: false, ...values });
    this.attributeType = 'int';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class PaddingTypeAttributeConv1D extends Conv1DAttribute {
  type: UMLElementType = NNElementType.PaddingTypeAttributeConv1D;
  constructor(values?: DeepPartial<IConv1DAttribute>) {
    super({ attributeName: 'padding_type', value: 'valid', isMandatory: false, ...values });
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class ActvFuncAttributeConv1D extends Conv1DAttribute {
  type: UMLElementType = NNElementType.ActvFuncAttributeConv1D;
  constructor(values?: DeepPartial<IConv1DAttribute>) {
    super({ attributeName: 'actv_func', value: 'relu', isMandatory: false, ...values });
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class NameModuleInputAttributeConv1D extends Conv1DAttribute {
  type: UMLElementType = NNElementType.NameModuleInputAttributeConv1D;
  constructor(values?: DeepPartial<IConv1DAttribute>) {
    super({ attributeName: 'name_module_input', value: '', isMandatory: false, ...values });
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class InputReusedAttributeConv1D extends Conv1DAttribute {
  type: UMLElementType = NNElementType.InputReusedAttributeConv1D;
  constructor(values?: DeepPartial<IConv1DAttribute>) {
    super({ attributeName: 'input_reused', value: 'false', isMandatory: false, ...values });
    this.attributeType = 'bool';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class PermuteInAttributeConv1D extends Conv1DAttribute {
  type: UMLElementType = NNElementType.PermuteInAttributeConv1D;
  constructor(values?: DeepPartial<IConv1DAttribute>) {
    super({ attributeName: 'permute_in', value: 'false', isMandatory: false, ...values });
    this.attributeType = 'bool';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class PermuteOutAttributeConv1D extends Conv1DAttribute {
  type: UMLElementType = NNElementType.PermuteOutAttributeConv1D;
  constructor(values?: DeepPartial<IConv1DAttribute>) {
    super({ attributeName: 'permute_out', value: 'false', isMandatory: false, ...values });
    this.attributeType = 'bool';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}
