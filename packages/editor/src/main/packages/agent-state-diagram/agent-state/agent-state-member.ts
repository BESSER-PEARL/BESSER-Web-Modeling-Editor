import { DeepPartial } from 'redux';
import { ILayer } from '../../../services/layouter/layer';
import { ILayoutable } from '../../../services/layouter/layoutable';
import { IUMLElement, UMLElement } from '../../../services/uml-element/uml-element';
import { UMLElementFeatures } from '../../../services/uml-element/uml-element-features';
import { assign } from '../../../utils/fx/assign';
import { IBoundary, computeDimension } from '../../../utils/geometry/boundary';
import { Text } from '../../../utils/svg/text';
import * as Apollon from '../../../typings';

interface IAgentStateMemberValues extends IUMLElement {
  ragDatabaseName?: string;
  dbSelectionType?: string;
  dbCustomName?: string;
  dbQueryMode?: string;
  dbOperation?: string;
  dbSqlQuery?: string;
}

export abstract class AgentStateMember extends UMLElement {
  static features: UMLElementFeatures = {
    ...UMLElement.features,
    hoverable: false,
    selectable: false,
    movable: false,
    resizable: false,
    connectable: false,
    droppable: false,
    updatable: false,
  };

  bounds: IBoundary = { ...this.bounds, height: computeDimension(1.0, 30) };
  replyType: string = "text";
  ragDatabaseName: string = '';
  dbSelectionType: string = 'default';
  dbCustomName: string = '';
  dbQueryMode: string = 'llm_query';
  dbOperation: string = 'any';
  dbSqlQuery: string = '';
  
  constructor(values?: DeepPartial<IAgentStateMemberValues>) {
    super(values);
    assign<IUMLElement>(this, values);
    if (values?.ragDatabaseName !== undefined) {
      this.ragDatabaseName = values.ragDatabaseName ?? '';
    }
    if (values?.dbSelectionType !== undefined) {
      this.dbSelectionType = values.dbSelectionType ?? 'default';
    }
    if (values?.dbCustomName !== undefined) {
      this.dbCustomName = values.dbCustomName ?? '';
    }
    if (values?.dbQueryMode !== undefined) {
      this.dbQueryMode = values.dbQueryMode ?? 'llm_query';
    }
    if (values?.dbOperation !== undefined) {
      this.dbOperation = values.dbOperation ?? 'any';
    }
    if (values?.dbSqlQuery !== undefined) {
      this.dbSqlQuery = values.dbSqlQuery ?? '';
    }
  }


  /** Serializes an `UMLElement` to an `Apollon.UMLElement` */
  serialize(children?: UMLElement[]): Apollon.AgentModelElement {
    const serialized: Apollon.AgentModelElement = {
      id: this.id,
      name: this.name,
      type: this.type,
      owner: this.owner,
      bounds: this.bounds,
      highlight: this.highlight,
      fillColor: this.fillColor,
      strokeColor: this.strokeColor,
      textColor: this.textColor,
      assessmentNote: this.assessmentNote,
      replyType: this.replyType,
    };

    if (this.replyType === 'rag') {
      serialized.ragDatabaseName = this.ragDatabaseName;
    }

    if (this.replyType === 'db_reply') {
      serialized.dbSelectionType = this.dbSelectionType;
      serialized.dbCustomName = this.dbCustomName;
      serialized.dbQueryMode = this.dbQueryMode;
      serialized.dbOperation = this.dbOperation;
      serialized.dbSqlQuery = this.dbSqlQuery;
    }

    return serialized;
  }

    deserialize<T extends Apollon.UMLModelElement>(values: T & {
      replyType: string;
      ragDatabaseName?: string;
      dbSelectionType?: string;
      dbCustomName?: string;
      dbQueryMode?: string;
      dbOperation?: string;
      dbSqlQuery?: string;
    }) {
      this.id = values.id;
      this.name = values.name;
      this.type = values.type;
      this.owner = values.owner || null;
      this.bounds = { ...values.bounds };
      this.highlight = values.highlight;
      this.fillColor = values.fillColor;
      this.strokeColor = values.strokeColor;
      this.textColor = values.textColor;
      this.assessmentNote = values.assessmentNote;
      this.replyType = values.replyType;
      this.ragDatabaseName = values.ragDatabaseName ?? '';
      this.dbSelectionType = values.dbSelectionType ?? 'default';
      this.dbCustomName = values.dbCustomName ?? '';
      this.dbQueryMode = values.dbQueryMode ?? 'llm_query';
      this.dbOperation = values.dbOperation ?? 'any';
      this.dbSqlQuery = values.dbSqlQuery ?? '';
    }

  render(layer: ILayer): ILayoutable[] {
    const radix = 10;

    if (this.replyType === 'code') {
      const lines = this.name.split('\n');
      const lineHeight = 14;
      const padding = 12;
      let maxWidth = 0;
      for (const line of lines) {
        const w = Text.size(layer, line).width + 30;
        maxWidth = Math.max(maxWidth, w);
      }
      this.bounds.width = Math.max(this.bounds.width, Math.round(maxWidth / radix) * radix);
      this.bounds.height = Math.max(computeDimension(1.0, 30), lines.length * lineHeight + padding);
    } else {
      const width = Text.size(layer, this.name).width + 20;
      this.bounds.width = Math.max(this.bounds.width, Math.round(width / radix) * radix);
    }

    return [this];
  }
} 