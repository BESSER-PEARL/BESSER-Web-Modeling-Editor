import * as Apollon from '../src/main';
import { UMLAssociation } from '../src/main/typings';

interface ValidationResult {
    isValid: boolean;
    message: string;
}

export function validateAssociationEnds(editor: Apollon.ApollonEditor): ValidationResult {
    if (!editor || !editor.model) {
        return {
            isValid: false,
            message: "❌ Editor not initialized"
        };
    }

    const relationships = editor.model.relationships;
    const invalidAssociations: string[] = [];
    const elements = editor.model.elements;

    for (const [id, rel] of Object.entries(relationships)) {
        if (rel.type === 'ClassBidirectional') {
            const association = rel as UMLAssociation;
            const sourceClass = elements[association.source.element]?.name || 'Unknown';
            const targetClass = elements[association.target.element]?.name || 'Unknown';
            
            // Check source end
            if (!association.source.role || association.source.role.trim() === '') {
                invalidAssociations.push(
                    `Association ${association.name || 'Unnamed'} (${sourceClass} → ${targetClass}): missing role name from ${sourceClass}`
                );
            }
            // Check target end
            if (!association.target.role || association.target.role.trim() === '') {
                invalidAssociations.push(
                    `Association ${association.name || 'Unnamed'} (${sourceClass} → ${targetClass}): missing role name from ${targetClass}`
                );
            }
        }
    }

    if (invalidAssociations.length > 0) {
        return {
            isValid: false,
            message: "❌ Missing association role names:\n" + invalidAssociations.join('\n')
        };
    }

    return {
        isValid: true,
        message: "✅ All associations have valid role names"
    };
}

export function validateClassNames(editor: Apollon.ApollonEditor): ValidationResult {
    if (!editor || !editor.model) {
        return {
            isValid: false,
            message: "❌ Editor not initialized"
        };
    }

    const elements = editor.model.elements;
    const classNames = new Map<string, string[]>();  // Map of name to array of IDs

    // Collect all classes and their names
    for (const [id, element] of Object.entries(elements)) {
        if (element.type === 'Class') {
            const name = element.name.toLowerCase();  // Case-insensitive comparison
            if (!classNames.has(name)) {
                classNames.set(name, []);
            }
            classNames.get(name)?.push(id);
        }
    }

    // Check for duplicates
    const duplicates = Array.from(classNames.entries())
        .filter(([_, ids]) => ids.length > 1)
        .map(([name, ids]) => {
            const positions = ids.map(id => {
                const element = elements[id];
                return `(${Math.round(element.bounds.x)}, ${Math.round(element.bounds.y)})`;
            });
            return `Class "${name}" appears ${ids.length} times at positions: ${positions.join(', ')}`;
        });

    if (duplicates.length > 0) {
        return {
            isValid: false,
            message: "❌ Duplicate class names found:\n" + duplicates.join('\n')
        };
    }

    return {
        isValid: true,
        message: "✅ All class names are unique"
    };
}

export function showValidationMessage(message: string, isError: boolean = false) {
    const popup = document.getElementById('messagePopup');
    const messageText = document.getElementById('messageText');
    if (popup && messageText) {
        messageText.innerHTML = message.replace(/\n/g, '<br>');
        popup.style.display = 'flex';
    }
}

export function validateBeforeGeneration(editor: Apollon.ApollonEditor): boolean {
    if (!editor || !editor.model) {
        showValidationMessage(
            "⚠️ Editor is not properly initialized or doesn't have a model yet!",
            true
        );
        return false;
    }

    // Check if model is empty
    if (Object.keys(editor.model.elements).length === 0) {
        showValidationMessage(
            "⚠️ The model is empty. Please add some classes before generating code.",
            true
        );
        return false;
    }

    const classNameResult = validateClassNames(editor);
    if (!classNameResult.isValid) {
        showValidationMessage(
            "⚠️ Some class names are not unique. Code generation will continue, but certain names have been modified to avoid duplicates.\n\n" +
            classNameResult.message +
            "\n\nPlease review and update the class names if necessary.",
            true
        );
        return true;
    }

    const associationResult = validateAssociationEnds(editor);
    if (!associationResult.isValid) {
        showValidationMessage(
            "⚠️ Cannot generate code:\n\n" + associationResult.message + 
            "\n\nPlease add missing role names to all associations.",
            true
        );
        return false;
    }
    
    return true;
}
