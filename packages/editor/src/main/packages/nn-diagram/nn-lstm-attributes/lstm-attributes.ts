import { NNElementType } from '..';
import { NNComponentAttribute } from '../nn-component-attribute';
import { UMLElementType } from '../../uml-element-type';
import { IUMLElement } from '../../../services/uml-element/uml-element';
import { IUMLClassifierMember } from '../../common/uml-classifier/uml-classifier-member';
import { Visibility } from '../../common/uml-classifier/uml-classifier-member';
import { DeepPartial } from 'redux';
import * as Apollon from '../../../typings';

// Base interface for all LSTM attributes
export interface ILSTMAttribute extends IUMLElement {
  attributeName: string;
  value: string;
  visibility?: Visibility;
  isMandatory?: boolean;
}

// Base class for LSTM attributes
export abstract class LSTMAttribute extends NNComponentAttribute implements ILSTMAttribute {
  public attributeName: string;
  public value: string;
  public isMandatory: boolean;

  constructor(values?: DeepPartial<ILSTMAttribute>) {
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

  deserialize<T extends Apollon.UMLModelElement>(values: T & ILSTMAttribute) {
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
export class NameAttributeLSTM extends LSTMAttribute {
  type: UMLElementType = NNElementType.NameAttributeLSTM;
  constructor(values?: DeepPartial<ILSTMAttribute>) {
    super({ attributeName: 'name', value: 'lstm_layer', isMandatory: true, ...values });
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class HiddenSizeAttributeLSTM extends LSTMAttribute {
  type: UMLElementType = NNElementType.HiddenSizeAttributeLSTM;
  constructor(values?: DeepPartial<ILSTMAttribute>) {
    super({ attributeName: 'hidden_size', value: '128', isMandatory: true, ...values });
    this.attributeType = 'int';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

// Optional attributes
export class ReturnTypeAttributeLSTM extends LSTMAttribute {
  type: UMLElementType = NNElementType.ReturnTypeAttributeLSTM;
  constructor(values?: DeepPartial<ILSTMAttribute>) {
    super({ attributeName: 'return_type', value: 'full', isMandatory: false, ...values });
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class InputSizeAttributeLSTM extends LSTMAttribute {
  type: UMLElementType = NNElementType.InputSizeAttributeLSTM;
  constructor(values?: DeepPartial<ILSTMAttribute>) {
    super({ attributeName: 'input_size', value: '64', isMandatory: false, ...values });
    this.attributeType = 'int';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class BidirectionalAttributeLSTM extends LSTMAttribute {
  type: UMLElementType = NNElementType.BidirectionalAttributeLSTM;
  constructor(values?: DeepPartial<ILSTMAttribute>) {
    super({ attributeName: 'bidirectional', value: 'false', isMandatory: false, ...values });
    this.attributeType = 'bool';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class DropoutAttributeLSTM extends LSTMAttribute {
  type: UMLElementType = NNElementType.DropoutAttributeLSTM;
  constructor(values?: DeepPartial<ILSTMAttribute>) {
    super({ attributeName: 'dropout', value: '0.0', isMandatory: false, ...values });
    this.attributeType = 'float';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class BatchFirstAttributeLSTM extends LSTMAttribute {
  type: UMLElementType = NNElementType.BatchFirstAttributeLSTM;
  constructor(values?: DeepPartial<ILSTMAttribute>) {
    super({ attributeName: 'batch_first', value: 'true', isMandatory: false, ...values });
    this.attributeType = 'bool';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class ActvFuncAttributeLSTM extends LSTMAttribute {
  type: UMLElementType = NNElementType.ActvFuncAttributeLSTM;
  constructor(values?: DeepPartial<ILSTMAttribute>) {
    super({ attributeName: 'actv_func', value: 'tanh', isMandatory: false, ...values });
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class NameModuleInputAttributeLSTM extends LSTMAttribute {
  type: UMLElementType = NNElementType.NameModuleInputAttributeLSTM;
  constructor(values?: DeepPartial<ILSTMAttribute>) {
    super({ attributeName: 'name_module_input', value: '', isMandatory: false, ...values });
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class InputReusedAttributeLSTM extends LSTMAttribute {
  type: UMLElementType = NNElementType.InputReusedAttributeLSTM;
  constructor(values?: DeepPartial<ILSTMAttribute>) {
    super({ attributeName: 'input_reused', value: 'false', isMandatory: false, ...values });
    this.attributeType = 'bool';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class BiasAttributeLSTM extends LSTMAttribute {
  type: UMLElementType = NNElementType.BiasAttributeLSTM;
  constructor(values?: DeepPartial<ILSTMAttribute>) {
    super({ attributeName: 'bias', value: 'true', isMandatory: false, ...values });
    this.attributeType = 'bool';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class HxSourceAttributeLSTM extends LSTMAttribute {
  type: UMLElementType = NNElementType.HxSourceAttributeLSTM;
  constructor(values?: DeepPartial<ILSTMAttribute>) {
    super({ attributeName: 'hx_source', value: '', isMandatory: false, ...values });
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class IsLayerCallAttributeLSTM extends LSTMAttribute {
  type: UMLElementType = NNElementType.IsLayerCallAttributeLSTM;
  constructor(values?: DeepPartial<ILSTMAttribute>) {
    super({ attributeName: 'is_layer_call', value: 'false', isMandatory: false, ...values });
    this.attributeType = 'bool';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class InputVarAttributeLSTM extends LSTMAttribute {
  type: UMLElementType = NNElementType.InputVarAttributeLSTM;
  constructor(values?: DeepPartial<ILSTMAttribute>) {
    super({ attributeName: 'input_var', value: '', isMandatory: false, ...values });
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class OutputVarAttributeLSTM extends LSTMAttribute {
  type: UMLElementType = NNElementType.OutputVarAttributeLSTM;
  constructor(values?: DeepPartial<ILSTMAttribute>) {
    super({ attributeName: 'output_var', value: '', isMandatory: false, ...values });
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class HiddenStateVarAttributeLSTM extends LSTMAttribute {
  type: UMLElementType = NNElementType.HiddenStateVarAttributeLSTM;
  constructor(values?: DeepPartial<ILSTMAttribute>) {
    super({ attributeName: 'hidden_state_var', value: '', isMandatory: false, ...values });
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class CellStateVarAttributeLSTM extends LSTMAttribute {
  type: UMLElementType = NNElementType.CellStateVarAttributeLSTM;
  constructor(values?: DeepPartial<ILSTMAttribute>) {
    super({ attributeName: 'cell_state_var', value: '', isMandatory: false, ...values });
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class HiddenUnusedAttributeLSTM extends LSTMAttribute {
  type: UMLElementType = NNElementType.HiddenUnusedAttributeLSTM;
  constructor(values?: DeepPartial<ILSTMAttribute>) {
    super({ attributeName: 'hidden_unused', value: 'false', isMandatory: false, ...values });
    this.attributeType = 'bool';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class CellUnusedAttributeLSTM extends LSTMAttribute {
  type: UMLElementType = NNElementType.CellUnusedAttributeLSTM;
  constructor(values?: DeepPartial<ILSTMAttribute>) {
    super({ attributeName: 'cell_unused', value: 'false', isMandatory: false, ...values });
    this.attributeType = 'bool';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class HiddenSubscriptSourceAttributeLSTM extends LSTMAttribute {
  type: UMLElementType = NNElementType.HiddenSubscriptSourceAttributeLSTM;
  constructor(values?: DeepPartial<ILSTMAttribute>) {
    super({ attributeName: 'hidden_subscript_source', value: '', isMandatory: false, ...values });
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class HiddenSubscriptTargetAttributeLSTM extends LSTMAttribute {
  type: UMLElementType = NNElementType.HiddenSubscriptTargetAttributeLSTM;
  constructor(values?: DeepPartial<ILSTMAttribute>) {
    super({ attributeName: 'hidden_subscript_target', value: '', isMandatory: false, ...values });
    this.name = `${this.attributeName} = ${this.value}`;
  }
}
