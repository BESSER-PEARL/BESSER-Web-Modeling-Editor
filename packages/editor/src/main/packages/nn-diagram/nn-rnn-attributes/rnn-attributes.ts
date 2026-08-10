import { NNElementType } from '..';
import { NNComponentAttribute } from '../nn-component-attribute';
import { UMLElementType } from '../../uml-element-type';
import { IUMLElement } from '../../../services/uml-element/uml-element';
import { IUMLClassifierMember } from '../../common/uml-classifier/uml-classifier-member';
import { Visibility } from '../../common/uml-classifier/uml-classifier-member';
import { DeepPartial } from 'redux';
import * as Apollon from '../../../typings';

// Base interface for all RNN attributes
export interface IRNNAttribute extends IUMLElement {
  attributeName: string;
  value: string;
  visibility?: Visibility;
  isMandatory?: boolean;
}

// Base class for RNN attributes
export abstract class RNNAttribute extends NNComponentAttribute implements IRNNAttribute {
  public attributeName: string;
  public value: string;
  public isMandatory: boolean;

  constructor(values?: DeepPartial<IRNNAttribute>) {
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

  deserialize<T extends Apollon.UMLModelElement>(values: T & IRNNAttribute) {
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
export class NameAttributeRNN extends RNNAttribute {
  type: UMLElementType = NNElementType.NameAttributeRNN;
  constructor(values?: DeepPartial<IRNNAttribute>) {
    super({ attributeName: 'name', value: 'RNN_layer', isMandatory: true, ...values });
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class HiddenSizeAttributeRNN extends RNNAttribute {
  type: UMLElementType = NNElementType.HiddenSizeAttributeRNN;
  constructor(values?: DeepPartial<IRNNAttribute>) {
    super({ attributeName: 'hidden_size', value: '128', isMandatory: true, ...values });
    this.attributeType = 'int';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

// Optional attributes
export class ReturnTypeAttributeRNN extends RNNAttribute {
  type: UMLElementType = NNElementType.ReturnTypeAttributeRNN;
  constructor(values?: DeepPartial<IRNNAttribute>) {
    super({ attributeName: 'return_type', value: 'full', isMandatory: false, ...values });
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class InputSizeAttributeRNN extends RNNAttribute {
  type: UMLElementType = NNElementType.InputSizeAttributeRNN;
  constructor(values?: DeepPartial<IRNNAttribute>) {
    super({ attributeName: 'input_size', value: '64', isMandatory: false, ...values });
    this.attributeType = 'int';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class BidirectionalAttributeRNN extends RNNAttribute {
  type: UMLElementType = NNElementType.BidirectionalAttributeRNN;
  constructor(values?: DeepPartial<IRNNAttribute>) {
    super({ attributeName: 'bidirectional', value: 'false', isMandatory: false, ...values });
    this.attributeType = 'bool';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class DropoutAttributeRNN extends RNNAttribute {
  type: UMLElementType = NNElementType.DropoutAttributeRNN;
  constructor(values?: DeepPartial<IRNNAttribute>) {
    super({ attributeName: 'dropout', value: '0.0', isMandatory: false, ...values });
    this.attributeType = 'float';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class BatchFirstAttributeRNN extends RNNAttribute {
  type: UMLElementType = NNElementType.BatchFirstAttributeRNN;
  constructor(values?: DeepPartial<IRNNAttribute>) {
    super({ attributeName: 'batch_first', value: 'true', isMandatory: false, ...values });
    this.attributeType = 'bool';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class ActvFuncAttributeRNN extends RNNAttribute {
  type: UMLElementType = NNElementType.ActvFuncAttributeRNN;
  constructor(values?: DeepPartial<IRNNAttribute>) {
    super({ attributeName: 'actv_func', value: 'tanh', isMandatory: false, ...values });
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class NameModuleInputAttributeRNN extends RNNAttribute {
  type: UMLElementType = NNElementType.NameModuleInputAttributeRNN;
  constructor(values?: DeepPartial<IRNNAttribute>) {
    super({ attributeName: 'name_module_input', value: '', isMandatory: false, ...values });
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class InputReusedAttributeRNN extends RNNAttribute {
  type: UMLElementType = NNElementType.InputReusedAttributeRNN;
  constructor(values?: DeepPartial<IRNNAttribute>) {
    super({ attributeName: 'input_reused', value: 'false', isMandatory: false, ...values });
    this.attributeType = 'bool';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}
