import { NNElementType } from '..';
import { NNComponentAttribute } from '../nn-component-attribute';
import { UMLElementType } from '../../uml-element-type';
import { IUMLElement } from '../../../services/uml-element/uml-element';
import { IUMLClassifierMember } from '../../common/uml-classifier/uml-classifier-member';
import { Visibility } from '../../common/uml-classifier/uml-classifier-member';
import { DeepPartial } from 'redux';
import * as Apollon from '../../../typings';

export interface IDatasetAttribute extends IUMLElement {
  attributeName: string;
  value: string;
  visibility?: Visibility;
  isMandatory?: boolean;
}

export abstract class DatasetAttribute extends NNComponentAttribute implements IDatasetAttribute {
  public attributeName: string;
  public value: string;
  public isMandatory: boolean;

  constructor(values?: DeepPartial<IDatasetAttribute>) {
    super({
      ...values,
      visibility: values?.visibility,
    } as DeepPartial<IUMLClassifierMember>);

    this.attributeName = '';
    this.value = '';
    this.isMandatory = false;
    this.visibility = 'public';

    if (values) {
      if (values.attributeName !== undefined) this.attributeName = values.attributeName;
      if (values.value !== undefined) this.value = values.value;
      if (values.isMandatory !== undefined) this.isMandatory = values.isMandatory;
      if (values.visibility !== undefined) this.visibility = values.visibility;
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

  deserialize<T extends Apollon.UMLModelElement>(values: T & IDatasetAttribute) {
    super.deserialize(values);
    if (values.attributeName !== undefined) this.attributeName = values.attributeName;
    if (values.value !== undefined) this.value = values.value;
    if (values.isMandatory !== undefined) this.isMandatory = values.isMandatory;
    if (values.visibility !== undefined) this.visibility = values.visibility;
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

// Mandatory
export class NameAttributeDataset extends DatasetAttribute {
  type: UMLElementType = NNElementType.NameAttributeDataset;
  constructor(values?: DeepPartial<IDatasetAttribute>) {
    super({ attributeName: 'name', value: 'dataset', isMandatory: true, ...values });
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class PathDataAttributeDataset extends DatasetAttribute {
  type: UMLElementType = NNElementType.PathDataAttributeDataset;
  constructor(values?: DeepPartial<IDatasetAttribute>) {
    super({ attributeName: 'path_data', value: 'path/to/data', isMandatory: true, ...values });
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

// Optional
export class TaskTypeAttributeDataset extends DatasetAttribute {
  type: UMLElementType = NNElementType.TaskTypeAttributeDataset;
  constructor(values?: DeepPartial<IDatasetAttribute>) {
    super({ attributeName: 'task_type', value: 'multi_class', isMandatory: false, ...values });
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class InputFormatAttributeDataset extends DatasetAttribute {
  type: UMLElementType = NNElementType.InputFormatAttributeDataset;
  constructor(values?: DeepPartial<IDatasetAttribute>) {
    super({ attributeName: 'input_format', value: 'images', isMandatory: false, ...values });
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class ShapeAttributeDataset extends DatasetAttribute {
  type: UMLElementType = NNElementType.ShapeAttributeDataset;
  constructor(values?: DeepPartial<IDatasetAttribute>) {
    super({ attributeName: 'shape', value: '[32, 32, 3]', isMandatory: false, ...values });
    this.attributeType = 'List';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class NormalizeAttributeDataset extends DatasetAttribute {
  type: UMLElementType = NNElementType.NormalizeAttributeDataset;
  constructor(values?: DeepPartial<IDatasetAttribute>) {
    super({ attributeName: 'normalize', value: 'false', isMandatory: false, ...values });
    this.attributeType = 'bool';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}