/**
 * User Profile Diagram Modifier
 * Handles modification operations for User Profile (UserDiagram) models.
 *
 * Mirrors ObjectDiagramModifier but operates on UserModelName / UserModelAttribute
 * elements and ObjectLink relationships. Attribute rows are matching criteria
 * carrying a comparison operator (rendered "age >= 18").
 *
 * Reuses the ObjectDiagram action vocabulary so no new ModelModification
 * action strings are required.
 */

import { DiagramModifier, ModelModification, ModifierHelpers } from './base';
import { BESSERModel } from '../UMLModelingService';

const OPERATORS = ['<', '<=', '==', '>=', '>'];

const normalizeOperator = (raw?: string): string => {
  if (typeof raw !== 'string') return '==';
  const op = raw.trim();
  if (op === '=') return '==';
  return OPERATORS.includes(op) ? op : '==';
};

const displaySymbol = (op: string): string => (op === '==' ? '=' : op);

export class UserDiagramModifier implements DiagramModifier {
  getDiagramType() {
    return 'UserDiagram' as const;
  }

  canHandle(action: string): boolean {
    return [
      'add_object',
      'modify_object',
      'modify_attribute_value',
      'add_link',
      'remove_element',
    ].includes(action);
  }

  applyModification(model: BESSERModel, modification: ModelModification): BESSERModel {
    const updatedModel = ModifierHelpers.cloneModel(model);

    switch (modification.action) {
      case 'add_object':
        return this.addProfile(updatedModel, modification);
      case 'modify_object':
        return this.modifyProfile(updatedModel, modification);
      case 'modify_attribute_value':
        return this.modifyAttributeValue(updatedModel, modification);
      case 'add_link':
        return this.addLink(updatedModel, modification);
      case 'remove_element':
        return this.removeElement(updatedModel, modification);
      default:
        throw new Error(`Unsupported action for UserDiagram: ${modification.action}`);
    }
  }

  /** Resolve a UserModelName element id by profileName (its `name`) or className. */
  private findProfile(model: BESSERModel, ...candidates: Array<string | undefined>): string | null {
    const names = candidates.filter((c): c is string => typeof c === 'string' && c.trim() !== '')
      .map((c) => c.trim().toLowerCase());
    if (names.length === 0) return null;
    for (const [id, el] of Object.entries(model.elements)) {
      if ((el as any).type !== 'UserModelName') continue;
      const nm = ((el as any).name || '').trim().toLowerCase();
      const cls = ((el as any).className || '').trim().toLowerCase();
      if (names.includes(nm) || names.includes(cls)) return id;
    }
    return null;
  }

  private addProfile(model: BESSERModel, modification: ModelModification): BESSERModel {
    const changes = modification.changes || {};
    const target = modification.target || {};
    const className = changes.className || '';
    const profileName = changes.profileName || target.profileName || className || 'profile';

    // Place below existing elements.
    let maxY = 0;
    for (const el of Object.values(model.elements)) {
      const bottom = ((el as any).bounds?.y || 0) + ((el as any).bounds?.height || 0);
      if (bottom > maxY) maxY = bottom;
    }
    const pos = { x: 100, y: maxY + 40 };

    const nameId = ModifierHelpers.generateUniqueId('user');
    const attrs = changes.attributes || [];
    const totalHeight = 50 + attrs.length * 30;

    const nameElement: any = {
      type: 'UserModelName',
      id: nameId,
      name: profileName,
      owner: null,
      bounds: { x: pos.x, y: pos.y, width: 200, height: totalHeight },
      attributes: [] as string[],
      methods: [],
    };
    if (className) nameElement.className = className;
    if (changes.classId) nameElement.classId = changes.classId;

    // Metamodel class icon child (User diagrams always render in icon view;
    // without it the box shows as a bare, empty box). Mirrors UserDiagramConverter.
    if (changes.icon && typeof changes.icon === 'string' && changes.icon.trim() !== '') {
      const iconId = ModifierHelpers.generateUniqueId('usericon');
      model.elements[iconId] = {
        type: 'UserModelIcon',
        id: iconId,
        name: '',
        owner: nameId,
        bounds: { x: pos.x, y: pos.y, width: 50, height: 50 },
        icon: changes.icon,
      };
      nameElement.icon = iconId;
    }

    let currentY = pos.y + 40;
    for (const attr of attrs) {
      const attrId = ModifierHelpers.generateUniqueId('userattr');
      nameElement.attributes.push(attrId);
      const op = normalizeOperator((attr as any).operator);
      const attrElement: any = {
        id: attrId,
        name: `${attr.name} ${displaySymbol(op)} ${attr.value || ''}`,
        type: 'UserModelAttribute',
        owner: nameId,
        bounds: { x: pos.x + 1, y: currentY, width: 198, height: 30 },
        attributeOperator: op,
      };
      if (attr.attributeId) attrElement.attributeId = attr.attributeId;
      model.elements[attrId] = attrElement;
      currentY += 30;
    }

    model.elements[nameId] = nameElement;
    return model;
  }

  private modifyProfile(model: BESSERModel, modification: ModelModification): BESSERModel {
    const target = modification.target || {};
    const id = this.findProfile(model, target.profileName, target.className, target.name);
    if (id && model.elements[id]) {
      const newName = modification.changes?.profileName || modification.changes?.name;
      if (newName) model.elements[id].name = newName;
    }
    return model;
  }

  private modifyAttributeValue(model: BESSERModel, modification: ModelModification): BESSERModel {
    const target = modification.target || {};
    const attributeName = target.attributeName;
    const newValue = modification.changes?.value;
    const newOperator = modification.changes?.operator;

    if (!attributeName || (newValue === undefined && newOperator === undefined)) {
      throw new Error(
        'modify_attribute_value requires target.attributeName and changes.value and/or changes.operator',
      );
    }

    const profileId = this.findProfile(model, target.profileName, target.className);
    if (!profileId) {
      throw new Error(`Profile '${target.profileName || target.className}' not found in the model.`);
    }

    for (const element of Object.values(model.elements)) {
      if (
        (element as any).type === 'UserModelAttribute' &&
        (element as any).owner === profileId
      ) {
        // The row name is "<attr> <op> <value>"; match on the attribute name token.
        const currentName = (element as any).name || '';
        const attrToken = currentName.split(/[<>=]/)[0].trim();
        if (attrToken === attributeName) {
          const op = normalizeOperator(newOperator || (element as any).attributeOperator);
          const value = newValue !== undefined ? newValue : currentName.replace(/^[^<>=]*[<>=]+\s*/, '').trim();
          (element as any).attributeOperator = op;
          (element as any).name = `${attributeName} ${displaySymbol(op)} ${value}`;
          return model;
        }
      }
    }

    throw new Error(`Attribute '${attributeName}' not found on the target profile.`);
  }

  private addLink(model: BESSERModel, modification: ModelModification): BESSERModel {
    if (!model.relationships) model.relationships = {};

    const changes = modification.changes || {};
    const target = modification.target || {};
    const sourceId = this.findProfile(model, changes.source, target.sourceProfile, target.profileName);
    const targetId = this.findProfile(model, changes.target, target.targetProfile);

    if (!sourceId || !targetId) {
      throw new Error('Could not locate source or target profile for link.');
    }

    const linkId = ModifierHelpers.generateUniqueId('link');
    model.relationships[linkId] = {
      id: linkId,
      type: 'ObjectLink',
      source: { element: sourceId, direction: 'Right' },
      target: { element: targetId, direction: 'Left' },
      name: changes.relationshipType || changes.name || '',
      bounds: { x: 0, y: 0, width: 0, height: 0 },
      path: [{ x: 100, y: 10 }, { x: 0, y: 10 }],
      isManuallyLayouted: false,
    };
    return model;
  }

  private removeElement(model: BESSERModel, modification: ModelModification): BESSERModel {
    const target = modification.target || {};
    const candidates: string[] = [];
    for (const key of ['profileName', 'name', 'className', 'objectName', 'targetName', 'elementName']) {
      const v = (target as any)[key];
      if (typeof v === 'string' && v.trim()) candidates.push(v.trim());
    }
    if (modification.changes) {
      for (const v of Object.values(modification.changes)) {
        if (typeof v === 'string' && v.trim()) candidates.push(v.trim());
      }
    }

    const id = this.findProfile(model, ...candidates);
    if (id) {
      return ModifierHelpers.removeElementWithChildren(model, id);
    }

    // Idempotent no-op when already removed.
    console.warn(
      `[UserDiagramModifier] removeElement: no profile matching ${JSON.stringify(candidates)} — ` +
        'treating as already removed (no-op).',
    );
    return model;
  }
}
