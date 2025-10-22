"""
Object Diagram Handler
Handles generation of UML Object Diagrams (instances of classes)
"""

from typing import Dict, Any
from .base_handler import BaseDiagramHandler


class ObjectDiagramHandler(BaseDiagramHandler):
    """Handler for Object Diagram generation"""
    
    def get_diagram_type(self) -> str:
        return "ObjectDiagram"
    
    def get_system_prompt(self) -> str:
        return """You are a UML modeling expert. Create an object instance specification based on the user's request.

Return ONLY a JSON object with this structure:
{
  "objectName": "objectName",
  "className": "ClassName",
  "attributes": [
    {"name": "attributeName", "value": "actualValue"}
  ]
}

IMPORTANT RULES:
1. Object name format: lowercase, e.g., "user1", "orderA"
2. ClassName should be capitalized
3. Include 2-5 attributes with ACTUAL VALUES (not types)
4. Values should be realistic examples
5. Keep it SIMPLE and focused
6. Return ONLY the JSON, no explanations

Examples:
- "create user object" -> {"objectName": "user1", "className": "User", "attributes": [{"name": "id", "value": "001"}, {"name": "name", "value": "John Doe"}]}
- "create order object" -> {"objectName": "order1", "className": "Order", "attributes": [{"name": "id", "value": "ORD-001"}, {"name": "total", "value": "99.99"}]}

Return ONLY the JSON, no explanations."""
    
    def generate_single_element(self, user_request: str) -> Dict[str, Any]:
        """Generate a single object instance"""
        
        system_prompt = self.get_system_prompt()
        user_prompt = f"Create an object specification for: {user_request}"
        
        try:
            response = self.llm.predict(f"{system_prompt}\n\nUser Request: {user_prompt}")
            
            if not response:
                raise Exception("GPT returned empty response")
            
            json_text = self.clean_json_response(response)
            object_spec = self.parse_json_safely(json_text)
            
            if not object_spec:
                raise Exception("Failed to parse JSON response")
            
            return {
                "action": "inject_element",
                "element": object_spec,
                "diagramType": "ObjectDiagram",
                "message": f"✅ Successfully created object '{object_spec['objectName']}' (instance of {object_spec['className']}) with {len(object_spec.get('attributes', []))} attributes!"
            }
            
        except Exception as e:
            return self.generate_fallback_element(user_request)
    
    def generate_complete_system(self, user_request: str) -> Dict[str, Any]:
        """Generate a complete object diagram with multiple object instances"""
        
        system_prompt = """You are a UML modeling expert. Create a COMPLETE object diagram with multiple related object instances.

Return ONLY a JSON object with this structure:
{
  "systemName": "SystemName",
  "objects": [
    {
      "objectName": "object1",
      "className": "ClassName",
      "attributes": [
        {"name": "attr", "value": "actualValue"}
      ]
    }
  ],
  "links": [
    {
      "source": "object1",
      "target": "object2",
      "relationshipType": "association"
    }
  ]
}

IMPORTANT RULES:
1. Create 3-6 related object instances
2. Each object should have 2-4 attributes with ACTUAL VALUES
3. Object names: lowercase (user1, order1, product2)
4. Include meaningful links between objects
5. Values should be realistic and coherent
6. Keep the scenario focused

Return ONLY the JSON, no explanations."""
        
        try:
            response = self.llm.predict(f"{system_prompt}\n\nUser Request: {user_request}")
            
            json_text = self.clean_json_response(response)
            system_spec = self.parse_json_safely(json_text)
            
            if not system_spec:
                raise Exception("Failed to parse JSON response")
            
            return {
                "action": "inject_complete_system",
                "systemSpec": system_spec,
                "diagramType": "ObjectDiagram",
                "message": f"✨ **Created {system_spec.get('systemName', 'object')} diagram!**\n\n🏗️ Generated:\n• {len(system_spec.get('objects', []))} object instances\n• {len(system_spec.get('links', []))} link(s)\n\n🎯 The complete object diagram has been automatically injected into your editor!"
            }
            
        except Exception as e:
            return self.generate_fallback_system()
    
    def generate_fallback_element(self, request: str) -> Dict[str, Any]:
        """Generate a fallback object when AI generation fails"""
        object_name = self.extract_name_from_request(request, "object1").lower()
        class_name = self.extract_name_from_request(request, "Entity")
        
        fallback_spec = {
            "objectName": object_name,
            "className": class_name,
            "attributes": [
                {"name": "id", "value": "001"},
                {"name": "name", "value": "Sample"}
            ]
        }
        
        return {
            "action": "inject_element",
            "element": fallback_spec,
            "diagramType": "ObjectDiagram",
            "message": f"⚠️ Created basic object '{object_name}' (AI generation failed)"
        }
    
    def generate_fallback_system(self) -> Dict[str, Any]:
        """Generate a fallback object diagram"""
        return {
            "action": "inject_complete_system",
            "systemSpec": {
                "systemName": "BasicObjectDiagram",
                "objects": [
                    {
                        "objectName": "instance1",
                        "className": "Entity",
                        "attributes": [
                            {"name": "id", "value": "001"}
                        ]
                    }
                ],
                "links": []
            },
            "diagramType": "ObjectDiagram",
            "message": "⚠️ Created basic object diagram (AI generation failed)"
        }
