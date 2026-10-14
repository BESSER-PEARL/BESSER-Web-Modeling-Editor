import { NNElementType } from '..';
import { NNComponentAttribute } from '../nn-component-attribute';
import { UMLElementType } from '../../uml-element-type';
import { IUMLElement } from '../../../services/uml-element/uml-element';
import { IUMLClassifierMember } from '../../common/uml-classifier/uml-classifier-member';
import { Visibility } from '../../common/uml-classifier/uml-classifier-member';
import { DeepPartial } from 'redux';
import * as Apollon from '../../../typings';

// Base interface for all Linear attributes
export interface ILinearAttribute extends IUMLElement {
  attributeName: string;
  value: string;
  visibility?: Visibility;
  isMandatory?: boolean;
}

// Base class for Linear attributes
export abstract class LinearAttribute extends NNComponentAttribute implements ILinearAttribute {
  public attributeName: string;
  public value: string;
  public isMandatory: boolean;

  constructor(values?: DeepPartial<ILinearAttribute>) {
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

  deserialize<T extends Apollon.UMLModelElement>(values: T & ILinearAttribute) {
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
export class NameAttributeLinear extends LinearAttribute {
  type: UMLElementType = NNElementType.NameAttributeLinear;
  constructor(values?: DeepPartial<ILinearAttribute>) {
    super({ attributeName: 'name', value: 'linear_layer', isMandatory: true, ...values });
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class OutFeaturesAttributeLinear extends LinearAttribute {
  type: UMLElementType = NNElementType.OutFeaturesAttributeLinear;
  constructor(values?: DeepPartial<ILinearAttribute>) {
    super({ attributeName: 'out_features', value: '128', isMandatory: true, ...values });
    this.attributeType = 'int';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

// Optional attributes
export class InFeaturesAttributeLinear extends LinearAttribute {
  type: UMLElementType = NNElementType.InFeaturesAttributeLinear;
  constructor(values?: DeepPartial<ILinearAttribute>) {
    super({ attributeName: 'in_features', value: '64', isMandatory: false, ...values });
    this.attributeType = 'int';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class ActvFuncAttributeLinear extends LinearAttribute {
  type: UMLElementType = NNElementType.ActvFuncAttributeLinear;
  constructor(values?: DeepPartial<ILinearAttribute>) {
    super({ attributeName: 'actv_func', value: 'relu', isMandatory: false, ...values });
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class NameModuleInputAttributeLinear extends LinearAttribute {
  type: UMLElementType = NNElementType.NameModuleInputAttributeLinear;
  constructor(values?: DeepPartial<ILinearAttribute>) {
    super({ attributeName: 'name_module_input', value: '', isMandatory: false, ...values });
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class InputReusedAttributeLinear extends LinearAttribute {
  type: UMLElementType = NNElementType.InputReusedAttributeLinear;
  constructor(values?: DeepPartial<ILinearAttribute>) {
    super({ attributeName: 'input_reused', value: 'false', isMandatory: false, ...values });
    this.attributeType = 'bool';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class BiasAttributeLinear extends LinearAttribute {
  type: UMLElementType = NNElementType.BiasAttributeLinear;
  constructor(values?: DeepPartial<ILinearAttribute>) {
    super({ attributeName: 'bias', value: 'true', isMandatory: false, ...values });
    this.attributeType = 'bool';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class IsLayerCallAttributeLinear extends LinearAttribute {
  type: UMLElementType = NNElementType.IsLayerCallAttributeLinear;
  constructor(values?: DeepPartial<ILinearAttribute>) {
    super({ attributeName: 'is_layer_call', value: 'false', isMandatory: false, ...values });
    this.attributeType = 'bool';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class InputVarAttributeLinear extends LinearAttribute {
  type: UMLElementType = NNElementType.InputVarAttributeLinear;
  constructor(values?: DeepPartial<ILinearAttribute>) {
    super({ attributeName: 'input_var', value: '', isMandatory: false, ...values });
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class OutputVarAttributeLinear extends LinearAttribute {
  type: UMLElementType = NNElementType.OutputVarAttributeLinear;
  constructor(values?: DeepPartial<ILinearAttribute>) {
    super({ attributeName: 'output_var', value: '', isMandatory: false, ...values });
    this.name = `${this.attributeName} = ${this.value}`;
  }
}
