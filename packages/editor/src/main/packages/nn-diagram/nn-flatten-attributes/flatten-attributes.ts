import { NNElementType } from '..';
import { NNComponentAttribute } from '../nn-component-attribute';
import { UMLElementType } from '../../uml-element-type';
import { IUMLElement } from '../../../services/uml-element/uml-element';
import { IUMLClassifierMember } from '../../common/uml-classifier/uml-classifier-member';
import { Visibility } from '../../common/uml-classifier/uml-classifier-member';
import { DeepPartial } from 'redux';
import * as Apollon from '../../../typings';

// Base interface for all Flatten attributes
export interface IFlattenAttribute extends IUMLElement {
  attributeName: string;
  value: string;
  visibility?: Visibility;
  isMandatory?: boolean;
}

// Base class for Flatten attributes
export abstract class FlattenAttribute extends NNComponentAttribute implements IFlattenAttribute {
  public attributeName: string;
  public value: string;
  public isMandatory: boolean;

  constructor(values?: DeepPartial<IFlattenAttribute>) {
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

  deserialize<T extends Apollon.UMLModelElement>(values: T & IFlattenAttribute) {
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

// Mandatory attribute
export class NameAttributeFlatten extends FlattenAttribute {
  type: UMLElementType = NNElementType.NameAttributeFlatten;
  constructor(values?: DeepPartial<IFlattenAttribute>) {
    super({ attributeName: 'name', value: 'Flatten_layer', isMandatory: true, ...values });
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

// Optional attributes
export class StartDimAttributeFlatten extends FlattenAttribute {
  type: UMLElementType = NNElementType.StartDimAttributeFlatten;
  constructor(values?: DeepPartial<IFlattenAttribute>) {
    super({ attributeName: 'start_dim', value: '1', isMandatory: false, ...values });
    this.attributeType = 'int';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class EndDimAttributeFlatten extends FlattenAttribute {
  type: UMLElementType = NNElementType.EndDimAttributeFlatten;
  constructor(values?: DeepPartial<IFlattenAttribute>) {
    super({ attributeName: 'end_dim', value: '-1', isMandatory: false, ...values });
    this.attributeType = 'int';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class ActvFuncAttributeFlatten extends FlattenAttribute {
  type: UMLElementType = NNElementType.ActvFuncAttributeFlatten;
  constructor(values?: DeepPartial<IFlattenAttribute>) {
    super({ attributeName: 'actv_func', value: 'relu', isMandatory: false, ...values });
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class NameModuleInputAttributeFlatten extends FlattenAttribute {
  type: UMLElementType = NNElementType.NameModuleInputAttributeFlatten;
  constructor(values?: DeepPartial<IFlattenAttribute>) {
    super({ attributeName: 'name_module_input', value: '', isMandatory: false, ...values });
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class InputReusedAttributeFlatten extends FlattenAttribute {
  type: UMLElementType = NNElementType.InputReusedAttributeFlatten;
  constructor(values?: DeepPartial<IFlattenAttribute>) {
    super({ attributeName: 'input_reused', value: 'false', isMandatory: false, ...values });
    this.attributeType = 'bool';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}
