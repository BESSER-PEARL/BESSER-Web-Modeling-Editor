/**
 * User Profile Diagram Converter
 * Converts simplified user-profile specs to Apollon UserDiagram format.
 *
 * A user-profile model is a set of class-instance boxes (UserModelName) drawn
 * from a fixed metamodel. Each attribute row (UserModelAttribute) is a matching
 * criterion carrying a comparison operator, rendered like "age >= 18".
 */

import { DiagramConverter, PositionGenerator, generateUniqueId } from './base';

const OPERATORS = ['<', '<=', '==', '>=', '>'];

const normalizeOperator = (raw: any): string => {
  if (typeof raw !== 'string') return '==';
  const op = raw.trim();
  if (op === '=') return '==';
  return OPERATORS.includes(op) ? op : '==';
};

// Equality displays as a single '=' to match the editor's own rendering
// (UMLUserModelAttribute extracts the operator back from the name).
const attrDisplayName = (attr: any): string => {
  const op = normalizeOperator(attr.operator);
  const symbol = op === '==' ? '=' : op;
  const value = attr.value ?? '';
  return `${attr.name} ${symbol} ${value}`;
};

export class UserDiagramConverter implements DiagramConverter {
  private positionGenerator = new PositionGenerator();

  getDiagramType() {
    return 'UserDiagram' as const;
  }

  convertSingleElement(spec: any, position?: { x: number; y: number }) {
    const pos = position || this.positionGenerator.getNextPosition();
    const nameId = generateUniqueId('user');

    const attrCount = spec.attributes?.length || 0;
    const totalHeight = 50 + attrCount * 30;

    const profileName = spec.profileName || spec.className || 'profile';

    const nameElement: any = {
      type: 'UserModelName',
      id: nameId,
      name: profileName,
      owner: null,
      bounds: { x: pos.x, y: pos.y, width: 200, height: totalHeight },
      attributes: [] as string[],
      methods: [],
    };
    if (spec.className) nameElement.className = spec.className;
    if (spec.classId) nameElement.classId = spec.classId;

    const children: Record<string, any> = {};

    // Optional icon child carrying the metamodel class SVG.
    if (spec.icon && typeof spec.icon === 'string' && spec.icon.trim() !== '') {
      const iconId = generateUniqueId('usericon');
      children[iconId] = {
        type: 'UserModelIcon',
        id: iconId,
        name: '',
        owner: nameId,
        bounds: { x: pos.x, y: pos.y, width: 50, height: 50 },
        icon: spec.icon,
      };
      nameElement.icon = iconId;
    }

    // Attribute (criteria) children.
    let currentY = pos.y + 40;
    (spec.attributes || []).forEach((attr: any) => {
      const attrId = generateUniqueId('userattr');
      nameElement.attributes.push(attrId);
      const attrElement: any = {
        id: attrId,
        name: attrDisplayName(attr),
        type: 'UserModelAttribute',
        owner: nameId,
        bounds: { x: pos.x + 1, y: currentY, width: 198, height: 30 },
        attributeOperator: normalizeOperator(attr.operator),
      };
      if (attr.attributeId) attrElement.attributeId = attr.attributeId;
      children[attrId] = attrElement;
      currentY += 30;
    });

    return { name: nameElement, children };
  }

  convertCompleteSystem(systemSpec: any) {
    this.positionGenerator.reset();
    const allElements: Record<string, any> = {};
    const allRelationships: Record<string, any> = {};
    const profileIdMap: Record<string, string> = {};

    (systemSpec.profiles || []).forEach((profileSpec: any) => {
      const position = profileSpec.position || this.positionGenerator.getNextPosition();
      const built = this.convertSingleElement(profileSpec, position);
      const key = profileSpec.profileName || profileSpec.className;
      if (key) profileIdMap[key] = built.name.id;
      allElements[built.name.id] = built.name;
      Object.assign(allElements, built.children);
    });

    (systemSpec.links || []).forEach((link: any) => {
      const sourceId = profileIdMap[link.source];
      const targetId = profileIdMap[link.target];
      if (sourceId && targetId) {
        const linkId = generateUniqueId('link');
        allRelationships[linkId] = {
          id: linkId,
          // The editor's UserModelName supports ObjectLink (and the fixtures
          // use it), so emit ObjectLink for compatibility.
          type: 'ObjectLink',
          source: {
            element: sourceId,
            direction: link.sourceDirection || 'Right',
            bounds: { x: 0, y: 0, width: 0, height: 0 },
          },
          target: {
            element: targetId,
            direction: link.targetDirection || 'Left',
            bounds: { x: 0, y: 0, width: 0, height: 0 },
          },
          bounds: { x: 0, y: 0, width: 0, height: 0 },
          name: link.relationshipType || '',
          path: [{ x: 100, y: 10 }, { x: 0, y: 10 }],
          isManuallyLayouted: false,
        };
      }
    });

    return {
      version: '3.0.0',
      type: 'UserDiagram',
      size: { width: 1400, height: 740 },
      elements: allElements,
      relationships: allRelationships,
      interactive: { elements: {}, relationships: {} },
      assessments: {},
    };
  }
}
