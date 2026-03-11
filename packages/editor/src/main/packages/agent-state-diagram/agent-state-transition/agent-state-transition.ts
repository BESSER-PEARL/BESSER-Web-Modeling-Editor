import { AgentRelationshipType } from '..';
import { UMLRelationshipCenteredDescription } from '../../../services/uml-relationship/uml-relationship-centered-description';
import * as Apollon from '../../../typings';
import { DeepPartial } from 'redux';

export interface IUMLStateTransition {
  params: { [id: string]: string };
}

export type CustomTransitionEvent =
  | 'None'
  | 'DummyEvent'
  | 'WildcardEvent'
  | 'ReceiveMessageEvent'
  | 'ReceiveTextEvent'
  | 'ReceiveJSONEvent'
  | 'ReceiveFileEvent';

const CUSTOM_TRANSITION_EVENTS: CustomTransitionEvent[] = [
  'None',
  'DummyEvent',
  'WildcardEvent',
  'ReceiveMessageEvent',
  'ReceiveTextEvent',
  'ReceiveJSONEvent',
  'ReceiveFileEvent',
];

export class AgentStateTransition extends UMLRelationshipCenteredDescription implements IUMLStateTransition {
  type = AgentRelationshipType.AgentStateTransition;
  params: { [id: string]: string } = {};
  transitionType: 'predefined' | 'custom' = 'predefined';
  predefinedType: string | undefined = 'when_intent_matched';
  intentName: string | undefined = undefined;
  variable: string | undefined = undefined;
  operator: string | undefined = undefined;
  targetValue: string | undefined = undefined;
  fileType: string | undefined = undefined;
  event: CustomTransitionEvent = 'WildcardEvent';
  conditions: string[] = [];
  constructor(values?: DeepPartial<Apollon.AgentStateTransition>) {
    super(values);
    this.params = {};
    if (values?.params) {
      if (typeof values.params === 'string') {
        this.params = { '0': values.params };
      } else if (Array.isArray(values.params)) {
        values.params.forEach((param, index) => {
          this.params[index.toString()] = param;
        });
      } else {
        this.params = values.params;
      }
    }
    const legacyCondition = typeof values?.condition === 'string' ? values.condition : undefined;
    if (values?.transitionType) {
      this.transitionType = values.transitionType;
    }
    if (values?.predefined?.predefinedType) {
      this.predefinedType = values.predefined.predefinedType;
    } else if (values?.predefinedType) {
      this.predefinedType = values.predefinedType;
    } else if (legacyCondition) {
      this.predefinedType = legacyCondition;
    }
    if (values?.intentName) {
      this.intentName = values.intentName;
    }
    if (values?.variable) {
      this.variable = values.variable;
    }
    if (values?.operator) {
      this.operator = values.operator;
    }
    if (values?.targetValue) {
      this.targetValue = values.targetValue;
    }
    if (values?.fileType) {
      this.fileType = values.fileType;
    }
    if (values?.custom?.event) {
      this.event = values.custom.event;
    } else if (values?.event) {
      this.event = values.event;
    } else if (values?.customEvent) {
      this.event = values.customEvent;
    }
    if (values?.custom?.condition) {
      this.conditions = values.custom.condition;
    } else if (Array.isArray((values as any)?.conditions)) {
      this.conditions = (values as any).conditions;
    } else if (Array.isArray(values?.condition)) {
      this.conditions = values.condition;
    } else if (values?.customConditions) {
      this.conditions = values.customConditions;
    }

    const hasExplicitCustomData =
      !!values?.custom &&
      (
        (typeof values.custom.event === 'string' && values.custom.event !== 'None') ||
        (Array.isArray(values.custom.condition) && values.custom.condition.length > 0)
      );

    if (legacyCondition === 'custom_transition' || values?.transitionType === 'custom' || hasExplicitCustomData) {
      this.transitionType = 'custom';
    }
  }

  serialize(): Apollon.AgentStateTransition {
    const base = super.serialize();
    let conditionValue:
      | string
      | { variable: string; operator: string; targetValue: string } = '';

    let predefinedType = this.predefinedType || 'when_intent_matched';
    if (this.transitionType === 'custom') {
      predefinedType = 'custom_transition';
    } else if (predefinedType == 'when_intent_matched') {
      conditionValue = this.intentName || '';
    } else if (predefinedType == 'when_no_intent_matched' || predefinedType == 'auto') {
      conditionValue = '';
    } else if (predefinedType == 'when_variable_operation_matched') {
      conditionValue = {
        variable: this.variable || '',
        operator: this.operator || '',
        targetValue: this.targetValue || '',
      };
    } else if (predefinedType == 'when_file_received') {
      conditionValue = this.fileType || '';
    }

    const predefined: {
      predefinedType: string;
      intentName?: string;
      fileType?: string;
      conditionValue?: string | { variable: string; operator: string; targetValue: string };
    } = {
      predefinedType,
    };

    if (predefinedType === 'when_intent_matched') {
      predefined.intentName = this.intentName || '';
    } else if (predefinedType === 'when_file_received') {
      predefined.fileType = this.fileType || '';
    } else {
      predefined.conditionValue = conditionValue;
    }

    const serialized: Apollon.AgentStateTransition = {
      ...base,
      type: this.type,
      transitionType: this.transitionType,
      predefined: this.transitionType === 'predefined' ? predefined : { predefinedType: '' },
      custom:
        this.transitionType === 'custom'
          ? {
              event: this.event,
              condition: this.conditions,
            }
          : {
              condition: [],
            },
    };

    return serialized;
  }

  deserialize<T extends Apollon.UMLModelElement>(
    values: T & {
      params?: string | string[] | { [id: string]: string };
      transitionType?: 'predefined' | 'custom';
      predefined?: {
        predefinedType?: string;
        intentName?: string;
        fileType?: string;
        conditionValue?: string | { variable: string; operator: string; targetValue: string };
      };
      custom?: {
        event?: CustomTransitionEvent;
        condition?: string[];
      };
      predefinedType?: string;
      event?: CustomTransitionEvent;
      conditions?: string[];
      condition?: string | string[];
      conditionValue?: string | { variable: string; operator: string; targetValue: string } | { events: string[]; conditions: string[] };
      fileType?: string;
      customEvent?: CustomTransitionEvent;
      customConditions?: string[];
    },
    children?: Apollon.UMLModelElement[],
  ): void {
    super.deserialize(values, children);
    this.params = {};
    if (values.params) {
      if (typeof values.params === 'string') {
        this.params = { '0': values.params };
      } else if (Array.isArray(values.params)) {
        values.params.forEach((param, index) => {
          this.params[index.toString()] = param;
        });
      } else {
        this.params = values.params;
      }
    }
    this.transitionType = values.transitionType || 'predefined';

    const legacyCondition = typeof values.condition === 'string' ? values.condition : undefined;
    const nextPredefinedType = values.predefined?.predefinedType || values.predefinedType || legacyCondition || 'when_intent_matched';
    const nextConditionValue = values.predefined?.conditionValue ?? values.conditionValue;
    const nextIntentName = values.predefined?.intentName;
    const nextFileType = values.predefined?.fileType;

    const hasExplicitCustomData =
      !!values.custom &&
      (
        (typeof values.custom.event === 'string' && values.custom.event !== 'None') ||
        (Array.isArray(values.custom.condition) && values.custom.condition.length > 0)
      );

    if (this.transitionType === 'custom' || hasExplicitCustomData || legacyCondition === 'custom_transition') {
      this.transitionType = 'custom';
      if (values.custom?.event) {
        this.event = values.custom.event;
      } else if (values.event) {
        this.event = values.event;
      } else if (values.customEvent) {
        this.event = values.customEvent;
      }
      if (values.custom?.condition) {
        this.conditions = values.custom.condition;
      } else if (Array.isArray(values.conditions)) {
        this.conditions = values.conditions;
      } else if (Array.isArray(values.condition)) {
        this.conditions = values.condition;
      } else if (values.customConditions) {
        this.conditions = values.customConditions;
      }

      if (typeof nextConditionValue === 'object' && nextConditionValue && 'events' in nextConditionValue) {
        const eventValues = nextConditionValue.events;
        if (eventValues && eventValues.length > 0) {
          const eventValue = eventValues[0];
          if (CUSTOM_TRANSITION_EVENTS.includes(eventValue as CustomTransitionEvent)) {
            this.event = eventValue as CustomTransitionEvent;
          }
        } else {
          this.event = 'None';
        }
        this.conditions = nextConditionValue.conditions || this.conditions;
      }
      return;
    }

    this.predefinedType = nextPredefinedType;
    if (this.predefinedType == 'when_intent_matched') {
      this.intentName = nextIntentName ?? (nextConditionValue as string);
    } else if (this.predefinedType == 'when_no_intent_matched' || this.predefinedType == 'auto') {
      // no additional value needed
    } else if (this.predefinedType == 'when_variable_operation_matched') {
      if (
        typeof nextConditionValue === 'object' &&
        nextConditionValue &&
        'variable' in nextConditionValue &&
        'operator' in nextConditionValue &&
        'targetValue' in nextConditionValue
      ) {
        this.variable = nextConditionValue.variable;
        this.operator = nextConditionValue.operator;
        this.targetValue = nextConditionValue.targetValue;
      }
    } else if (this.predefinedType == 'when_file_received') {
      this.fileType = nextFileType ?? (nextConditionValue as string);
    }
  }
} 