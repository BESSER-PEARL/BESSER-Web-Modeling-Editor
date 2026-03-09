import { DeepPartial } from 'redux';
import { ILayer } from '../../../services/layouter/layer';
import { ILayoutable } from '../../../services/layouter/layoutable';
import { IUMLElement, UMLElement } from '../../../services/uml-element/uml-element';
import { UMLElementFeatures } from '../../../services/uml-element/uml-element-features';
import { assign } from '../../../utils/fx/assign';
import { IBoundary, computeDimension } from '../../../utils/geometry/boundary';
import { Text } from '../../../utils/svg/text';
import * as Apollon from '../../../typings';

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
  dbSqlQuery: string = '';
  
  constructor(values?: DeepPartial<IUMLElement>) {
    super(values);
    assign<IUMLElement>(this, values);
    if ((values as any)?.ragDatabaseName !== undefined) {
      this.ragDatabaseName = (values as any).ragDatabaseName ?? '';
    }
    if ((values as any)?.dbSelectionType !== undefined) {
      this.dbSelectionType = (values as any).dbSelectionType ?? 'default';
    }
    if ((values as any)?.dbCustomName !== undefined) {
      this.dbCustomName = (values as any).dbCustomName ?? '';
    }
    if ((values as any)?.dbQueryMode !== undefined) {
      this.dbQueryMode = (values as any).dbQueryMode ?? 'llm_query';
    }
    if ((values as any)?.dbSqlQuery !== undefined) {
      this.dbSqlQuery = (values as any).dbSqlQuery ?? '';
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