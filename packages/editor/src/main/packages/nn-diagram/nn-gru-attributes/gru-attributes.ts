import { NNElementType } from '..';
import { NNComponentAttribute } from '../nn-component-attribute';
import { UMLElementType } from '../../uml-element-type';
import { IUMLElement } from '../../../services/uml-element/uml-element';
import { IUMLClassifierMember } from '../../common/uml-classifier/uml-classifier-member';
import { Visibility } from '../../common/uml-classifier/uml-classifier-member';
import { DeepPartial } from 'redux';
import * as Apollon from '../../../typings';

// Base interface for all GRU attributes
export interface IGRUAttribute extends IUMLElement {
  attributeName: string;
  value: string;
  visibility?: Visibility;
  isMandatory?: boolean;
}

// Base class for GRU attributes
export abstract class GRUAttribute extends NNComponentAttribute implements IGRUAttribute {
  public attributeName: string;
  public value: string;
  public isMandatory: boolean;

  constructor(values?: DeepPartial<IGRUAttribute>) {
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

  deserialize<T extends Apollon.UMLModelElement>(values: T & IGRUAttribute) {
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
export class NameAttributeGRU extends GRUAttribute {
  type: UMLElementType = NNElementType.NameAttributeGRU;
  constructor(values?: DeepPartial<IGRUAttribute>) {
    super({ attributeName: 'name', value: 'gru_layer', isMandatory: true, ...values });
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class HiddenSizeAttributeGRU extends GRUAttribute {
  type: UMLElementType = NNElementType.HiddenSizeAttributeGRU;
  constructor(values?: DeepPartial<IGRUAttribute>) {
    super({ attributeName: 'hidden_size', value: '128', isMandatory: true, ...values });
    this.attributeType = 'int';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

// Optional attributes
export class ReturnTypeAttributeGRU extends GRUAttribute {
  type: UMLElementType = NNElementType.ReturnTypeAttributeGRU;
  constructor(values?: DeepPartial<IGRUAttribute>) {
    super({ attributeName: 'return_type', value: 'full', isMandatory: false, ...values });
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class InputSizeAttributeGRU extends GRUAttribute {
  type: UMLElementType = NNElementType.InputSizeAttributeGRU;
  constructor(values?: DeepPartial<IGRUAttribute>) {
    super({ attributeName: 'input_size', value: '64', isMandatory: false, ...values });
    this.attributeType = 'int';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class BidirectionalAttributeGRU extends GRUAttribute {
  type: UMLElementType = NNElementType.BidirectionalAttributeGRU;
  constructor(values?: DeepPartial<IGRUAttribute>) {
    super({ attributeName: 'bidirectional', value: 'false', isMandatory: false, ...values });
    this.attributeType = 'bool';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class DropoutAttributeGRU extends GRUAttribute {
  type: UMLElementType = NNElementType.DropoutAttributeGRU;
  constructor(values?: DeepPartial<IGRUAttribute>) {
    super({ attributeName: 'dropout', value: '0.0', isMandatory: false, ...values });
    this.attributeType = 'float';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class BatchFirstAttributeGRU extends GRUAttribute {
  type: UMLElementType = NNElementType.BatchFirstAttributeGRU;
  constructor(values?: DeepPartial<IGRUAttribute>) {
    super({ attributeName: 'batch_first', value: 'true', isMandatory: false, ...values });
    this.attributeType = 'bool';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class ActvFuncAttributeGRU extends GRUAttribute {
  type: UMLElementType = NNElementType.ActvFuncAttributeGRU;
  constructor(values?: DeepPartial<IGRUAttribute>) {
    super({ attributeName: 'actv_func', value: 'tanh', isMandatory: false, ...values });
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class NameModuleInputAttributeGRU extends GRUAttribute {
  type: UMLElementType = NNElementType.NameModuleInputAttributeGRU;
  constructor(values?: DeepPartial<IGRUAttribute>) {
    super({ attributeName: 'name_module_input', value: '', isMandatory: false, ...values });
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class InputReusedAttributeGRU extends GRUAttribute {
  type: UMLElementType = NNElementType.InputReusedAttributeGRU;
  constructor(values?: DeepPartial<IGRUAttribute>) {
    super({ attributeName: 'input_reused', value: 'false', isMandatory: false, ...values });
    this.attributeType = 'bool';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class BiasAttributeGRU extends GRUAttribute {
  type: UMLElementType = NNElementType.BiasAttributeGRU;
  constructor(values?: DeepPartial<IGRUAttribute>) {
    super({ attributeName: 'bias', value: 'true', isMandatory: false, ...values });
    this.attributeType = 'bool';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class HxSourceAttributeGRU extends GRUAttribute {
  type: UMLElementType = NNElementType.HxSourceAttributeGRU;
  constructor(values?: DeepPartial<IGRUAttribute>) {
    super({ attributeName: 'hx_source', value: '', isMandatory: false, ...values });
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class IsLayerCallAttributeGRU extends GRUAttribute {
  type: UMLElementType = NNElementType.IsLayerCallAttributeGRU;
  constructor(values?: DeepPartial<IGRUAttribute>) {
    super({ attributeName: 'is_layer_call', value: 'false', isMandatory: false, ...values });
    this.attributeType = 'bool';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class InputVarAttributeGRU extends GRUAttribute {
  type: UMLElementType = NNElementType.InputVarAttributeGRU;
  constructor(values?: DeepPartial<IGRUAttribute>) {
    super({ attributeName: 'input_var', value: '', isMandatory: false, ...values });
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class OutputVarAttributeGRU extends GRUAttribute {
  type: UMLElementType = NNElementType.OutputVarAttributeGRU;
  constructor(values?: DeepPartial<IGRUAttribute>) {
    super({ attributeName: 'output_var', value: '', isMandatory: false, ...values });
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class HiddenStateVarAttributeGRU extends GRUAttribute {
  type: UMLElementType = NNElementType.HiddenStateVarAttributeGRU;
  constructor(values?: DeepPartial<IGRUAttribute>) {
    super({ attributeName: 'hidden_state_var', value: '', isMandatory: false, ...values });
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class HiddenUnusedAttributeGRU extends GRUAttribute {
  type: UMLElementType = NNElementType.HiddenUnusedAttributeGRU;
  constructor(values?: DeepPartial<IGRUAttribute>) {
    super({ attributeName: 'hidden_unused', value: 'false', isMandatory: false, ...values });
    this.attributeType = 'bool';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class HiddenSubscriptSourceAttributeGRU extends GRUAttribute {
  type: UMLElementType = NNElementType.HiddenSubscriptSourceAttributeGRU;
  constructor(values?: DeepPartial<IGRUAttribute>) {
    super({ attributeName: 'hidden_subscript_source', value: '', isMandatory: false, ...values });
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class HiddenSubscriptTargetAttributeGRU extends GRUAttribute {
  type: UMLElementType = NNElementType.HiddenSubscriptTargetAttributeGRU;
  constructor(values?: DeepPartial<IGRUAttribute>) {
    super({ attributeName: 'hidden_subscript_target', value: '', isMandatory: false, ...values });
    this.name = `${this.attributeName} = ${this.value}`;
  }
}
