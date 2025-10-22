"""
Base Diagram Handler
Provides common functionality for all diagram type handlers
"""

import json
import uuid
from typing import Dict, Any, Optional
from abc import ABC, abstractmethod


class BaseDiagramHandler(ABC):
    """Base class for all diagram type handlers"""
    
    def __init__(self, llm):
        """Initialize handler with LLM instance"""
        self.llm = llm
    
    @abstractmethod
    def get_diagram_type(self) -> str:
        """Return the diagram type this handler supports"""
        pass
    
    @abstractmethod
    def get_system_prompt(self) -> str:
        """Return the system prompt for this diagram type"""
        pass
    
    @abstractmethod
    def generate_single_element(self, user_request: str) -> Dict[str, Any]:
        """Generate a single element for this diagram type"""
        pass
    
    @abstractmethod
    def generate_complete_system(self, user_request: str) -> Dict[str, Any]:
        """Generate a complete system/diagram with multiple elements"""
        pass
    
    @abstractmethod
    def generate_fallback_element(self, request: str) -> Dict[str, Any]:
        """Generate a fallback element when AI generation fails"""
        pass
    
    def generate_modification(self, user_request: str, current_model: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Generate modifications for existing diagram elements.
        Override this method in subclasses to provide diagram-specific modification logic.
        Default implementation returns a basic modification structure.
        """
        return {
            "action": "modify_model",
            "modification": {
                "action": "modify_element",
                "target": {"elementName": "unknown"},
                "changes": {"name": "modified"}
            },
            "diagramType": self.get_diagram_type(),
            "message": "Modification not implemented for this diagram type."
        }
    
    def clean_json_response(self, response: str) -> str:
        """Clean JSON response from LLM (remove markdown formatting)"""
        json_text = response.strip()
        if json_text.startswith('```json'):
            json_text = json_text[7:]
        if json_text.endswith('```'):
            json_text = json_text[:-3]
        return json_text.strip()
    
    def generate_uuid(self) -> str:
        """Generate a unique UUID"""
        return str(uuid.uuid4())
    
    def parse_json_safely(self, json_text: str) -> Optional[Dict[str, Any]]:
        """Parse JSON with error handling"""
        try:
            return json.loads(json_text)
        except json.JSONDecodeError:
            return None
    
    def extract_name_from_request(self, request: str, default: str = "New") -> str:
        """Extract a name from user request"""
        words = request.split()
        for i, word in enumerate(words):
            if word.lower() in ['create', 'add', 'make', 'new', 'generate']:
                if i + 1 < len(words):
                    next_word = words[i + 1]
                    if next_word.lower() not in ['a', 'an', 'the', 'class', 'object', 'state', 'agent']:
                        if i + 2 < len(words):
                            return words[i + 2].capitalize()
                        return next_word.capitalize()
        return default
