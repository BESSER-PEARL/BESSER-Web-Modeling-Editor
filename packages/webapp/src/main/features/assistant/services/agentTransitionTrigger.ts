/**
 * The trigger of an agent transition, as the editor stores it, for a condition the
 * assistant names. Shared by the converter (a whole system) and the modifier
 * (`add_transition`), so both write the same shape.
 */

export interface TransitionTriggerSpec {
  condition?: string;
  intentName?: string;
  conditionValue?: string;
  /** Python source of a `custom_condition` (a function returning True when it should fire). */
  conditionCode?: string;
}

export interface TransitionTrigger {
  transitionType: 'predefined' | 'custom';
  predefined: Record<string, unknown>;
  custom: { event?: string; condition: string[] };
}

export function buildTransitionTrigger(spec: TransitionTriggerSpec): TransitionTrigger {
  const condition = spec.condition || 'auto';
  if (condition === 'custom_condition') {
    // No event, only a condition: the backend generates `when_condition(...)` for it.
    const code = (spec.conditionCode || '').trim();
    return {
      transitionType: 'custom',
      predefined: { predefinedType: '' },
      custom: { event: 'None', condition: code ? [code] : [] },
    };
  }
  if (condition === 'when_intent_matched') {
    return {
      transitionType: 'predefined',
      predefined: { predefinedType: 'when_intent_matched', intentName: spec.intentName || spec.conditionValue || '' },
      custom: { condition: [] },
    };
  }
  if (condition === 'when_no_intent_matched') {
    return {
      transitionType: 'predefined',
      predefined: { predefinedType: 'when_no_intent_matched' },
      custom: { condition: [] },
    };
  }
  return {
    transitionType: 'predefined',
    predefined: { predefinedType: condition, conditionValue: spec.conditionValue || '' },
    custom: { condition: [] },
  };
}
