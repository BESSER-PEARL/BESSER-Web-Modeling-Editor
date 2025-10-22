"""
Class Diagram Handler
Handles generation of UML Class Diagrams
"""

from typing import Dict, Any

from .base_handler import BaseDiagramHandler


class ClassDiagramHandler(BaseDiagramHandler):
    """Handler for Class Diagram generation"""

    def get_diagram_type(self) -> str:
        return "ClassDiagram"

    def get_system_prompt(self) -> str:
        return """You are a UML modeling expert. Create a focused class specification based on the user's request.

Return ONLY a JSON object with this structure:
{
  "className": "ExactClassName",
  "attributes": [
    {"name": "attributeName", "type": "String", "visibility": "public"},
    {"name": "anotherAttr", "type": "int", "visibility": "private"}
  ],
  "methods": [
    {"name": "methodName", "returnType": "void", "visibility": "public", "parameters": [
      {"name": "paramName", "type": "String"}
    ]}
  ]
}

IMPORTANT RULES:
1. Create AS MANY attributes as needed (no fixed limits - can be 1, 3, 8, or more) based on what makes sense for the class
2. Generate methods ONLY when explicitly requested or when they're essential to the class purpose
3. If the user just says "create X class", generate relevant attributes and minimal/no methods
4. Use proper programming conventions (camelCase for attributes/methods, PascalCase for classes)
5. visibility options: "public", "private", "protected", or "package" (default to "private" for attributes, "public" for methods)
6. Common types: String, int, boolean, double, Date, List, Map, or custom class names
7. Method parameters are optional - empty array [] if no parameters needed
8. Keep it focused but complete - don't artificially limit essential properties
9. Return ONLY the JSON, no explanations or markdown

Examples:
- "create User class" -> attributes: id, username, email, password (4 attributes, 0-1 method)
- "create Product with inventory" -> attributes: id, name, price, stockQuantity, supplier (5+ attributes)
- "create BankAccount with deposit method" -> attributes: accountNumber, balance, owner + methods: deposit, withdraw

Return ONLY the JSON, no explanations."""

    def generate_single_element(self, user_request: str) -> Dict[str, Any]:
        """Generate a single class element"""

        system_prompt = self.get_system_prompt()
        user_prompt = f"Create a class specification for: {user_request}"

        try:
            response = self.llm.predict(f"{system_prompt}\n\nUser Request: {user_prompt}")

            if not response:
                raise ValueError("GPT returned empty response")

            json_text = self.clean_json_response(response)
            simple_spec = self.parse_json_safely(json_text)

            if not simple_spec:
                raise ValueError("Failed to parse JSON response")

            message = (
                f"Created class '{simple_spec['className']}' with "
                f"{len(simple_spec.get('attributes', []))} attribute(s) and "
                f"{len(simple_spec.get('methods', []))} method(s)."
            )

            return {
                "action": "inject_element",
                "element": simple_spec,
                "diagramType": self.get_diagram_type(),
                "message": message
            }

        except Exception:
            return self.generate_fallback_element(user_request)

    def generate_complete_system(self, user_request: str) -> Dict[str, Any]:
        """Generate a complete class diagram with multiple classes"""

        system_prompt = """You are a UML modeling expert. Create a COMPLETE, well-structured class diagram system.

Return ONLY a JSON object with this structure:
{
  "systemName": "SystemName",
  "classes": [
    {
      "className": "ClassName",
      "attributes": [
        {"name": "attr", "type": "String", "visibility": "private"}
      ],
      "methods": [
        {"name": "method", "returnType": "void", "visibility": "public", "parameters": [
          {"name": "param", "type": "String"}
        ]}
      ]
    }
  ],
  "relationships": [
    {
      "type": "Association",
      "source": "ClassName1",
      "target": "ClassName2",
      "sourceMultiplicity": "1",
      "targetMultiplicity": "*",
      "name": "relationshipName"
    }
  ]
}

IMPORTANT RULES:
1. Create AS MANY classes as needed for a complete system (no fixed limits - can be 2, 5, 10, or more depending on complexity)
2. Each class should have AS MANY attributes as needed (can be 1-10+ attributes) - don't artificially limit essential properties
3. Methods: Include essential methods (getters/setters, business logic) when they add value - can be 0-10+ per class
4. Relationships are CRITICAL - always include meaningful connections between classes:
   - "Association" - general relationship between classes (most common)
   - "Inheritance" (also called "Generalization") - parent-child "is-a" relationship (use sparingly, only when true inheritance)
   - "Composition" - strong "has-a" relationship (part cannot exist without whole)
   - "Aggregation" - weak "has-a" relationship (part can exist independently)
   - "Realization" - interface implementation
5. Relationship properties:
   - "name": Optional descriptive name for the relationship
   - "sourceMultiplicity": "1", "0..1", "*", "1..*" etc. (how many source instances)
   - "targetMultiplicity": "1", "0..1", "*", "1..*" etc. (how many target instances)
6. Use proper naming: PascalCase for classes, camelCase for attributes/methods/parameters
7. visibility: "public", "private", "protected", or "package" (default: private for attributes, public for methods)
8. Common types: String, int, boolean, double, Date, List, Map, or custom class names
9. For complex systems, create a coherent architecture with proper separation of concerns
10. Return ONLY the JSON, no explanations or markdown

Examples:
- E-commerce system: User, Product, Order, Payment, ShoppingCart with appropriate associations
- Library system: Book, Author, Member, Loan with inheritance (DigitalBook extends Book) and compositions
- Banking system: Account, Customer, Transaction, Branch with aggregations and multiplicities

Return ONLY the JSON, no explanations."""

        try:
            response = self.llm.predict(f"{system_prompt}\n\nUser Request: {user_request}")

            if not response:
                raise ValueError("GPT returned empty response")

            json_text = self.clean_json_response(response)
            system_spec = self.parse_json_safely(json_text)

            if not system_spec:
                raise ValueError("Failed to parse JSON response")

            message = (
                f"Created {system_spec.get('systemName', 'your')} system with "
                f"{len(system_spec.get('classes', []))} class(es) and "
                f"{len(system_spec.get('relationships', []))} relationship(s)."
            )

            return {
                "action": "inject_complete_system",
                "systemSpec": system_spec,
                "diagramType": self.get_diagram_type(),
                "message": message
            }

        except Exception:
            return self.generate_fallback_system()

    def generate_fallback_element(self, request: str) -> Dict[str, Any]:
        """Generate a fallback class when AI generation fails"""
        class_name = self.extract_name_from_request(request, "NewClass")

        fallback_spec = {
            "className": class_name,
            "attributes": [
                {"name": "id", "type": "String", "visibility": "public"},
                {"name": "name", "type": "String", "visibility": "private"}
            ],
            "methods": []
        }

        return {
            "action": "inject_element",
            "element": fallback_spec,
            "diagramType": self.get_diagram_type(),
            "message": f"Created basic {class_name} class (fallback)."
        }

    def generate_fallback_system(self) -> Dict[str, Any]:
        """Generate a fallback system"""
        return {
            "action": "inject_complete_system",
            "systemSpec": {
                "systemName": "BasicSystem",
                "classes": [
                    {
                        "className": "Entity",
                        "attributes": [
                            {"name": "id", "type": "String", "visibility": "public"}
                        ],
                        "methods": []
                    }
                ],
                "relationships": []
            },
            "diagramType": self.get_diagram_type(),
            "message": "Created basic class system (fallback)."
        }
    
    # ------------------------------------------------------------------
    # Modification Support (Existing - Updated for new architecture)
    # ------------------------------------------------------------------
    
    def generate_modification(self, user_request: str, current_model: Dict[str, Any] = None) -> Dict[str, Any]:
        """Generate modifications for existing class diagram elements"""
        
        system_prompt = """You are a UML modeling expert. The user wants to modify an existing class diagram.

Return ONLY a JSON object with one of these structures:

MODIFY CLASS (rename or change properties)
{
  "action": "modify_model",
  "modification": {
    "action": "modify_class",
    "target": {
      "className": "CurrentClassName"
    },
    "changes": {
      "name": "NewClassName"
    }
  }
}

ADD ATTRIBUTE (to existing class)
{
  "action": "modify_model",
  "modification": {
    "action": "add_attribute",
    "target": {
      "className": "ClassName"
    },
    "changes": {
      "name": "newAttribute",
      "type": "String",
      "visibility": "private"
    }
  }
}

MODIFY ATTRIBUTE (change existing attribute)
{
  "action": "modify_model",
  "modification": {
    "action": "modify_attribute",
    "target": {
      "className": "ClassName",
      "attributeName": "oldAttributeName"
    },
    "changes": {
      "name": "newAttributeName",
      "type": "int",
      "visibility": "private"
    }
  }
}

ADD METHOD (to existing class)
{
  "action": "modify_model",
  "modification": {
    "action": "add_method",
    "target": {
      "className": "ClassName"
    },
    "changes": {
      "name": "newMethod",
      "returnType": "void",
      "visibility": "public",
      "parameters": [{"name": "param", "type": "String"}]
    }
  }
}

MODIFY METHOD (change existing method)
{
  "action": "modify_model",
  "modification": {
    "action": "modify_method",
    "target": {
      "className": "ClassName",
      "methodName": "oldMethodName"
    },
    "changes": {
      "name": "newMethodName",
      "returnType": "boolean",
      "visibility": "public",
      "parameters": [{"name": "id", "type": "int"}]
    }
  }
}

ADD RELATIONSHIP (connect two classes)
{
  "action": "modify_model",
  "modification": {
    "action": "add_relationship",
    "target": {
      "sourceClass": "SourceClass",
      "targetClass": "TargetClass"
    },
    "changes": {
      "relationshipType": "Association",
      "sourceMultiplicity": "1",
      "targetMultiplicity": "*",
      "name": "relationshipName"
    }
  }
}

REMOVE ELEMENT (delete class, attribute, method, or relationship)
{
  "action": "modify_model",
  "modification": {
    "action": "remove_element",
    "target": {
      "className": "ClassToRemove"
    }
  }
}

OR for removing attribute:
{
  "action": "modify_model",
  "modification": {
    "action": "remove_element",
    "target": {
      "className": "ClassName",
      "attributeName": "attributeToRemove"
    }
  }
}

IMPORTANT RULES:
1. Actions available: "modify_class", "add_attribute", "modify_attribute", "add_method", "modify_method", "add_relationship", "remove_element"
2. Always specify exact target names that exist in the current model
3. visibility options: "public", "private", "protected", "package"
4. Relationship types (case-sensitive): "Association", "Inheritance" (also called Generalization), "Composition", "Aggregation", "Realization"
5. Multiplicities: "1", "0..1", "*", "1..*", "0..*", or specific numbers like "5"
6. When adding methods, include empty parameters array [] if no parameters needed
7. When modifying, only include the fields that should change in "changes" object
8. For remove_element, only specify the target - no "changes" needed
9. Return ONLY the JSON object – no explanations or markdown

Examples:
- "rename User class to Customer" -> modify_class with name change
- "add email attribute to User" -> add_attribute with type String, visibility private
- "make password private" -> modify_attribute changing visibility
- "add login method to User" -> add_method with appropriate returnType and parameters
- "connect Order to Customer" -> add_relationship with Association type
- "add generalization between Member and Author" -> add_relationship with Inheritance type (Member inherits from Author)
- "create inheritance from Student to Person" -> add_relationship with Inheritance type (Student is child, Person is parent)
- "delete the temp attribute" -> remove_element with attributeName

Return ONLY the JSON object – no explanations"""

        # Build context from current model
        context_info = []
        if current_model and isinstance(current_model, dict):
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
            context_block = "\n\nCurrent class diagram:\n- " + "\n- ".join(context_info[:8])
        
        user_prompt = f"Modify the class diagram: {user_request}{context_block}"
        
        try:
            response = self.llm.predict(f"{system_prompt}\n\nUser Request: {user_prompt}")
            
            if not response:
                raise ValueError("GPT returned empty response")
            
            json_text = self.clean_json_response(response)
            modification_spec = self.parse_json_safely(json_text)
            
            if not modification_spec or not modification_spec.get('modification'):
                raise ValueError("Failed to parse modification JSON")
            
            # Ensure proper structure
            modification_spec.setdefault('action', 'modify_model')
            modification_spec.setdefault('diagramType', self.get_diagram_type())
            
            # Generate message if not provided
            if 'message' not in modification_spec:
                mod_action = modification_spec['modification'].get('action', 'modification')
                target = modification_spec['modification'].get('target', {})
                target_name = target.get('className') or target.get('attributeName') or target.get('methodName') or 'element'
                modification_spec['message'] = f"Applied {mod_action} to {target_name}"
            
            return modification_spec
            
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Error generating class diagram modification: {e}")
            return self.generate_fallback_modification(user_request)
    
    def generate_fallback_modification(self, request: str) -> Dict[str, Any]:
        """Generate a fallback modification when AI generation fails"""
        return {
            "action": "modify_model",
            "modification": {
                "action": "modify_class",
                "target": {"className": "Unknown"},
                "changes": {"name": "ModifiedClass"}
            },
            "diagramType": self.get_diagram_type(),
            "message": "Failed to generate modification automatically (fallback used)."
        }
