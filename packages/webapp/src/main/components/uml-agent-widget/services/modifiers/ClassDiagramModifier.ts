/**
 * Class Diagram Modifier
 * Handles all modification operations for Class Diagrams
 */

import { DiagramModifier, ModelModification, ModifierHelpers } from './base';
import { BESSERModel } from '../UMLModelingService';

export class ClassDiagramModifier implements DiagramModifier {
  getDiagramType() {
    return 'ClassDiagram' as const;
  }

  canHandle(action: string): boolean {
    return [
      'modify_class',
      'modify_attribute',
      'modify_method',
      'add_relationship',
      'remove_element'
    ].includes(action);
  }

  applyModification(model: BESSERModel, modification: ModelModification): BESSERModel {
    const updatedModel = ModifierHelpers.cloneModel(model);

    switch (modification.action) {
      case 'modify_class':
        return this.modifyClass(updatedModel, modification);
      case 'modify_attribute':
        return this.modifyAttribute(updatedModel, modification);
      case 'modify_method':
        return this.modifyMethod(updatedModel, modification);
      case 'add_relationship':
        return this.addRelationship(updatedModel, modification);
      case 'remove_element':
        return this.removeElement(updatedModel, modification);
      default:
        throw new Error(`Unsupported action for ClassDiagram: ${modification.action}`);
    }
  }

  private modifyClass(model: BESSERModel, modification: ModelModification): BESSERModel {
    const { classId, className } = modification.target;
    const targetId = classId || this.findClassIdByName(model, className!);

    if (targetId && model.elements[targetId]) {
      if (modification.changes.name) {
        model.elements[targetId].name = modification.changes.name;
      }
    }

    return model;
  }

  private modifyAttribute(model: BESSERModel, modification: ModelModification): BESSERModel {
    const { attributeId, attributeName, className } = modification.target;
    let targetId = attributeId;

    if (!targetId && className) {
      const candidates = [
        attributeName,
        modification.changes.previousName,
        modification.target.attributeName,
        modification.changes.name
      ].filter((value): value is string => Boolean(value));

      for (const candidate of candidates) {
        const foundId = this.findAttributeIdByClassAndName(model, className, candidate);
        if (foundId) {
          targetId = foundId;
          break;
        }
      }
    }

    if (!targetId && className) {
      const classId = this.findClassIdByName(model, className);
      if (classId) {
        const classElement = model.elements[classId];
        const normalizedTarget = this.normalizeAttributeName(attributeName || modification.changes.name || '');
        const fallbackId = classElement?.attributes?.find((attrId: string) => {
          const attr = model.elements[attrId];
          const normalized = attr?.name ? this.normalizeAttributeName(attr.name) : '';
          return normalizedTarget && normalized.toLowerCase() === normalizedTarget.toLowerCase();
        });
        if (fallbackId) {
          targetId = fallbackId;
        }
      }
    }

    if (targetId && model.elements[targetId]) {
      const element = model.elements[targetId];
      const parsed = this.parseAttributeLabel(element.name || '');
      const visibilitySymbol =
        this.visibilityToSymbol(modification.changes.visibility) || parsed.visibilitySymbol || '+';
      const name = modification.changes.name || parsed.name || this.normalizeAttributeName(element.name || '');
      const type = modification.changes.type || parsed.type || 'String';

      element.name = `${visibilitySymbol} ${name}: ${type}`;
    }

    return model;
  }

  private modifyMethod(model: BESSERModel, modification: ModelModification): BESSERModel {
    const { methodId, methodName, className } = modification.target;
    let targetId = methodId;

    if (!targetId && className) {
      const candidates = [
        methodName,
        modification.changes.previousName,
        modification.target.methodName,
        modification.changes.name
      ].filter((value): value is string => Boolean(value));

      for (const candidate of candidates) {
        const foundId = this.findMethodIdByClassAndName(model, className, candidate);
        if (foundId) {
          targetId = foundId;
          break;
        }
      }
    }

    if (!targetId && className) {
      const classId = this.findClassIdByName(model, className);
      if (classId) {
        const classElement = model.elements[classId];
        const normalizedTarget = this.normalizeMethodName(methodName || modification.changes.name || '');
        const fallbackId = classElement?.methods?.find((methodRef: string) => {
          const methodElement = model.elements[methodRef];
          const normalized = methodElement?.name ? this.normalizeMethodName(methodElement.name) : '';
          return normalizedTarget && normalized.toLowerCase() === normalizedTarget.toLowerCase();
        });
        if (fallbackId) {
          targetId = fallbackId;
        }
      }
    }

    if (targetId && model.elements[targetId]) {
      const element = model.elements[targetId];
      const parsed = this.parseMethodLabel(element.name || '');
      const visibilitySymbol =
        this.visibilityToSymbol(modification.changes.visibility) || parsed.visibilitySymbol || '+';
      const name = modification.changes.name || parsed.name || this.normalizeMethodName(element.name || '');
      const returnType = modification.changes.returnType || parsed.returnType || 'void';
      const parameters =
        modification.changes.parameters?.map(p => `${p.name}: ${p.type}`) || parsed.parameters;
      const paramStr = parameters.join(', ');

      element.name = `${visibilitySymbol} ${name}(${paramStr}): ${returnType}`;
    }

    return model;
  }

  private addRelationship(model: BESSERModel, modification: ModelModification): BESSERModel {
    if (!model.relationships) {
      model.relationships = {};
    }

    const changes = modification.changes;
    const target = modification.target;

    const sourceClassName = changes.sourceClass || target.sourceClass || target.className;
    const targetClassName = changes.targetClass || target.targetClass;

    if (!sourceClassName || !targetClassName) {
      throw new Error('Relationship modifications require both source and target class names.');
    }

    const sourceClassId = this.findClassIdByName(model, sourceClassName);
    const targetClassId = this.findClassIdByName(model, targetClassName);

    if (!sourceClassId || !targetClassId) {
      throw new Error('Could not locate source or target class for relationship.');
    }

    const relationshipId = ModifierHelpers.generateUniqueId('rel');
    // Accept both 'relationshipType' and 'type' for compatibility with backend
    const relType = changes.relationshipType || (changes as any).type || 'Association';
    const relationshipType = this.mapRelationshipType(relType);
    const sourceMultiplicity = changes.sourceMultiplicity || '1';
    const targetMultiplicity = changes.targetMultiplicity || '*';
    const relationshipName = changes.name || changes.roleName || target.relationshipName || '';

    model.relationships[relationshipId] = {
      id: relationshipId,
      type: relationshipType,
      source: {
        element: sourceClassId,
        direction: 'Left',
        multiplicity: sourceMultiplicity,
        role: '',
        bounds: { x: 0, y: 0, width: 0, height: 0 }
      },
      target: {
        element: targetClassId,
        direction: 'Right',
        multiplicity: targetMultiplicity,
        role: relationshipName,
        bounds: { x: 0, y: 0, width: 0, height: 0 }
      },
      bounds: { x: 0, y: 0, width: 0, height: 0 },
      name: relationshipName,
      path: [
        { x: 100, y: 10 },
        { x: 0, y: 10 }
      ],
      isManuallyLayouted: false
    };

    return model;
  }

  private removeElement(model: BESSERModel, modification: ModelModification): BESSERModel {
    const { classId, className, attributeId, attributeName, methodId, methodName, relationshipId, relationshipName } =
      modification.target;

    // Remove relationship
    if (relationshipId || relationshipName) {
      if (relationshipId && model.relationships?.[relationshipId]) {
        delete model.relationships[relationshipId];
      } else if (relationshipName && model.relationships) {
        for (const [relId, rel] of Object.entries(model.relationships)) {
          if (rel.name === relationshipName) {
            delete model.relationships[relId];
            break;
          }
        }
      }
      return model;
    }

    // Remove attribute
    if ((attributeId || attributeName) && className) {
      const classElementId = classId || this.findClassIdByName(model, className);
      if (classElementId) {
        const classElement = model.elements[classElementId];
        if (classElement?.attributes) {
          const resolvedAttrId =
            attributeId ||
            this.findAttributeIdByClassAndName(model, className, attributeName || modification.changes.name);
          if (resolvedAttrId) {
            classElement.attributes = classElement.attributes.filter((attr: string) => attr !== resolvedAttrId);
            delete model.elements[resolvedAttrId];
          }
        }
      }
      return model;
    }

    // Remove method
    if ((methodId || methodName) && className) {
      const classElementId = classId || this.findClassIdByName(model, className);
      if (classElementId) {
        const classElement = model.elements[classElementId];
        if (classElement?.methods) {
          const resolvedMethodId =
            methodId ||
            this.findMethodIdByClassAndName(model, className, methodName || modification.changes.name);
          if (resolvedMethodId) {
            classElement.methods = classElement.methods.filter((method: string) => method !== resolvedMethodId);
            delete model.elements[resolvedMethodId];
          }
        }
      }
      return model;
    }

    // Remove entire class
    const targetClassId = classId || this.findClassIdByName(model, className!);
    if (targetClassId) {
      return ModifierHelpers.removeElementWithChildren(model, targetClassId);
    }

    return model;
  }

  // Helper methods
  private findClassIdByName(model: BESSERModel, className: string): string | null {
    return ModifierHelpers.findElementByName(model, className, 'Class');
  }

  private findAttributeIdByClassAndName(model: BESSERModel, className: string, attributeName?: string): string | null {
    if (!attributeName) return null;
    const classId = this.findClassIdByName(model, className);
    if (!classId) return null;

    const classElement = model.elements[classId];
    if (!classElement?.attributes) return null;

    const normalizedTarget = this.normalizeAttributeName(attributeName);

    for (const attrId of classElement.attributes) {
      const attr = model.elements[attrId];
      if (!attr?.name) continue;
      const normalizedAttr = this.normalizeAttributeName(attr.name);
      if (normalizedAttr.toLowerCase() === normalizedTarget.toLowerCase()) {
        return attrId;
      }
      if (attr.name.toLowerCase().includes(attributeName.toLowerCase())) {
        return attrId;
      }
    }
    return null;
  }

  private findMethodIdByClassAndName(model: BESSERModel, className: string, methodName?: string): string | null {
    if (!methodName) return null;
    const classId = this.findClassIdByName(model, className);
    if (!classId) return null;

    const classElement = model.elements[classId];
    if (!classElement?.methods) return null;

    const normalizedTarget = this.normalizeMethodName(methodName);

    for (const methodId of classElement.methods) {
      const method = model.elements[methodId];
      if (!method?.name) continue;
      const normalizedMethod = this.normalizeMethodName(method.name);
      if (normalizedMethod.toLowerCase() === normalizedTarget.toLowerCase()) {
        return methodId;
      }
      if (method.name.toLowerCase().includes(methodName.toLowerCase())) {
        return methodId;
      }
    }
    return null;
  }

  private normalizeAttributeName(label: string): string {
    if (!label) return '';
    return label.replace(/^([+#-])\s*/, '').split(':')[0].trim();
  }

  private normalizeMethodName(label: string): string {
    if (!label) return '';
    return label.replace(/^([+#-])\s*/, '').split('(')[0].trim();
  }

  private parseAttributeLabel(label: string) {
    const trimmed = label || '';
    const visibilitySymbol = trimmed.trim().startsWith('+') ? '+' :
      trimmed.trim().startsWith('-') ? '-' : '#';
    const withoutVisibility = trimmed.replace(/^([+#-])\s*/, '');
    const [namePart, typePart] = withoutVisibility.split(':').map(part => part?.trim() || '');
    return {
      visibilitySymbol,
      name: namePart || '',
      type: typePart || ''
    };
  }

  private parseMethodLabel(label: string) {
    const trimmed = label || '';
    const visibilitySymbol = trimmed.trim().startsWith('+') ? '+' :
      trimmed.trim().startsWith('-') ? '-' : '#';
    const withoutVisibility = trimmed.replace(/^([+#-])\s*/, '');
    const [signature, returnTypePart] = withoutVisibility.split(':').map(part => part?.trim() || '');
    const [namePart, paramsPart] = signature.split('(');
    const params = paramsPart?.replace(')', '').trim() || '';

    const parameterList = params
      ? params.split(',').map(param => param.trim()).filter(Boolean)
      : [];

    return {
      visibilitySymbol,
      name: namePart?.trim() || '',
      returnType: returnTypePart || '',
      parameters: parameterList
    };
  }

  private visibilityToSymbol(visibility?: 'public' | 'private' | 'protected'): string {
    switch (visibility) {
      case 'public': return '+';
      case 'private': return '-';
      case 'protected': return '#';
      default: return '';
    }
  }

  private mapRelationshipType(type: string): string {
    switch ((type || '').toLowerCase()) {
      case 'inheritance': 
      case 'generalization': return 'ClassInheritance';
      case 'composition': return 'ClassComposition';
      case 'aggregation': return 'ClassAggregation';
      case 'dependency': return 'ClassDependency';
      case 'unidirectional': return 'ClassUnidirectional';
      default: return 'ClassBidirectional';
    }
  }
}
