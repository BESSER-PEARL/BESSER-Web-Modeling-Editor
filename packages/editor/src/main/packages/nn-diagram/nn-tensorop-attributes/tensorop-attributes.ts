import { NNElementType } from '..';
import { NNComponentAttribute } from '../nn-component-attribute';
import { UMLElementType } from '../../uml-element-type';
import { IUMLElement } from '../../../services/uml-element/uml-element';
import { IUMLClassifierMember } from '../../common/uml-classifier/uml-classifier-member';
import { Visibility } from '../../common/uml-classifier/uml-classifier-member';
import { DeepPartial } from 'redux';
import * as Apollon from '../../../typings';

// Base interface for all TensorOp attributes
export interface ITensorOpAttribute extends IUMLElement {
  attributeName: string;
  value: string;
  visibility?: Visibility;
  isMandatory?: boolean;
}

// Base class for TensorOp attributes
export abstract class TensorOpAttribute extends NNComponentAttribute implements ITensorOpAttribute {
  public attributeName: string;
  public value: string;
  public isMandatory: boolean;

  constructor(values?: DeepPartial<ITensorOpAttribute>) {
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

  deserialize<T extends Apollon.UMLModelElement>(values: T & ITensorOpAttribute) {
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
export class NameAttributeTensorOp extends TensorOpAttribute {
  type: UMLElementType = NNElementType.NameAttributeTensorOp;
  constructor(values?: DeepPartial<ITensorOpAttribute>) {
    super({ attributeName: 'name', value: 'TensorOp_layer', isMandatory: true, ...values });
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class TnsTypeAttributeTensorOp extends TensorOpAttribute {
  type: UMLElementType = NNElementType.TnsTypeAttributeTensorOp;
  constructor(values?: DeepPartial<ITensorOpAttribute>) {
    super({ attributeName: 'tns_type', value: 'reshape', isMandatory: true, ...values });
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

// Optional attributes
export class ConcatenateDimAttributeTensorOp extends TensorOpAttribute {
  type: UMLElementType = NNElementType.ConcatenateDimAttributeTensorOp;
  constructor(values?: DeepPartial<ITensorOpAttribute>) {
    super({ attributeName: 'concatenate_dim', value: '0', isMandatory: false, ...values });
    this.attributeType = 'int';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class LayersOfTensorsAttributeTensorOp extends TensorOpAttribute {
  type: UMLElementType = NNElementType.LayersOfTensorsAttributeTensorOp;
  constructor(values?: DeepPartial<ITensorOpAttribute>) {
    super({ attributeName: 'layers_of_tensors', value: '[]', isMandatory: false, ...values });
    this.attributeType = 'List';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class ReshapeDimAttributeTensorOp extends TensorOpAttribute {
  type: UMLElementType = NNElementType.ReshapeDimAttributeTensorOp;
  constructor(values?: DeepPartial<ITensorOpAttribute>) {
    super({ attributeName: 'reshape_dim', value: '[-1]', isMandatory: false, ...values });
    this.attributeType = 'List';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class TransposeDimAttributeTensorOp extends TensorOpAttribute {
  type: UMLElementType = NNElementType.TransposeDimAttributeTensorOp;
  constructor(values?: DeepPartial<ITensorOpAttribute>) {
    super({ attributeName: 'transpose_dim', value: '[0, 1]', isMandatory: false, ...values });
    this.attributeType = 'List';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class PermuteDimAttributeTensorOp extends TensorOpAttribute {
  type: UMLElementType = NNElementType.PermuteDimAttributeTensorOp;
  constructor(values?: DeepPartial<ITensorOpAttribute>) {
    super({ attributeName: 'permute_dim', value: '[0, 1, 2]', isMandatory: false, ...values });
    this.attributeType = 'List';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class InputReusedAttributeTensorOp extends TensorOpAttribute {
  type: UMLElementType = NNElementType.InputReusedAttributeTensorOp;
  constructor(values?: DeepPartial<ITensorOpAttribute>) {
    super({ attributeName: 'input_reused', value: 'false', isMandatory: false, ...values });
    this.attributeType = 'bool';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}
