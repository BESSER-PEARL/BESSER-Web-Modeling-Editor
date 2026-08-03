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
  prompt?: string;
  dbSelectionType?: string;
  dbCustomName?: string;
  dbQueryMode?: string;
  dbOperation?: string;
  dbSqlQuery?: string;
  llm_name?: string;
  system_message?: string;
  initial_url?: string;
  max_depth?: number;
  max_pages?: number;
  crawl_format?: string;
  base_url_prefix?: string;
  run_crawl?: boolean;
  no_crawl_error_message?: string;
  system_message_prefix?: string;
  ws_message?: string;
  ws_audio_speed?: number | null;
  ws_options?: string;
  ws_latitude?: number;
  ws_longitude?: number;
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
  prompt: string = '';
  dbSelectionType: string = 'default';
  dbCustomName: string = '';
  dbQueryMode: string = 'llm_query';
  dbOperation: string = 'any';
  dbSqlQuery: string = '';
  llm_name: string = '';
  system_message: string = '';
  initial_url: string = '';
  max_depth: number = 2;
  max_pages: number = 20;
  crawl_format: string = 'markdown';
  base_url_prefix: string = '';
  run_crawl: boolean = true;
  no_crawl_error_message: string = 'No web crawl data is available yet.';
  system_message_prefix: string = '';
  ws_message: string = '';
  ws_audio_speed: number | null = null;
  ws_options: string = '';
  ws_latitude: number = 0;
  ws_longitude: number = 0;

  constructor(values?: DeepPartial<IAgentStateMemberValues>) {
    super(values);
    assign<IUMLElement>(this, values);
    if (values?.ragDatabaseName !== undefined) {
      this.ragDatabaseName = values.ragDatabaseName ?? '';
    }
    if (values?.prompt !== undefined) {
      this.prompt = values.prompt ?? '';
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
    if (values?.llm_name !== undefined) {
      this.llm_name = values.llm_name ?? '';
    }
    if (values?.system_message !== undefined) {
      this.system_message = values.system_message ?? '';
    }
    if (values?.initial_url !== undefined) {
      this.initial_url = values.initial_url ?? '';
    }
    if (values?.max_depth !== undefined) {
      this.max_depth = values.max_depth ?? 2;
    }
    if (values?.max_pages !== undefined) {
      this.max_pages = values.max_pages ?? 20;
    }
    if (values?.crawl_format !== undefined) {
      this.crawl_format = values.crawl_format ?? 'markdown';
    }
    if (values?.base_url_prefix !== undefined) {
      this.base_url_prefix = values.base_url_prefix ?? '';
    }
    if (values?.run_crawl !== undefined) {
      this.run_crawl = values.run_crawl ?? true;
    }
    if (values?.no_crawl_error_message !== undefined) {
      this.no_crawl_error_message = values.no_crawl_error_message ?? 'No web crawl data is available yet.';
    }
    if (values?.system_message_prefix !== undefined) {
      this.system_message_prefix = values.system_message_prefix ?? '';
    }
    if (values?.ws_message !== undefined) {
      this.ws_message = values.ws_message ?? '';
    }
    if (values?.ws_audio_speed !== undefined) {
      this.ws_audio_speed = values.ws_audio_speed ?? null;
    }
    if (values?.ws_options !== undefined) {
      this.ws_options = values.ws_options ?? '';
    }
    if (values?.ws_latitude !== undefined) {
      this.ws_latitude = values.ws_latitude ?? 0;
    }
    if (values?.ws_longitude !== undefined) {
      this.ws_longitude = values.ws_longitude ?? 0;
    }
  }


  // Maps internal replyType values to metamodel class names used in actionType.
  static readonly REPLY_TYPE_TO_ACTION_TYPE: Record<string, string> = {
    text: 'TextReplyAction',
    llm: 'LLMReplyAction',
    llm_chat: 'LLMChatAction',
    rag: 'RAGReplyAction',
    db_reply: 'DBAction',
    code: 'CustomCodeAction',
    web_crawl_llm: 'WebCrawlLLMAction',
    ws_markdown: 'WebSocketReplyMarkdownAction',
    ws_html: 'WebSocketReplyHTMLAction',
    ws_speech: 'WebSocketReplySpeechAction',
    ws_options: 'WebSocketReplyOptionsAction',
    ws_location: 'WebSocketReplyLocationAction',
    ws_file: 'WebSocketReplyFileAction',
    ws_image: 'WebSocketReplyImageAction',
    ws_dataframe: 'WebSocketReplyDataframeAction',
    ws_plotly: 'WebSocketReplyPlotlyAction',
  };

  // Reverse map: actionType class names → internal replyType values (for deserialization compat).
  static readonly ACTION_TYPE_TO_REPLY_TYPE: Record<string, string> = {
    TextReplyAction: 'text',
    LLMReplyAction: 'llm',
    LLMChatAction: 'llm_chat',
    RAGReplyAction: 'rag',
    DBAction: 'db_reply',
    CustomCodeAction: 'code',
    WebCrawlLLMAction: 'web_crawl_llm',
    WebSocketReplyMarkdownAction: 'ws_markdown',
    WebSocketReplyHTMLAction: 'ws_html',
    WebSocketReplySpeechAction: 'ws_speech',
    WebSocketReplyOptionsAction: 'ws_options',
    WebSocketReplyLocationAction: 'ws_location',
    WebSocketReplyFileAction: 'ws_file',
    WebSocketReplyImageAction: 'ws_image',
    WebSocketReplyDataframeAction: 'ws_dataframe',
    WebSocketReplyPlotlyAction: 'ws_plotly',
  };

  /** Serializes an `UMLElement` to an `Apollon.UMLElement` */
  serialize(children?: UMLElement[]): Apollon.AgentModelElement {
    const actionType = AgentStateMember.REPLY_TYPE_TO_ACTION_TYPE[this.replyType] ?? this.replyType;
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
      // Emit new canonical key (actionType with metamodel class name).
      actionType,
      // Keep legacy key so old backend consumers can still read the diagram.
      replyType: this.replyType,
    };

    if (this.replyType === 'rag') {
      serialized.ragDatabaseName = this.ragDatabaseName;
      serialized.prompt = this.prompt;
    }

    if (this.replyType === 'db_reply') {
      serialized.dbSelectionType = this.dbSelectionType;
      serialized.dbCustomName = this.dbCustomName;
      serialized.dbQueryMode = this.dbQueryMode;
      serialized.dbOperation = this.dbOperation;
      serialized.dbSqlQuery = this.dbSqlQuery;
    }

    // Always persist llm_name so a chosen LLM survives a temporary switch of
    // reply type (e.g. llm -> text -> llm). The backend ignores it for reply
    // types that do not consume an LLM, so emitting it unconditionally is safe
    // and keeps serialize/deserialize symmetric.
    serialized.llm_name = this.llm_name;

    if (this.replyType === 'llm' || this.replyType === 'llm_chat') {
      serialized.system_message = this.system_message;
    }

    if (this.replyType === 'web_crawl_llm') {
      serialized.initial_url = this.initial_url;
      serialized.max_depth = this.max_depth;
      serialized.max_pages = this.max_pages;
      serialized.crawl_format = this.crawl_format;
      serialized.base_url_prefix = this.base_url_prefix;
      serialized.run_crawl = this.run_crawl;
      serialized.no_crawl_error_message = this.no_crawl_error_message;
      serialized.system_message_prefix = this.system_message_prefix;
    }

    if (this.replyType.startsWith('ws_')) {
      serialized.ws_message = this.ws_message;
      serialized.ws_audio_speed = this.ws_audio_speed;
      serialized.ws_options = this.ws_options;
      serialized.ws_latitude = this.ws_latitude;
      serialized.ws_longitude = this.ws_longitude;
    }

    return serialized;
  }

  deserialize<T extends Apollon.UMLModelElement>(values: T & {
    actionType?: string;
    replyType?: string;
    ragDatabaseName?: string;
    prompt?: string;
    dbSelectionType?: string;
    dbCustomName?: string;
    dbQueryMode?: string;
    dbOperation?: string;
    dbSqlQuery?: string;
    llm_name?: string;
    initial_url?: string;
    max_depth?: number;
    max_pages?: number;
    crawl_format?: string;
    base_url_prefix?: string;
    run_crawl?: boolean;
    no_crawl_error_message?: string;
    system_message_prefix?: string;
    ws_message?: string;
    ws_audio_speed?: number | null;
    ws_options?: string;
    ws_latitude?: number;
    ws_longitude?: number;
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
    // Prefer new actionType; fall back to legacy replyType for backward compat.
    if (values.actionType) {
      this.replyType = AgentStateMember.ACTION_TYPE_TO_REPLY_TYPE[values.actionType] ?? values.actionType;
    } else {
      this.replyType = values.replyType ?? 'text';
    }
    this.ragDatabaseName = values.ragDatabaseName ?? '';
    this.prompt = values.prompt ?? '';
    this.dbSelectionType = values.dbSelectionType ?? 'default';
    this.dbCustomName = values.dbCustomName ?? '';
    this.dbQueryMode = values.dbQueryMode ?? 'llm_query';
    this.dbOperation = values.dbOperation ?? 'any';
    this.dbSqlQuery = values.dbSqlQuery ?? '';
    this.llm_name = values.llm_name ?? '';
    this.system_message = values.system_message ?? '';
    this.initial_url = values.initial_url ?? '';
    this.max_depth = values.max_depth ?? 2;
    this.max_pages = values.max_pages ?? 20;
    this.crawl_format = values.crawl_format ?? 'markdown';
    this.base_url_prefix = values.base_url_prefix ?? '';
    this.run_crawl = values.run_crawl ?? true;
    this.no_crawl_error_message = values.no_crawl_error_message ?? 'No web crawl data is available yet.';
    this.system_message_prefix = values.system_message_prefix ?? '';
    this.ws_message = values.ws_message ?? '';
    this.ws_audio_speed = values.ws_audio_speed ?? null;
    this.ws_options = values.ws_options ?? '';
    this.ws_latitude = values.ws_latitude != null ? Number(values.ws_latitude) : 0;
    this.ws_longitude = values.ws_longitude != null ? Number(values.ws_longitude) : 0;
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