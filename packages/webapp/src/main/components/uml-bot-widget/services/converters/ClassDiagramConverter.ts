/**
 * Class Diagram Converter
 * Converts simplified class specifications to Apollon format
 */

import { DiagramConverter, PositionGenerator, generateUniqueId } from './base';

export class ClassDiagramConverter implements DiagramConverter {
  private positionGenerator = new PositionGenerator();

  getDiagramType() {
    return 'ClassDiagram' as const;
  }

  convertSingleElement(spec: any, position?: { x: number; y: number }) {
    const pos = position || this.positionGenerator.getNextPosition();
    const classId = generateUniqueId('class');
    
    const baseHeight = 60;
    const attrHeight = (spec.attributes?.length || 0) * 25 + (spec.attributes?.length > 0 ? 10 : 0);
    const methodHeight = (spec.methods?.length || 0) * 25 + (spec.methods?.length > 0 ? 10 : 0);
    const totalHeight = baseHeight + attrHeight + methodHeight;
    
    const classElement = {
      type: "Class",
      id: classId,
      name: spec.className,
      owner: null,
      bounds: { x: pos.x, y: pos.y, width: 220, height: totalHeight },
      attributes: [] as string[],
      methods: [] as string[]
    };
    
    const { attributes, endY: attrEndY } = this.createAttributes(spec, classId, pos.y + 50, pos.x);
    const { methods } = this.createMethods(spec, classId, attrEndY, pos.x);
    
    classElement.attributes = Object.keys(attributes);
    classElement.methods = Object.keys(methods);
    
    return {
      class: classElement,
      attributes,
      methods
    };
  }

  convertCompleteSystem(systemSpec: any) {
    this.positionGenerator.reset();
    const allElements: Record<string, any> = {};
    const allRelationships: Record<string, any> = {};
    const classIdMap: Record<string, string> = {};
    
    systemSpec.classes?.forEach((classSpec: any, index: number) => {
      const position = this.positionGenerator.getNextPosition(index);
      const completeElement = this.convertSingleElement(classSpec, position);
      classIdMap[classSpec.className] = completeElement.class.id;
      
      allElements[completeElement.class.id] = completeElement.class;
      Object.assign(allElements, completeElement.attributes);
      Object.assign(allElements, completeElement.methods);
    });
    
    systemSpec.relationships?.forEach((rel: any) => {
      const sourceId = classIdMap[rel.sourceClass || rel.source];
      const targetId = classIdMap[rel.targetClass || rel.target];
      
      if (sourceId && targetId) {
        const relId = generateUniqueId('rel');
        const relationshipType = this.getRelationshipType(rel.type);
        
        allRelationships[relId] = {
          id: relId,
          type: relationshipType,
          source: { 
            element: sourceId,
            direction: 'Left',
            multiplicity: rel.sourceMultiplicity || '1',
            role: '',
            bounds: { x: 0, y: 0, width: 0, height: 0 }
          },
          target: { 
            element: targetId,
            direction: 'Right',
            multiplicity: rel.targetMultiplicity || '1',
            role: rel.name || '',
            bounds: { x: 0, y: 0, width: 0, height: 0 }
          },
          bounds: { x: 0, y: 0, width: 0, height: 0 },
          name: rel.name || '',
          path: [{ x: 100, y: 10 }, { x: 0, y: 10 }],
          isManuallyLayouted: false
        };
      }
    });
    
    return {
      version: "3.0.0",
      type: "ClassDiagram",
      size: { width: 1400, height: 740 },
      elements: allElements,
      relationships: allRelationships,
      interactive: { elements: {}, relationships: {} },
      assessments: {}
    };
  }

  private createAttributes(spec: any, classId: string, startY: number, startX: number) {
    const attributes: Record<string, any> = {};
    let currentY = startY;
    
    spec.attributes?.forEach((attr: any) => {
      const attrId = generateUniqueId('attr');
      const visibilitySymbol = attr.visibility === 'public' ? '+' : 
                             attr.visibility === 'private' ? '-' : '#';
      
      attributes[attrId] = {
        id: attrId,
        name: `${visibilitySymbol} ${attr.name}: ${attr.type}`,
        type: "ClassAttribute",
        owner: classId,
        bounds: { x: startX + 1, y: currentY, width: 218, height: 25 }
      };
      
      currentY += 25;
    });
    
    return { attributes, endY: currentY };
  }

  private createMethods(spec: any, classId: string, startY: number, startX: number) {
    const methods: Record<string, any> = {};
    let currentY = startY + ((spec.attributes?.length || 0) > 0 ? 10 : 0);
    
    spec.methods?.forEach((method: any) => {
      const methodId = generateUniqueId('method');
      const visibilitySymbol = method.visibility === 'public' ? '+' : 
                             method.visibility === 'private' ? '-' : '#';
      
      const paramStr = method.parameters?.map((p: any) => `${p.name}: ${p.type}`).join(', ') || '';
      const methodName = `${visibilitySymbol} ${method.name}(${paramStr}): ${method.returnType}`;
      
      methods[methodId] = {
        id: methodId,
        name: methodName,
        type: "ClassMethod",
        owner: classId,
        bounds: { x: startX + 1, y: currentY, width: 218, height: 25 }
      };
      
      currentY += 25;
    });
    
    return { methods, endY: currentY };
  }

  private getRelationshipType(type: string): string {
    switch (type?.toLowerCase()) {
      case 'inheritance':
      case 'generalization':
        return 'ClassInheritance';
      case 'composition':
        return 'ClassComposition';
      case 'aggregation':
        return 'ClassAggregation';
      default:
        return 'ClassBidirectional';
    }
  }
}
