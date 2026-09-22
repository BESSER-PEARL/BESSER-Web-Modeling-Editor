import { NNElementType } from '..';
import { NNComponentAttribute } from '../nn-component-attribute';
import { UMLElementType } from '../../uml-element-type';
import { IUMLElement } from '../../../services/uml-element/uml-element';
import { IUMLClassifierMember } from '../../common/uml-classifier/uml-classifier-member';
import { Visibility } from '../../common/uml-classifier/uml-classifier-member';
import { DeepPartial } from 'redux';
import * as Apollon from '../../../typings';

// Base interface for all Embedding attributes
export interface IEmbeddingAttribute extends IUMLElement {
  attributeName: string;
  value: string;
  visibility?: Visibility;
  isMandatory?: boolean;
}

// Base class for Embedding attributes
export abstract class EmbeddingAttribute extends NNComponentAttribute implements IEmbeddingAttribute {
  public attributeName: string;
  public value: string;
  public isMandatory: boolean;

  constructor(values?: DeepPartial<IEmbeddingAttribute>) {
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

  deserialize<T extends Apollon.UMLModelElement>(values: T & IEmbeddingAttribute) {
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
export class NameAttributeEmbedding extends EmbeddingAttribute {
  type: UMLElementType = NNElementType.NameAttributeEmbedding;
  constructor(values?: DeepPartial<IEmbeddingAttribute>) {
    super({ attributeName: 'name', value: 'Embedding_layer', isMandatory: true, ...values });
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class NumEmbeddingsAttributeEmbedding extends EmbeddingAttribute {
  type: UMLElementType = NNElementType.NumEmbeddingsAttributeEmbedding;
  constructor(values?: DeepPartial<IEmbeddingAttribute>) {
    super({ attributeName: 'num_embeddings', value: '1000', isMandatory: true, ...values });
    this.attributeType = 'int';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class EmbeddingDimAttributeEmbedding extends EmbeddingAttribute {
  type: UMLElementType = NNElementType.EmbeddingDimAttributeEmbedding;
  constructor(values?: DeepPartial<IEmbeddingAttribute>) {
    super({ attributeName: 'embedding_dim', value: '128', isMandatory: true, ...values });
    this.attributeType = 'int';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

// Optional attributes
export class ActvFuncAttributeEmbedding extends EmbeddingAttribute {
  type: UMLElementType = NNElementType.ActvFuncAttributeEmbedding;
  constructor(values?: DeepPartial<IEmbeddingAttribute>) {
    super({ attributeName: 'actv_func', value: 'relu', isMandatory: false, ...values });
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class NameModuleInputAttributeEmbedding extends EmbeddingAttribute {
  type: UMLElementType = NNElementType.NameModuleInputAttributeEmbedding;
  constructor(values?: DeepPartial<IEmbeddingAttribute>) {
    super({ attributeName: 'name_module_input', value: '', isMandatory: false, ...values });
    this.name = `${this.attributeName} = ${this.value}`;
  }
}

export class InputReusedAttributeEmbedding extends EmbeddingAttribute {
  type: UMLElementType = NNElementType.InputReusedAttributeEmbedding;
  constructor(values?: DeepPartial<IEmbeddingAttribute>) {
    super({ attributeName: 'input_reused', value: 'false', isMandatory: false, ...values });
    this.attributeType = 'bool';
    this.name = `${this.attributeName} = ${this.value}`;
  }
}
