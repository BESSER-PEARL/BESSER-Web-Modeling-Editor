import { AgentRelationshipType } from '..';
import { UMLRelationshipCenteredDescription } from '../../../services/uml-relationship/uml-relationship-centered-description';
import * as Apollon from '../../../typings';
import { UMLElement } from '../../../services/uml-element/uml-element';
import { DeepPartial } from 'redux';

export interface IUMLStateTransition {
  params: { [id: string]: string };
}

export class AgentStateTransition extends UMLRelationshipCenteredDescription implements IUMLStateTransition {
  type = AgentRelationshipType.AgentStateTransition;
  params: { [id: string]: string } = {};
  condition: string | undefined = "when_intent_matched";
  intentName: string | undefined = undefined;
  variable: string | undefined = undefined;
  operator: string | undefined = undefined;
  targetValue: string | undefined = undefined;
  fileType: string | undefined = undefined;
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
    if (values?.condition) {
      this.condition = values.condition;
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
  }

  serialize(): Apollon.AgentStateTransition {
    const base = super.serialize();
    const paramValues = Object.values(this.params);
    let conditionValue: string | { variable: string; operator: string; targetValue: string } = "";
    if (this.condition == "when_intent_matched" && this.intentName) {
      conditionValue = this.intentName
    } else if (this.condition == "when_no_intent_matched" || this.condition == "auto") {
      conditionValue = ""
    }
    else if (this.condition == "when_variable_operation_matched" && this.variable && this.operator && this.targetValue) {
      conditionValue = {"variable": this.variable, "operator": this.operator, "targetValue": this.targetValue}
    } else if (this.condition == "when_file_received" && this.fileType) {
      conditionValue = this.fileType
    }
    return {
      ...base,
      type: this.type,
      condition: this.condition,
      conditionValue: conditionValue,
    };
  }

  deserialize<T extends Apollon.UMLModelElement>(
    values: T & { params?: string | string[] | { [id: string]: string } } & { condition?: string } & { conditionValue? : string | { variable: string; operator: string; targetValue: string } } & { fileType?: string },
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
    if(values.condition == "when_intent_matched") {
      this.condition = values.condition;
      this.intentName = values.conditionValue as string;
    } else if (values.condition == "when_no_intent_matched" || values.condition == "auto") {
      this.condition = values.condition;
    } else if (values.condition == "when_variable_operation_matched") {
      this.condition = values.condition;
      if (typeof values.conditionValue === 'object') {
        this.variable = values.conditionValue.variable;
        this.operator = values.conditionValue.operator;
        this.targetValue = values.conditionValue.targetValue;
      }
    } else if (values.condition == "when_file_received") {
      this.condition = values.condition;
      this.fileType = values.conditionValue as string;
    }
  }
} 