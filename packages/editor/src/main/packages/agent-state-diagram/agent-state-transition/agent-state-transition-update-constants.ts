// Static data of the agent transition property panel.

// These arrays live at module scope, so they cannot call this.props.translate.
// Instead they hold i18n KEYS, resolved at render time. `value` is used in
// logic (persisted on the model / matched in code) and is NEVER translated.
// The custom-event labels are technical identifiers (DummyEvent, GUIEvent, …)
// used as the display label AND stored value, so they intentionally stay in
// English; only the descriptions are translated.
export const PREDEFINED_TRANSITIONS = [
  {
    value: 'auto',
    labelKey: 'packages.AgentDiagram.transitionLabel.auto',
    descriptionKey: 'packages.AgentDiagram.transitionDesc.auto',
  },
  {
    value: 'when_intent_matched',
    labelKey: 'packages.AgentDiagram.transitionLabel.intentMatched',
    descriptionKey: 'packages.AgentDiagram.transitionDesc.intentMatched',
  },
  {
    value: 'when_no_intent_matched',
    labelKey: 'packages.AgentDiagram.transitionLabel.noIntentMatched',
    descriptionKey: 'packages.AgentDiagram.transitionDesc.noIntentMatched',
  },
  {
    value: 'when_variable_operation_matched',
    labelKey: 'packages.AgentDiagram.transitionLabel.variableOperationMatched',
    descriptionKey: 'packages.AgentDiagram.transitionDesc.variableOperationMatched',
  },
  {
    value: 'when_file_received',
    labelKey: 'packages.AgentDiagram.transitionLabel.fileReceived',
    descriptionKey: 'packages.AgentDiagram.transitionDesc.fileReceived',
  },
  {
    value: 'when_form_submitted',
    labelKey: 'packages.AgentDiagram.transitionLabel.formSubmitted',
    descriptionKey: 'packages.AgentDiagram.transitionDesc.formSubmitted',
  },
] as const;

export const CUSTOM_EVENTS = [
  {
    value: 'None',
    label: 'None',
    descriptionKey: 'packages.AgentDiagram.customEventDesc.none',
  },
  {
    value: 'DummyEvent',
    label: 'DummyEvent',
    descriptionKey: 'packages.AgentDiagram.customEventDesc.dummyEvent',
  },
  {
    value: 'WildcardEvent',
    label: 'WildcardEvent',
    descriptionKey: 'packages.AgentDiagram.customEventDesc.wildcardEvent',
  },
  {
    value: 'ReceiveMessageEvent',
    label: 'ReceiveMessageEvent',
    descriptionKey: 'packages.AgentDiagram.customEventDesc.receiveMessageEvent',
  },
  {
    value: 'ReceiveTextEvent',
    label: 'ReceiveTextEvent',
    descriptionKey: 'packages.AgentDiagram.customEventDesc.receiveTextEvent',
  },
  {
    value: 'ReceiveJSONEvent',
    label: 'ReceiveJSONEvent',
    descriptionKey: 'packages.AgentDiagram.customEventDesc.receiveJsonEvent',
  },
  {
    value: 'ReceiveFileEvent',
    label: 'ReceiveFileEvent',
    descriptionKey: 'packages.AgentDiagram.customEventDesc.receiveFileEvent',
  },
  {
    value: 'GUIEvent',
    label: 'GUIEvent',
    descriptionKey: 'packages.AgentDiagram.customEventDesc.guiEvent',
  },
] as const;

export const CUSTOM_CONDITION_TEMPLATE = `def condition(session: 'Session', params: dict) -> bool:
    """Boolean function

    Args:
        session (Session): the current user session
        params (dict): the function parameters

    Returns:
        bool: True or False
    """
    if session.get('x') > 10:
        return True
    else:
        return False`;
