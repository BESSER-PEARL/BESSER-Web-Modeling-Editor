import json
from types import SimpleNamespace

import pytest

from ModelingAgent import modeling_agent as bot
from besser.agent.core.session import Session
from besser.agent.library.transition.events.base_events import ReceiveJSONEvent


def test_prepare_payload_from_session_with_prefix():
    session = Session()
    session.event = SimpleNamespace(message="[DIAGRAM_TYPE:ObjectDiagram] Create an order instance")

    result = bot.prepare_payload_from_session(session, default_diagram_type="ClassDiagram")

    assert result["diagram_type"] == "ObjectDiagram"
    assert result["message"] == "Create an order instance"
    assert session.get("pending_diagram_type") == "ObjectDiagram"
    assert session.get("pending_message") == "Create an order instance"


def test_prepare_payload_from_session_with_json_payload():
    payload = {
        "message": "Create the login state machine",
        "diagramType": "StateMachineDiagram",
        "context": {"example": True},
    }
    session = Session()
    session.event = SimpleNamespace(message=json.dumps(payload))

    result = bot.prepare_payload_from_session(session, default_diagram_type="ClassDiagram")

    assert result["payload"] == payload
    assert result["diagram_type"] == "StateMachineDiagram"
    assert session.get("pending_payload") == payload


def test_prepare_payload_from_session_uses_default_when_missing_diagram():
    session = Session()
    session.event = SimpleNamespace(message="Just make something")

    result = bot.prepare_payload_from_session(session, default_diagram_type="AgentDiagram")

    assert result["diagram_type"] == "AgentDiagram"
    assert session.get("pending_diagram_type") == "AgentDiagram"


@pytest.mark.parametrize(
    "last_intent,expected",
    [
        ("modeling_help_intent", True),
        ("", True),
        (None, True),
        ("create_single_element_intent", False),
    ],
)
def test_route_to_help_handles_intents(last_intent, expected):
    session = Session()
    session.event = SimpleNamespace(message="" if last_intent in (None, "") else "Need guidance")
    if last_intent is not None:
        session.set("last_matched_intent", last_intent)

    routed = bot.route_to_help(session, {"default_diagram_type": "ClassDiagram"})

    assert routed is expected


def test_route_to_modify_requires_modify_intent():
    session = Session()
    session.event = SimpleNamespace(message="Adjust existing class")
    session.set("last_matched_intent", "modify_model_intent")

    assert bot.route_to_modify(session, {"default_diagram_type": "ClassDiagram"}) is True

    session.set("last_matched_intent", "create_single_element_intent")
    assert bot.route_to_modify(session, {"default_diagram_type": "ClassDiagram"}) is False


def test_route_to_single_and_complete_system():
    session = Session()
    session.event = SimpleNamespace(message="Build entire system")
    session.set("last_matched_intent", "create_complete_system_intent")
    assert bot.route_to_complete_system(session, {"default_diagram_type": "ClassDiagram"}) is True
    assert bot.route_to_single_element(session, {"default_diagram_type": "ClassDiagram"}) is False

    session.set("last_matched_intent", "create_single_element_intent")
    assert bot.route_to_single_element(session, {"default_diagram_type": "ClassDiagram"}) is True
    assert bot.route_to_complete_system(session, {"default_diagram_type": "ClassDiagram"}) is False


def test_store_payload_for_default_caches_and_returns_true():
    session = Session()
    session.event = SimpleNamespace(message="Create a product class")

    assert bot.store_payload_for_default(session, {"default_diagram_type": "ClassDiagram"}) is True
    assert session.get("pending_diagram_type") == "ClassDiagram"


def test_clear_cached_payload_removes_session_entries():
    session = Session()
    session.set("pending_payload", {"message": "X"})
    session.set("pending_message", "X")
    session.set("pending_diagram_type", "ClassDiagram")

    bot.clear_cached_payload(session)

    assert session.get("pending_payload") is None
    assert session.get("pending_message") is None
    assert session.get("pending_diagram_type") is None


def test_generate_layout_position_deterministic_seed():
    position_one = bot.generate_layout_position(seed="abc")
    position_two = bot.generate_layout_position(seed="abc")
    assert position_one == position_two
    assert set(position_one.keys()) == {"x", "y"}


def test_extract_modeling_context_reads_json_payload(monkeypatch):
    handler = object()
    monkeypatch.setattr(bot.diagram_factory, "get_handler", lambda diagram_type: handler)

    payload = {
        "message": "Create a Customer class",
        "diagramType": "ClassDiagram",
        "currentModel": {"elements": {}},
    }
    session = Session()
    session.event = ReceiveJSONEvent(message=json.dumps(payload), data=payload)

    context = bot.extract_modeling_context(session)

    assert context["diagram_type"] == "ClassDiagram"
    assert context["actual_message"] == "Create a Customer class"
    assert context["current_model"] == {"elements": {}}
    assert context["handler"] is handler


def test_clarify_diagram_type_body_responds_and_clears_cache():
    session = Session()
    session.set("pending_payload", {"message": "Add something"})
    session.set("pending_message", "Add something")
    session.set("pending_diagram_type", "ClassDiagram")
    payload = {
        "message": "Add something",
        "diagramType": "",
        "currentModel": {},
    }
    session.event = ReceiveJSONEvent(message=json.dumps(payload), data=payload)

    bot.clarify_diagram_type_body(session)

    assert session.replies, "Clarification message should be sent"
    assert "ClassDiagram" in session.replies[0]
    assert session.get("pending_payload") is None
    assert session.get("pending_message") is None
    assert session.get("pending_diagram_type") is None
