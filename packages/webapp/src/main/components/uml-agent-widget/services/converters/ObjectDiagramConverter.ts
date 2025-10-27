/**
 * Object Diagram Converter
 * Converts simplified object specifications to Apollon format
 */

import { DiagramConverter, PositionGenerator, generateUniqueId } from './base';

export class ObjectDiagramConverter implements DiagramConverter {
  private positionGenerator = new PositionGenerator();

  getDiagramType() {
    return 'ObjectDiagram' as const;
  }

  convertSingleElement(spec: any, position?: { x: number; y: number }) {
    const pos = position || this.positionGenerator.getNextPosition();
    const objectId = generateUniqueId('object');
    
    const baseHeight = 80;
    const attrHeight = (spec.attributes?.length || 0) * 30;
    const totalHeight = baseHeight + attrHeight;
    
    const objectElement: any = {
      type: "ObjectName",
      id: objectId,
      name: `${spec.objectName}: ${spec.className}`,
      owner: null,
      bounds: { x: pos.x, y: pos.y, width: 240, height: totalHeight },
      attributes: [] as string[],
      methods: []
    };
    
    // Add classId reference if provided
    if (spec.classId) {
      objectElement.classId = spec.classId;
    }
    
    const attributes = this.createAttributes(spec, objectId, pos.y + 60, pos.x);
    objectElement.attributes = Object.keys(attributes);
    
    return {
      object: objectElement,
      attributes
    };
  }

  convertCompleteSystem(systemSpec: any) {
    this.positionGenerator.reset();
    const allElements: Record<string, any> = {};
    const allRelationships: Record<string, any> = {};
    const objectIdMap: Record<string, string> = {};
    
    systemSpec.objects?.forEach((objectSpec: any, index: number) => {
      const position = this.positionGenerator.getNextPosition(index);
      const completeElement = this.convertSingleElement(objectSpec, position);
      objectIdMap[objectSpec.objectName] = completeElement.object.id;
      
      allElements[completeElement.object.id] = completeElement.object;
      Object.assign(allElements, completeElement.attributes);
    });
    
    systemSpec.links?.forEach((link: any) => {
      const sourceId = objectIdMap[link.source];
      const targetId = objectIdMap[link.target];
      
      if (sourceId && targetId) {
        const linkId = generateUniqueId('link');
        
        allRelationships[linkId] = {
          id: linkId,
          type: "ObjectLink",
          source: {
            element: sourceId,
            direction: 'Left',
            bounds: { x: 0, y: 0, width: 0, height: 0 }
          },
          target: {
            element: targetId,
            direction: 'Right',
            bounds: { x: 0, y: 0, width: 0, height: 0 }
          },
          bounds: { x: 0, y: 0, width: 0, height: 0 },
          name: link.relationshipType || '',
          path: [{ x: 100, y: 10 }, { x: 0, y: 10 }],
          isManuallyLayouted: false
        };
      }
    });
    
    return {
      version: "3.0.0",
      type: "ObjectDiagram",
      size: { width: 1400, height: 740 },
      elements: allElements,
      relationships: allRelationships,
      interactive: { elements: {}, relationships: {} },
      assessments: {}
    };
  }

  private createAttributes(spec: any, objectId: string, startY: number, startX: number) {
    const attributes: Record<string, any> = {};
    let currentY = startY;
    
    spec.attributes?.forEach((attr: any) => {
      const attrId = generateUniqueId('attr');
      
      const attributeElement: any = {
        id: attrId,
        name: `${attr.name} = ${attr.value}`,
        type: "ObjectAttribute",
        owner: objectId,
        bounds: { x: startX + 1, y: currentY, width: 238, height: 30 }
      };
      
      // Add attributeId reference if provided (links to class diagram attribute)
      if (attr.attributeId) {
        attributeElement.attributeId = attr.attributeId;
      }
      
      attributes[attrId] = attributeElement;
      currentY += 30;
    });
    
    return attributes;
  }
}
