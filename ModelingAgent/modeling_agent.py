# Intelligent UML Modeling Assistant agent
# Supports: ClassDiagram, ObjectDiagram, StateMachineDiagram, AgentDiagram

import logging
import json
import uuid
import re
import random
from typing import Dict, Any, List, Optional

from besser.agent.core.agent import Agent
from besser.agent.core.session import Session
from besser.agent.library.transition.events.base_events import ReceiveJSONEvent
from besser.agent.exceptions.logger import logger
from besser.agent.nlp.intent_classifier.intent_classifier_configuration import LLMIntentClassifierConfiguration
from besser.agent.nlp.llm.llm_openai_api import LLMOpenAI

from diagram_handlers.factory import DiagramHandlerFactory, get_diagram_type_info
from diagram_handlers.utils import (
    extract_diagram_type_from_message,
    detect_diagram_type_from_keywords
)

# Layout defaults for newly generated Apollon elements
LAYOUT_BASE_X = -940
LAYOUT_BASE_Y = -600
LAYOUT_X_SPREAD = 360
LAYOUT_Y_SPREAD = 280
CLASS_WIDTH = 220
ATTRIBUTE_HEIGHT = 25
METHOD_HEIGHT = 25
CLASS_HEADER_HEIGHT = 50

# Configure the logging module
logger.setLevel(logging.INFO)

# Create the agent
agent = Agent('uml_modeling_agent')

agent.load_properties('config.ini')

websocket_platform = agent.use_websocket_platform(use_ui=False)

def prepare_payload_from_session(session: Session, default_diagram_type: Optional[str] = None) -> Dict[str, Any]:
    """Extract and cache payload information from the current session event."""
    payload: Dict[str, Any] = {}
    raw_payload = session.get('pending_payload') or {}
    raw_message = session.get('pending_message')
    diagram_hint = session.get('pending_diagram_type')

    if session.event and hasattr(session.event, 'message'):
        event_message = session.event.message
        if isinstance(event_message, str) and event_message.strip().startswith('{'):
            try:
                payload = json.loads(event_message)
            except Exception:
                pass
        else:
            raw_message = event_message or raw_message

    if isinstance(raw_payload, dict) and raw_payload:
        payload = {**payload, **raw_payload} if payload else raw_payload

    message = payload.get('message', raw_message or '')
    diagram_type = payload.get('diagramType') or diagram_hint

    if isinstance(message, str):
        prefix_match = re.match(r'^\[DIAGRAM_TYPE:(\w+)\]\s*(.+)', message)
        if prefix_match:
            diagram_type = diagram_type or prefix_match.group(1)
            message = prefix_match.group(2)

    if not diagram_type and isinstance(message, str):
        diagram_type = extract_diagram_type_from_message(message)
    if not diagram_type and isinstance(message, str):
        diagram_type = detect_diagram_type_from_keywords(message)

    if not diagram_type:
        diagram_type = default_diagram_type or 'ClassDiagram'

    session.set('pending_payload', payload)
    session.set('pending_message', message)
    session.set('pending_diagram_type', diagram_type)

    return {
        'payload': payload,
        'message': message,
        'diagram_type': diagram_type
    }


def store_payload_for_default(session: Session, params: Dict[str, Any]) -> bool:
    """Catch-all condition that caches payload and defaults to provided diagram type."""
    default_type = params.get('default_diagram_type')
    prepare_payload_from_session(session, default_diagram_type=default_type)
    return True


def route_to_modify(session: Session, params: Dict[str, Any]) -> bool:
    """Detect if we should route to modification state based on stored intent."""
    prepare_payload_from_session(session, default_diagram_type=params.get('default_diagram_type'))
    last_intent = session.get('last_matched_intent')
    return last_intent == 'modify_model_intent'


def route_to_help(session: Session, params: Dict[str, Any]) -> bool:
    """Route to modeling help based on stored intent or empty message."""
    info = prepare_payload_from_session(session, default_diagram_type=params.get('default_diagram_type'))
    message = (info.get('message') or '').strip()
    
    # Check if we came from help intent
    last_intent = session.get('last_matched_intent')
    if last_intent == 'modeling_help_intent':
        return True

    # Empty message -> help
    if not message:
        return True

    return False


def route_to_single_element(session: Session, params: Dict[str, Any]) -> bool:
    """Route to single element creation state."""
    prepare_payload_from_session(session, default_diagram_type=params.get('default_diagram_type'))
    # Check if we came from complete system intent
    last_intent = session.get('last_matched_intent')
    return last_intent != 'create_complete_system_intent'


def route_to_complete_system(session: Session, params: Dict[str, Any]) -> bool:
    """Route to complete system creation state."""
    prepare_payload_from_session(session, default_diagram_type=params.get('default_diagram_type'))
    # Check if we came from complete system intent
    last_intent = session.get('last_matched_intent')
    return last_intent == 'create_complete_system_intent'


def clear_cached_payload(session: Session) -> None:
    """Remove any cached payload data after a state has consumed it."""
    for key in ('pending_payload', 'pending_message', 'pending_diagram_type'):
        try:
            session.delete(key)
        except Exception:
            continue

def generate_layout_position(seed: Optional[str] = None) -> Dict[str, int]:
    """Compute a deterministic layout position near the top-left workspace area."""
    rng = random.Random(seed) if seed else random
    x_offset = rng.randint(0, LAYOUT_X_SPREAD)
    y_offset = rng.randint(0, LAYOUT_Y_SPREAD)
    return {
        'x': LAYOUT_BASE_X + x_offset,
        'y': LAYOUT_BASE_Y + y_offset
    }

try:
    gpt = LLMOpenAI(
        agent=agent,
        name='gpt-4o-mini',
        parameters={
            'temperature': 0.4,
            'max_tokens': 3000
        },
        num_previous_messages=3
    )
    
    if gpt is None:
        raise Exception("LLM initialization returned None")
    
    logger.info("✅ LLM initialized successfully")
    
except Exception as e:
    logger.error(f"❌ Failed to initialize LLM: {e}")
    print("\n" + "="*80)
    print("ERROR: Failed to Initialize OpenAI LLM")
    print("="*80)
    print(f"\nError: {e}")
    print("\nPlease check:")
    print("1. Your OpenAI API key in config.ini (line: nlp.openai.api_key)")
    print("2. The key format should be: sk-proj-... or sk-...")
    print("3. The key has not expired or been revoked")
    print("4. You have credits available in your OpenAI account")
    print("\nGet your key from: https://platform.openai.com/api-keys")
    print("="*80 + "\n")
    exit(1)

gpt_complex = gpt

# Initialize diagram handler factory
diagram_factory = DiagramHandlerFactory(gpt)
logger.info(f"✅ Diagram handlers initialized: {', '.join(diagram_factory.get_supported_types())}")

ic_config = LLMIntentClassifierConfiguration(
    llm_name='gpt-4o-mini',
    parameters={},
    use_intent_descriptions=True,
    use_training_sentences=False,
    use_entity_descriptions=True,
    use_entity_synonyms=False
)

agent.set_default_ic_config(ic_config)

# STATES
greetings_state = agent.new_state('greetings_state', initial=True)
diagram_router_state = agent.new_state('diagram_router_state')
create_single_element_state = agent.new_state('create_single_element_state')
create_complete_system_state = agent.new_state('create_complete_system_state')
modify_model_state = agent.new_state('modify_model_state')
modeling_help_state = agent.new_state('modeling_help_state')
clarify_diagram_type_state = agent.new_state('clarify_diagram_type_state')

# INTENTS
hello_intent = agent.new_intent(
    name='hello_intent',
    description='The user greets you or wants to start a conversation'
)

create_single_element_intent = agent.new_intent(
    name='create_single_element_intent',
    description='The user wants to create a single UML element like one class, one object, one state, or one agent. Keywords: "create a class", "add a User class", "make a new state", "create an object"'
)

create_complete_system_intent = agent.new_intent(
    name='create_complete_system_intent',
    description='The user wants to create a complete system from scratch with multiple NEW elements. Keywords: "create a library system", "design an e-commerce architecture", "generate a complete banking application", "build a new system with multiple classes". This is ONLY for creating new systems, NOT for modifying existing ones.'
)

modify_model_intent = agent.new_intent(
    name='modify_model_intent',
    description='The user wants to modify, change, update, edit, add to, or connect elements in an EXISTING UML model. Keywords: "add relationship", "connect", "add inheritance", "add generalization", "relate", "modify class", "change attribute", "update method", "delete", "remove", "rename", "add association", "add composition", "add aggregation", "link classes"'
)

modeling_help_intent = agent.new_intent(
    name='modeling_help_intent',
    description='The user asks for help with UML modeling, design patterns, or modeling concepts'
)

# STATE BODY DEFINITIONS

def generate_model_modification(user_request: str, current_model: Dict[str, Any] = None) -> Dict[str, Any]:
    """Generate model modifications based on user request and current model context"""
    system_prompt = """You are a UML modeling expert. The user wants to modify an existing UML model.

Return ONLY a JSON object with this structure:
{
  "action": "modify_model",
  "modification": {
    "action": "modify_class" | "modify_attribute" | "modify_method" | "add_relationship" | "remove_element",
    "target": {
      "classId": "optional_id",
      "className": "ClassName",
      "attributeId": "optional_attr_id",
      "attributeName": "originalAttributeName",
      "methodId": "optional_method_id",
      "methodName": "originalMethodName",
      "relationshipId": "optional_relationship_id",
      "relationshipName": "existingRelationshipName",
      "sourceClass": "SourceClass",
      "targetClass": "TargetClass"
    },
    "changes": {
      "name": "newName",
      "type": "newType",
      "visibility": "public|private|protected",
      "parameters": [{"name": "param", "type": "String"}],
      "returnType": "ReturnType",
      "sourceMultiplicity": "1",
      "targetMultiplicity": "*",
      "relationshipType": "Association|Aggregation|Composition|Inheritance"
    }
  },
  "message": "Short explanation of what changed"
}

Rules:
1. Only reference classes or elements that exist in the provided model context.
2. When renaming attributes or methods include the ORIGINAL name in target.attributeName/target.methodName.
3. When adding relationships include sourceClass, targetClass, relationshipType, and multiplicities.
4. Prefer ids if provided in the context.
5. Keep the message user-friendly and concise.
6. Do not invent new classes unless the user explicitly asks to add them."""

    context_info = []
    if current_model and isinstance(current_model, dict) and current_model.get('elements'):
        elements = current_model.get('elements', {})
        for element in elements.values():
            if element.get('type') == 'Class':
                name = element.get('name', 'Unknown')
                attr_names = []
                for attr_id in element.get('attributes', []) or []:
                    attr = elements.get(attr_id, {})
                    attr_name = attr.get('name')
                    if attr_name:
                        attr_names.append(attr_name)
                method_names = []
                for method_id in element.get('methods', []) or []:
                    method = elements.get(method_id, {})
                    method_name = method.get('name')
                    if method_name:
                        method_names.append(method_name)
                summary = f"Class {name}"
                if attr_names:
                    summary += f" | attributes: {', '.join(attr_names[:4])}"
                if method_names:
                    summary += f" | methods: {', '.join(method_names[:4])}"
                context_info.append(summary)

    context_block = ''
    if context_info:
        context_block = "\n\nCurrent model summary:\n- " + "\n- ".join(context_info[:8])

    user_prompt = f"Modify the UML model: {user_request}{context_block}"

    try:
        response = gpt.predict(f"{system_prompt}\n\nUser Request: {user_prompt}")

        json_text = response.strip()
        if json_text.startswith('```json'):
            json_text = json_text[7:]
        if json_text.endswith('```'):
            json_text = json_text[:-3]
        json_text = json_text.strip()

        modification_spec = json.loads(json_text)
        if not isinstance(modification_spec, dict):
            raise ValueError("Modification response is not a JSON object")

        modification_spec.setdefault('action', 'modify_model')
        if 'modification' not in modification_spec:
            raise ValueError("Missing modification payload")

        modification_spec.setdefault(
            'message',
            f"Applied {modification_spec['modification'].get('action', 'modification')} to {modification_spec['modification'].get('target', {}).get('className', 'model')}"
        )
        
        # logger.info(f"[LLM] Final modification spec being sent:")
        # logger.info(f"  - Action: {modification_spec['modification'].get('action')}")
        # logger.info(f"  - Target: {modification_spec['modification'].get('target')}")
        # logger.info(f"  - Changes: {modification_spec['modification'].get('changes')}")

        return modification_spec

    except Exception as e:
        logger.error(f"Error generating model modification: {e}")
        return {
            'action': 'modify_model',
            'modification': {
                'action': 'modify_class',
                'target': {'className': 'Unknown'},
                'changes': {'name': 'ModifiedClass'}
            },
            'message': 'Failed to generate modification automatically (fallback used).'
        }


# STATE BODY DEFINITIONS

def global_fallback_body(session: Session):
    user_message = session.event.message or ""
    answer = gpt.predict(f"You are a UML modeling assistant. The user said: '{user_message}'. If this is related to UML modeling, suggest how you can help them create models, classes, or diagrams. Otherwise, politely explain that you specialize in UML modeling assistance.")
    session.reply(answer)

agent.set_global_fallback_body(global_fallback_body)

def greetings_body(session: Session):
    # Simple greeting - only send once per session to avoid double greetings
    if session.get('has_greeted'):
        return

    if hasattr(session, 'event') and session.event is not None:
        if getattr(session.event, 'human', True) is False:
            return

    greeting_message = """Hello! I'm your UML Assistant!

I can help you:
- Create classes: "Create a User class"
- Build systems: "Create a library management system"
- Create agent diagrams: "Create a agent"
- Modify diagrams: "Add transition from welcome to menu"

What would you like to create?"""

    session.reply(greeting_message)
    session.set('has_greeted', True)


greetings_state.set_body(greetings_body)

# Transitions from greetings state
greetings_state.when_intent_matched(hello_intent).go_to(greetings_state)
greetings_state.when_intent_matched(create_single_element_intent).go_to(create_single_element_state)
greetings_state.when_intent_matched(create_complete_system_intent).go_to(create_complete_system_state)
greetings_state.when_intent_matched(modify_model_intent).go_to(modify_model_state)
greetings_state.when_intent_matched(modeling_help_intent).go_to(modeling_help_state)
greetings_state.when_event(ReceiveJSONEvent())\
    .with_condition(store_payload_for_default, {'default_diagram_type': 'ClassDiagram'})\
    .go_to(diagram_router_state)
greetings_state.when_no_intent_matched().go_to(modeling_help_state)

def diagram_router_body(session: Session):
    pass

diagram_router_state.set_body(diagram_router_body)

# JSON event routing (fallback only - prefer text messages for NLP intent detection)
diagram_router_state.when_condition(route_to_modify, {'default_diagram_type': 'ClassDiagram'})\
    .go_to(modify_model_state)
diagram_router_state.when_condition(route_to_help, {'default_diagram_type': 'ClassDiagram'})\
    .go_to(modeling_help_state)
# Route based on previously matched intent (stored in session)
diagram_router_state.when_condition(route_to_complete_system, {'default_diagram_type': 'ClassDiagram'})\
    .go_to(create_complete_system_state)
diagram_router_state.when_condition(route_to_single_element, {'default_diagram_type': 'ClassDiagram'})\
    .go_to(create_single_element_state)

def extract_modeling_context(session: Session) -> Optional[Dict[str, Any]]:
    """Normalize request data for the specialized modeling states."""
    if not session.event or not hasattr(session.event, 'message'):
        user_message = ""
    else:
        user_message = session.event.message or ""

    cached_payload = session.get('pending_payload')
    cached_message = session.get('pending_message')
    cached_diagram_type = session.get('pending_diagram_type')

    diagram_type: Optional[str] = None
    actual_message = user_message
    payload_data: Optional[Dict[str, Any]] = None

    prefix_match = re.match(r'^\[DIAGRAM_TYPE:(\w+)\]\s*(.+)', user_message)
    if prefix_match:
        diagram_type = prefix_match.group(1)
        actual_message = prefix_match.group(2)

    if hasattr(session.event, 'data') and isinstance(session.event.data, dict):
        if not diagram_type:
            diagram_type = session.event.data.get('diagramType')
        if not payload_data:
            payload_candidate = session.event.data.get('message')
            if isinstance(payload_candidate, (dict, list)):
                payload_data = payload_candidate
            elif isinstance(payload_candidate, str) and payload_candidate.strip().startswith('{'):
                try:
                    payload_data = json.loads(payload_candidate)
                except Exception:
                    pass

    if user_message.strip().startswith('{'):
        try:
            payload_data = json.loads(user_message)
        except Exception:
            pass

    if payload_data and isinstance(payload_data, dict):
        actual_message = payload_data.get('message', actual_message)
        if not diagram_type:
            diagram_type = payload_data.get('diagramType')
        if isinstance(actual_message, str):
            payload_prefix_match = re.match(r'^\[DIAGRAM_TYPE:(\w+)\]\s*(.+)', actual_message)
            if payload_prefix_match:
                if not diagram_type:
                    diagram_type = payload_prefix_match.group(1)
                actual_message = payload_prefix_match.group(2)

    if not payload_data and isinstance(cached_payload, dict):
        payload_data = cached_payload

    if not actual_message.strip() and hasattr(session.event, 'data') and isinstance(session.event.data, dict):
        actual_message = session.event.data.get('message', actual_message) or actual_message

    if not actual_message.strip() and isinstance(cached_message, str):
        actual_message = cached_message

    if not diagram_type:
        diagram_type = extract_diagram_type_from_message(user_message)

    if not diagram_type and actual_message:
        diagram_type = extract_diagram_type_from_message(actual_message)

    if not diagram_type and cached_diagram_type:
        diagram_type = cached_diagram_type

    if not diagram_type:
        diagram_type = detect_diagram_type_from_keywords(actual_message)

    if not diagram_type:
        diagram_type = 'ClassDiagram'

    current_model = None
    if payload_data and isinstance(payload_data, dict):
        current_model = payload_data.get('currentModel')

    if not current_model and hasattr(session.event, 'data') and isinstance(session.event.data, dict):
        current_model = session.event.data.get('currentModel')

    diagram_info = get_diagram_type_info(diagram_type)
    handler = diagram_factory.get_handler(diagram_type)
    
    # Log the diagram type and handler being used for this request
    logger.info(f"📊 {diagram_type} | Handler: {handler.__class__.__name__ if handler else 'None'}")

    return {
        'user_message': user_message,
        'actual_message': actual_message,
        'diagram_type': diagram_type,
        'payload_data': payload_data,
        'current_model': current_model,
        'diagram_info': diagram_info,
        'handler': handler
    }

def create_single_element_body(session: Session):
    """Generate a single UML element based on the user's request."""
    # Store which intent brought us here
    session.set('last_matched_intent', 'create_single_element_intent')
    
    context = extract_modeling_context(session)
    if not context:
        return

    handler = context['handler']
    diagram_type = context['diagram_type']
    actual_message = context['actual_message']
    current_model = context['current_model']

    if not handler:
        session.reply(f"Warning: {diagram_type} is not supported yet. Please use ClassDiagram for now.")
        return

    # Check if this is the JSON event with full context (has currentModel)
    is_json_event = isinstance(session.event, ReceiveJSONEvent) and current_model is not None
    
    # For text events, just acknowledge - wait for JSON with full context
    if not is_json_event:
        return

    # Now we have the JSON event with full context - process it
    
    try:
        result = handler.generate_single_element(actual_message)

        if result and result.get('element'):
            result['diagramType'] = diagram_type
            session.reply(json.dumps(result))
        else:
            session.reply("I had trouble creating that element. Could you provide more details?")

    except Exception as e:
        logger.error(f"Error in create_single_element_body: {e}")
        session.reply("I encountered an issue while creating the element. Could you try rephrasing your request?")
    finally:
        clear_cached_payload(session)

create_single_element_state.set_body(create_single_element_body)


def create_complete_system_body(session: Session):
    """Generate a complete system with multiple elements and relationships."""
    # Store which intent brought us here
    session.set('last_matched_intent', 'create_complete_system_intent')
    
    context = extract_modeling_context(session)
    if not context:
        return

    handler = context['handler']
    diagram_type = context['diagram_type']
    actual_message = context['actual_message']
    current_model = context['current_model']

    if not handler:
        session.reply(f"Warning: {diagram_type} is not supported yet. Please use ClassDiagram for now.")
        return

    # Check if this is the JSON event with full context (has currentModel)
    is_json_event = isinstance(session.event, ReceiveJSONEvent) and current_model is not None
    
    # For text events, just acknowledge - wait for JSON with full context
    if not is_json_event:
        return

    # Now we have the JSON event with full context - process it
    
    try:
        result = handler.generate_complete_system(actual_message)

        if result and result.get('systemSpec'):
            result['diagramType'] = diagram_type
            session.reply(json.dumps(result))
        else:
            session.reply("I had trouble generating that system. Could you provide more details?")

    except Exception as e:
        logger.error(f"Error in create_complete_system_body: {e}")
        session.reply("I encountered an issue while creating the system. Could you try rephrasing your request?")
    finally:
        clear_cached_payload(session)

create_complete_system_state.set_body(create_complete_system_body)

def modify_modeling_body(session: Session):
    """Apply modifications to an existing UML model."""
    # Store which intent brought us here
    session.set('last_matched_intent', 'modify_model_intent')
    
    context = extract_modeling_context(session)
    if not context:
        return

    handler = context['handler']
    diagram_type = context['diagram_type']
    actual_message = context['actual_message']
    current_model = context['current_model']

    if not handler:
        session.reply(f"Warning: {diagram_type} is not supported yet. Please use ClassDiagram for now.")
        return

    # Check if this is the JSON event with full context (has currentModel)
    is_json_event = isinstance(session.event, ReceiveJSONEvent) and current_model is not None
    
    # For text events, just acknowledge - wait for JSON with full context
    if not is_json_event:
        return

    # Now we have the JSON event with full context - process it

    try:
        # Use the handler's specialized generate_modification method
        modification_spec = handler.generate_modification(actual_message, current_model)

        if modification_spec and modification_spec.get('modification'):
            modification_spec['diagramType'] = diagram_type
            
            # # Log what we're sending
            # logger.info(f"[MODIFY] Sending modification to frontend:")
            # logger.info(f"  - Action: {modification_spec.get('action')}")
            # logger.info(f"  - Modification action: {modification_spec['modification'].get('action')}")
            # logger.info(f"  - Target: {modification_spec['modification'].get('target')}")
            # logger.info(f"  - Changes: {modification_spec['modification'].get('changes')}")
            
            session.reply(json.dumps(modification_spec))
        else:
            session.reply("I couldn't determine the modification to apply. Could you provide more detail?")

    except Exception as e:
        logger.error(f"Error in modify_modeling_body: {e}")
        session.reply("I encountered an issue while updating the model. Could you try rephrasing your request?")
    finally:
        clear_cached_payload(session)

modify_model_state.set_body(modify_modeling_body)

def modeling_help_body(session: Session):
    """Offer guidance or clarifying questions when the user needs modeling help."""
    # Store which intent brought us here
    session.set('last_matched_intent', 'modeling_help_intent')
    
    context = extract_modeling_context(session)
    if not context:
        return

    diagram_info = context['diagram_info']
    actual_message = context['actual_message']
    current_model = context['current_model']

    # Check if this is the JSON event with full context
    is_json_event = isinstance(session.event, ReceiveJSONEvent) and current_model is not None
    
    # For text events, just acknowledge - wait for JSON with full context
    if not is_json_event:
        return

    # Now we have the JSON event with full context - process it

    help_prompt = f"""You are a UML modeling expert assistant working with {diagram_info['name']}. The user asked: "{actual_message}"

Current diagram type: {diagram_info['name']} - {diagram_info['description']}

Provide helpful, practical advice about UML modeling for this diagram type. If they're asking about concepts, explain them clearly. If they want to create something, guide them on how to express their requirements.

Keep your response conversational and encouraging. Suggest specific things they can ask you to create."""

    try:
        answer = gpt.predict(help_prompt)
        session.reply(answer)
    except Exception as e:
        logger.error(f"Error in modeling_help_body: {e}")
        session.reply("I encountered an issue while preparing guidance. Could you try again?")
    finally:
        clear_cached_payload(session)

modeling_help_state.set_body(modeling_help_body)

def clarify_diagram_type_body(session: Session):
    """Ask user to clarify the diagram type when it cannot be determined."""
    context = extract_modeling_context(session)
    if not context:
        return

    actual_message = context['actual_message']
    current_model = context['current_model']
    
    # Check if this is the JSON event with full context
    is_json_event = isinstance(session.event, ReceiveJSONEvent) and current_model is not None
    
    # For text events, just acknowledge - wait for JSON with full context
    if not is_json_event:
        return

    # Now we have the JSON event with full context

    clarification_prompt = f"""I'd like to help you with: "{actual_message}"

However, I need to know which type of UML diagram you'd like to create:

📊 **ClassDiagram** - For classes, attributes, methods, and relationships
📦 **ObjectDiagram** - For object instances and their links
🔄 **StateMachineDiagram** - For states, transitions, and events
🤖 **AgentDiagram** - For agents, beliefs, goals, and messages

Please specify the diagram type, or rephrase your request with more context.

For example:
- "Create a User class" → ClassDiagram
- "Create a state machine for login" → StateMachineDiagram
- "Create an agent for customer service" → AgentDiagram"""

    try:
        session.reply(clarification_prompt)
    except Exception as e:
        logger.error(f"Error in clarify_diagram_type_body: {e}")
        session.reply("I need to know which diagram type you'd like. Please specify: Class, Object, StateMachine, or Agent diagram.")
    finally:
        clear_cached_payload(session)

clarify_diagram_type_state.set_body(clarify_diagram_type_body)

# Transitions from create_single_element state
create_single_element_state.when_intent_matched(create_single_element_intent).go_to(create_single_element_state)
create_single_element_state.when_intent_matched(create_complete_system_intent).go_to(create_complete_system_state)
create_single_element_state.when_intent_matched(modify_model_intent).go_to(modify_model_state)
create_single_element_state.when_intent_matched(modeling_help_intent).go_to(modeling_help_state)
create_single_element_state.when_intent_matched(hello_intent).go_to(greetings_state)
create_single_element_state.when_event(ReceiveJSONEvent())\
    .with_condition(store_payload_for_default, {'default_diagram_type': 'ClassDiagram'})\
    .go_to(diagram_router_state)
create_single_element_state.when_no_intent_matched().go_to(create_single_element_state)

# Transitions from create_complete_system state
create_complete_system_state.when_intent_matched(create_single_element_intent).go_to(create_single_element_state)
create_complete_system_state.when_intent_matched(create_complete_system_intent).go_to(create_complete_system_state)
create_complete_system_state.when_intent_matched(modify_model_intent).go_to(modify_model_state)
create_complete_system_state.when_intent_matched(modeling_help_intent).go_to(modeling_help_state)
create_complete_system_state.when_intent_matched(hello_intent).go_to(greetings_state)
create_complete_system_state.when_event(ReceiveJSONEvent())\
    .with_condition(store_payload_for_default, {'default_diagram_type': 'ClassDiagram'})\
    .go_to(diagram_router_state)
create_complete_system_state.when_no_intent_matched().go_to(create_complete_system_state)

# Transitions from modify state
modify_model_state.when_intent_matched(create_single_element_intent).go_to(create_single_element_state)
modify_model_state.when_intent_matched(create_complete_system_intent).go_to(create_complete_system_state)
modify_model_state.when_intent_matched(modify_model_intent).go_to(modify_model_state)
modify_model_state.when_intent_matched(modeling_help_intent).go_to(modeling_help_state)
modify_model_state.when_intent_matched(hello_intent).go_to(greetings_state)
modify_model_state.when_event(ReceiveJSONEvent())\
    .with_condition(store_payload_for_default, {'default_diagram_type': 'ClassDiagram'})\
    .go_to(diagram_router_state)
modify_model_state.when_no_intent_matched().go_to(modify_model_state)

# Transitions from modeling help state
modeling_help_state.when_intent_matched(create_single_element_intent).go_to(create_single_element_state)
modeling_help_state.when_intent_matched(create_complete_system_intent).go_to(create_complete_system_state)
modeling_help_state.when_intent_matched(modify_model_intent).go_to(modify_model_state)
modeling_help_state.when_intent_matched(modeling_help_intent).go_to(modeling_help_state)
modeling_help_state.when_intent_matched(hello_intent).go_to(greetings_state)
modeling_help_state.when_event(ReceiveJSONEvent())\
    .with_condition(store_payload_for_default, {'default_diagram_type': 'ClassDiagram'})\
    .go_to(diagram_router_state)
modeling_help_state.when_no_intent_matched().go_to(modeling_help_state)

# Transitions from clarify_diagram_type state
clarify_diagram_type_state.when_intent_matched(create_single_element_intent).go_to(create_single_element_state)
clarify_diagram_type_state.when_intent_matched(create_complete_system_intent).go_to(create_complete_system_state)
clarify_diagram_type_state.when_intent_matched(modify_model_intent).go_to(modify_model_state)
clarify_diagram_type_state.when_intent_matched(modeling_help_intent).go_to(modeling_help_state)
clarify_diagram_type_state.when_intent_matched(hello_intent).go_to(greetings_state)
clarify_diagram_type_state.when_event(ReceiveJSONEvent())\
    .with_condition(store_payload_for_default, {'default_diagram_type': 'ClassDiagram'})\
    .go_to(diagram_router_state)
clarify_diagram_type_state.when_no_intent_matched().go_to(clarify_diagram_type_state)


# No automatic return to greetings - specialized states maintain context

# RUN APPLICATION
if __name__ == '__main__':
    agent.run()
