import json

import pytest

from ModelingAgent.diagram_handlers.class_diagram_handler import ClassDiagramHandler


class StubLLM:
    def __init__(self, *responses):
        self._responses = list(responses)

    def predict(self, prompt: str) -> str:
        if self._responses:
            return self._responses.pop(0)
        return "{}"


def _valid_class_json(class_name="Order"):
    return json.dumps(
        {
            "className": class_name,
            "attributes": [
                {"name": "id", "type": "String", "visibility": "private"},
                {"name": "status", "type": "String", "visibility": "private"},
            ],
            "methods": [],
        }
    )


def _valid_system_json(system_name="CommerceSystem"):
    return json.dumps(
        {
            "systemName": system_name,
            "classes": [
                {
                    "className": "Order",
                    "attributes": [{"name": "id", "type": "String", "visibility": "private"}],
                    "methods": [],
                },
                {
                    "className": "Customer",
                    "attributes": [{"name": "email", "type": "String", "visibility": "private"}],
                    "methods": [],
                },
            ],
            "relationships": [
                {
                    "type": "Association",
                    "source": "Customer",
                    "target": "Order",
                    "sourceMultiplicity": "1",
                    "targetMultiplicity": "*",
                    "name": "places",
                }
            ],
        }
    )


def test_generate_single_element_returns_parsed_structure():
    handler = ClassDiagramHandler(StubLLM(_valid_class_json()))

    result = handler.generate_single_element("Create an Order class")

    assert result["action"] == "inject_element"
    assert result["diagramType"] == "ClassDiagram"
    assert result["element"]["className"] == "Order"
    assert result["message"].startswith("Created class 'Order'")


def test_generate_single_element_uses_fallback_on_invalid_json():
    handler = ClassDiagramHandler(StubLLM("not json at all"))

    result = handler.generate_single_element("Create Customer class")

    assert result["action"] == "inject_element"
    assert result["diagramType"] == "ClassDiagram"
    expected_name = handler.extract_name_from_request("Create Customer class", "NewClass")
    assert result["element"]["className"] == expected_name
    assert result["element"]["attributes"], "Fallback must include default attributes"


def test_generate_complete_system_returns_parsed_structure():
    handler = ClassDiagramHandler(StubLLM(_valid_system_json()))

    result = handler.generate_complete_system("Design a commerce platform")

    assert result["action"] == "inject_complete_system"
    assert result["diagramType"] == "ClassDiagram"
    assert len(result["systemSpec"]["classes"]) == 2
    assert result["systemSpec"]["relationships"][0]["name"] == "places"


def test_generate_complete_system_fallback_on_failure():
    handler = ClassDiagramHandler(StubLLM(""))

    result = handler.generate_complete_system("Design something vague")

    assert result["action"] == "inject_complete_system"
    assert result["systemSpec"]["systemName"] == "BasicSystem"
    assert result["systemSpec"]["classes"], "Fallback provides default classes"


def test_clean_json_response_strips_markdown_fence():
    handler = ClassDiagramHandler(StubLLM())

    fenced = """```json
{"className": "User", "attributes": [], "methods": []}
```"""
    cleaned = handler.clean_json_response(fenced)
    assert cleaned == '{"className": "User", "attributes": [], "methods": []}'
