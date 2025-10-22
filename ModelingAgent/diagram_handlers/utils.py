"""
Utility functions for diagram handling
"""

import json
from typing import Optional


def extract_diagram_type_from_message(message: str) -> Optional[str]:
    """Extract diagram type from user message if it's a JSON payload or has prefix"""
    # Check for [DIAGRAM_TYPE:XXX] prefix
    import re
    prefix_match = re.match(r'^\[DIAGRAM_TYPE:(\w+)\]', message)
    if prefix_match:
        return prefix_match.group(1)
    
    # Try JSON payload
    try:
        if message.strip().startswith('{'):
            data = json.loads(message)
            if 'diagramType' in data:
                return data['diagramType']
    except:
        pass
    return None


def detect_diagram_type_from_keywords(message: str) -> Optional[str]:
    """Detect diagram type from keywords in message"""
    message_lower = message.lower()
    
    # State machine keywords
    if any(keyword in message_lower for keyword in ['state', 'transition', 'state machine']):
        return 'StateMachineDiagram'
    
    # Agent diagram keywords
    if any(keyword in message_lower for keyword in [
        'agent',
        'multi-agent',
        'message',
        'belief',
        'goal',
        'intent',
        'conversation',
        'dialog',
        'dialogue',
        'bot',
        'assistant',
        'flow'
    ]):
        return 'AgentDiagram'
    
    # Object diagram keywords
    if any(keyword in message_lower for keyword in ['object', 'instance', 'link']):
        return 'ObjectDiagram'
    
    # Class diagram (default)
    if any(keyword in message_lower for keyword in ['class', 'interface', 'inheritance', 'association']):
        return 'ClassDiagram'
    
    return None
