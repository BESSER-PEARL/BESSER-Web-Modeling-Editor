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
    super({ attributeName: 'name', value: 'tensorop', isMandatory: true, ...values });
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
    super({ attributeName: 'concatenate_dim', value: '', isMandatory: false, ...values });
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
    super({ attributeName: 'reshape_dim', value: '', isMandatory: false, ...values });
    this.attributeType = 'List';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class TransposeDimAttributeTensorOp extends TensorOpAttribute {
  type: UMLElementType = NNElementType.TransposeDimAttributeTensorOp;
  constructor(values?: DeepPartial<ITensorOpAttribute>) {
    super({ attributeName: 'transpose_dim', value: '', isMandatory: false, ...values });
    this.attributeType = 'List';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class PermuteDimAttributeTensorOp extends TensorOpAttribute {
  type: UMLElementType = NNElementType.PermuteDimAttributeTensorOp;
  constructor(values?: DeepPartial<ITensorOpAttribute>) {
    super({ attributeName: 'permute_dim', value: '', isMandatory: false, ...values });
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

export class ReduceDimAttributeTensorOp extends TensorOpAttribute {
  type: UMLElementType = NNElementType.ReduceDimAttributeTensorOp;
  constructor(values?: DeepPartial<ITensorOpAttribute>) {
    super({ attributeName: 'reduce_dim', value: '', isMandatory: false, ...values });
    this.attributeType = 'int';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class ReduceKeepdimAttributeTensorOp extends TensorOpAttribute {
  type: UMLElementType = NNElementType.ReduceKeepdimAttributeTensorOp;
  constructor(values?: DeepPartial<ITensorOpAttribute>) {
    super({ attributeName: 'reduce_keepdims', value: 'false', isMandatory: false, ...values });
    this.attributeType = 'bool';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class ShapeDimAttributeTensorOp extends TensorOpAttribute {
  type: UMLElementType = NNElementType.ShapeDimAttributeTensorOp;
  constructor(values?: DeepPartial<ITensorOpAttribute>) {
    super({ attributeName: 'shape_dim', value: '', isMandatory: false, ...values });
    this.attributeType = 'int';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class ActualVarsAttributeTensorOp extends TensorOpAttribute {
  type: UMLElementType = NNElementType.ActualVarsAttributeTensorOp;
  constructor(values?: DeepPartial<ITensorOpAttribute>) {
    super({ attributeName: 'actual_vars', value: '[]', isMandatory: false, ...values });
    this.attributeType = 'List';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class SubscriptIndicesAttributeTensorOp extends TensorOpAttribute {
  type: UMLElementType = NNElementType.SubscriptIndicesAttributeTensorOp;
  constructor(values?: DeepPartial<ITensorOpAttribute>) {
    super({ attributeName: 'subscript_indices', value: '', isMandatory: false, ...values });
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class RepeatDimAttributeTensorOp extends TensorOpAttribute {
  type: UMLElementType = NNElementType.RepeatDimAttributeTensorOp;
  constructor(values?: DeepPartial<ITensorOpAttribute>) {
    super({ attributeName: 'repeat_dim', value: '', isMandatory: false, ...values });
    this.attributeType = 'List';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class InterpolateSizeAttributeTensorOp extends TensorOpAttribute {
  type: UMLElementType = NNElementType.InterpolateSizeAttributeTensorOp;
  constructor(values?: DeepPartial<ITensorOpAttribute>) {
    super({ attributeName: 'interpolate_size', value: '', isMandatory: false, ...values });
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class InterpolateScaleAttributeTensorOp extends TensorOpAttribute {
  type: UMLElementType = NNElementType.InterpolateScaleAttributeTensorOp;
  constructor(values?: DeepPartial<ITensorOpAttribute>) {
    super({ attributeName: 'interpolate_scale', value: '', isMandatory: false, ...values });
    this.attributeType = 'float';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class InterpolateModeAttributeTensorOp extends TensorOpAttribute {
  type: UMLElementType = NNElementType.InterpolateModeAttributeTensorOp;
  constructor(values?: DeepPartial<ITensorOpAttribute>) {
    super({ attributeName: 'interpolate_mode', value: '', isMandatory: false, ...values });
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class PadAmountAttributeTensorOp extends TensorOpAttribute {
  type: UMLElementType = NNElementType.PadAmountAttributeTensorOp;
  constructor(values?: DeepPartial<ITensorOpAttribute>) {
    super({ attributeName: 'pad_amount', value: '', isMandatory: false, ...values });
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class PadModeAttributeTensorOp extends TensorOpAttribute {
  type: UMLElementType = NNElementType.PadModeAttributeTensorOp;
  constructor(values?: DeepPartial<ITensorOpAttribute>) {
    super({ attributeName: 'pad_mode', value: '', isMandatory: false, ...values });
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class PadValueAttributeTensorOp extends TensorOpAttribute {
  type: UMLElementType = NNElementType.PadValueAttributeTensorOp;
  constructor(values?: DeepPartial<ITensorOpAttribute>) {
    super({ attributeName: 'pad_value', value: '0.0', isMandatory: false, ...values });
    this.attributeType = 'float';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class DropoutRateAttributeTensorOp extends TensorOpAttribute {
  type: UMLElementType = NNElementType.DropoutRateAttributeTensorOp;
  constructor(values?: DeepPartial<ITensorOpAttribute>) {
    super({ attributeName: 'dropout_rate', value: '', isMandatory: false, ...values });
    this.attributeType = 'float';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class DropoutTrainingAwareAttributeTensorOp extends TensorOpAttribute {
  type: UMLElementType = NNElementType.DropoutTrainingAwareAttributeTensorOp;
  constructor(values?: DeepPartial<ITensorOpAttribute>) {
    super({ attributeName: 'dropout_training_aware', value: 'true', isMandatory: false, ...values });
    this.attributeType = 'bool';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class SplitDimAttributeTensorOp extends TensorOpAttribute {
  type: UMLElementType = NNElementType.SplitDimAttributeTensorOp;
  constructor(values?: DeepPartial<ITensorOpAttribute>) {
    super({ attributeName: 'split_dim', value: '0', isMandatory: false, ...values });
    this.attributeType = 'int';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class SplitSizesAttributeTensorOp extends TensorOpAttribute {
  type: UMLElementType = NNElementType.SplitSizesAttributeTensorOp;
  constructor(values?: DeepPartial<ITensorOpAttribute>) {
    super({ attributeName: 'split_sizes', value: '', isMandatory: false, ...values });
    this.attributeType = 'List';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class PermuteInAttributeTensorOp extends TensorOpAttribute {
  type: UMLElementType = NNElementType.PermuteInAttributeTensorOp;
  constructor(values?: DeepPartial<ITensorOpAttribute>) {
    super({ attributeName: 'permute_in', value: 'false', isMandatory: false, ...values });
    this.attributeType = 'bool';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class PermuteOutAttributeTensorOp extends TensorOpAttribute {
  type: UMLElementType = NNElementType.PermuteOutAttributeTensorOp;
  constructor(values?: DeepPartial<ITensorOpAttribute>) {
    super({ attributeName: 'permute_out', value: 'false', isMandatory: false, ...values });
    this.attributeType = 'bool';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class InputVarAttributeTensorOp extends TensorOpAttribute {
  type: UMLElementType = NNElementType.InputVarAttributeTensorOp;
  constructor(values?: DeepPartial<ITensorOpAttribute>) {
    super({ attributeName: 'input_var', value: '', isMandatory: false, ...values });
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class OutputVarAttributeTensorOp extends TensorOpAttribute {
  type: UMLElementType = NNElementType.OutputVarAttributeTensorOp;
  constructor(values?: DeepPartial<ITensorOpAttribute>) {
    super({ attributeName: 'output_var', value: '', isMandatory: false, ...values });
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class OutputVarsAttributeTensorOp extends TensorOpAttribute {
  type: UMLElementType = NNElementType.OutputVarsAttributeTensorOp;
  constructor(values?: DeepPartial<ITensorOpAttribute>) {
    super({ attributeName: 'output_vars', value: '[]', isMandatory: false, ...values });
    this.attributeType = 'List';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}
