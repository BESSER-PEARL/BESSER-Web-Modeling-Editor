import { NNElementType } from '..';
import { NNComponentAttribute } from '../nn-component-attribute';
import { UMLElementType } from '../../uml-element-type';
import { IUMLElement } from '../../../services/uml-element/uml-element';
import { IUMLClassifierMember } from '../../common/uml-classifier/uml-classifier-member';
import { Visibility } from '../../common/uml-classifier/uml-classifier-member';
import { DeepPartial } from 'redux';
import * as Apollon from '../../../typings';

// Base interface for all Configuration attributes
export interface IConfigurationAttribute extends IUMLElement {
  attributeName: string;
  value: string;
  visibility?: Visibility;
  isMandatory?: boolean;
}

// Base class for Configuration attributes
export abstract class ConfigurationAttribute extends NNComponentAttribute implements IConfigurationAttribute {
  public attributeName: string;
  public value: string;
  public isMandatory: boolean;

  constructor(values?: DeepPartial<IConfigurationAttribute>) {
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

  deserialize<T extends Apollon.UMLModelElement>(values: T & IConfigurationAttribute) {
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
export class BatchSizeAttributeConfiguration extends ConfigurationAttribute {
  type: UMLElementType = NNElementType.BatchSizeAttributeConfiguration;
  constructor(values?: DeepPartial<IConfigurationAttribute>) {
    super({ attributeName: 'batch_size', value: '32', isMandatory: true, ...values });
    this.attributeType = 'int';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class EpochsAttributeConfiguration extends ConfigurationAttribute {
  type: UMLElementType = NNElementType.EpochsAttributeConfiguration;
  constructor(values?: DeepPartial<IConfigurationAttribute>) {
    super({ attributeName: 'epochs', value: '10', isMandatory: true, ...values });
    this.attributeType = 'int';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class LearningRateAttributeConfiguration extends ConfigurationAttribute {
  type: UMLElementType = NNElementType.LearningRateAttributeConfiguration;
  constructor(values?: DeepPartial<IConfigurationAttribute>) {
    super({ attributeName: 'learning_rate', value: '0.001', isMandatory: true, ...values });
    this.attributeType = 'float';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class OptimizerAttributeConfiguration extends ConfigurationAttribute {
  type: UMLElementType = NNElementType.OptimizerAttributeConfiguration;
  constructor(values?: DeepPartial<IConfigurationAttribute>) {
    super({ attributeName: 'optimizer', value: 'adam', isMandatory: true, ...values });
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class LossFunctionAttributeConfiguration extends ConfigurationAttribute {
  type: UMLElementType = NNElementType.LossFunctionAttributeConfiguration;
  constructor(values?: DeepPartial<IConfigurationAttribute>) {
    super({ attributeName: 'loss_function', value: 'crossentropy', isMandatory: true, ...values });
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class MetricsAttributeConfiguration extends ConfigurationAttribute {
  type: UMLElementType = NNElementType.MetricsAttributeConfiguration;
  constructor(values?: DeepPartial<IConfigurationAttribute>) {
    super({ attributeName: 'metrics', value: '[accuracy]', isMandatory: true, ...values });
    this.attributeType = 'List';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

// Optional attributes
export class WeightDecayAttributeConfiguration extends ConfigurationAttribute {
  type: UMLElementType = NNElementType.WeightDecayAttributeConfiguration;
  constructor(values?: DeepPartial<IConfigurationAttribute>) {
    super({ attributeName: 'weight_decay', value: '0.0', isMandatory: false, ...values });
    this.attributeType = 'float';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class MomentumAttributeConfiguration extends ConfigurationAttribute {
  type: UMLElementType = NNElementType.MomentumAttributeConfiguration;
  constructor(values?: DeepPartial<IConfigurationAttribute>) {
    super({ attributeName: 'momentum', value: '0', isMandatory: false, ...values });
    this.attributeType = 'float';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}
