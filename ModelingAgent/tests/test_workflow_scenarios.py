import json
from types import SimpleNamespace

import pytest

from ModelingAgent import modeling_agent as bot
from besser.agent.core.session import Session
from besser.agent.library.transition.events.base_events import ReceiveJSONEvent


class StubDiagramHandler:
    def __init__(self, element_response=None, system_response=None):
        self.element_response = element_response or {
            "action": "inject_element",
            "element": {"className": "User", "attributes": [], "methods": []},
            "diagramType": "ClassDiagram",
            "message": "Created class 'User' with 0 attribute(s) and 0 method(s).",
        }
        self.system_response = system_response or {
            "action": "inject_complete_system",
            "systemSpec": {
                "systemName": "SampleSystem",
                "classes": [
                    {"className": "User", "attributes": [], "methods": []},
                    {"className": "Account", "attributes": [], "methods": []},
                ],
                "relationships": [],
            },
            "diagramType": "ClassDiagram",
            "message": "Created SampleSystem.",
        }
        self.generated_single_requests = []
        self.generated_system_requests = []

    def generate_single_element(self, user_request: str):
        self.generated_single_requests.append(user_request)
        return self.element_response

    def generate_complete_system(self, user_request: str):
        self.generated_system_requests.append(user_request)
        return self.system_response


class StubFactory:
    def __init__(self, handler):
        self.handler = handler

    def get_handler(self, diagram_type: str):
        return self.handler

    def get_supported_types(self):
        return ["ClassDiagram"]


def _make_json_event(message_text: str, diagram_type: str = "ClassDiagram", include_model=True):
    payload = {"message": message_text, "diagramType": diagram_type}
    if include_model:
        payload["currentModel"] = {"elements": {}}
    return ReceiveJSONEvent(message=json.dumps(payload), data=payload)


def test_create_single_element_body_replies_with_handler_payload(monkeypatch):
    handler = StubDiagramHandler()
    monkeypatch.setattr(bot, "diagram_factory", StubFactory(handler))

    session = Session()
    session.event = _make_json_event("Create a Customer class")

    bot.create_single_element_body(session)

    assert session.get("last_matched_intent") == "create_single_element_intent"
    assert len(handler.generated_single_requests) == 1
    assert not handler.generated_system_requests
    assert len(session.replies) == 1
    reply_payload = json.loads(session.replies[0])
    assert reply_payload["diagramType"] == "ClassDiagram"
    assert reply_payload["element"]["className"] == "User"


def test_create_single_element_body_waits_for_json_event(monkeypatch):
    handler = StubDiagramHandler()
    monkeypatch.setattr(bot, "diagram_factory", StubFactory(handler))

    session = Session()
    session.event = SimpleNamespace(message="Create a class without context")

    bot.create_single_element_body(session)

    assert not session.replies, "Should not reply until JSON context arrives"


def test_create_single_element_body_warns_when_handler_missing(monkeypatch):
    class NoneFactory:
        def get_handler(self, diagram_type):
            return None

        def get_supported_types(self):
            return []

    monkeypatch.setattr(bot, "diagram_factory", NoneFactory())

    session = Session()
    session.event = _make_json_event("Create something", diagram_type="UnknownDiagram")

    bot.create_single_element_body(session)

    assert session.replies, "Warning message expected when handler missing"
    assert "not supported yet" in session.replies[0]


def test_create_complete_system_body_replies_with_handler_payload(monkeypatch):
    handler = StubDiagramHandler()
    monkeypatch.setattr(bot, "diagram_factory", StubFactory(handler))

    session = Session()
    session.event = _make_json_event("Build an e-commerce system")

    bot.create_complete_system_body(session)

    assert session.get("last_matched_intent") == "create_complete_system_intent"
    assert len(handler.generated_system_requests) == 1
    assert len(session.replies) == 1
    reply_payload = json.loads(session.replies[0])
    assert reply_payload["diagramType"] == "ClassDiagram"
    assert reply_payload["systemSpec"]["systemName"] == "SampleSystem"


def test_create_complete_system_body_waits_for_json_event(monkeypatch):
    handler = StubDiagramHandler()
    monkeypatch.setattr(bot, "diagram_factory", StubFactory(handler))

    session = Session()
    session.event = SimpleNamespace(message="Design an app")

    bot.create_complete_system_body(session)

    assert not session.replies, "No JSON context yet, so no reply expected"
