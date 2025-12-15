import { ProjectStorageRepository } from '../../services/storage/ProjectStorageRepository';
import { isUMLModel } from '../../types/project';
import { ClassMetadata, AttributeMetadata, isNumericType, isStringType } from './utils/classBindingHelpers';

/**
 * Remove UML visibility characters (+, -, #, ~) from the beginning of a string
 * @param name - The name that may contain visibility prefix
 * @returns The name without visibility prefix
 */
function stripVisibility(name: string): string {
  if (!name) return name;
  // Remove leading visibility characters (+, -, #, ~) followed by optional space
  return name.replace(/^[+\-#~]\s*/, '');
}

function getClassDiagramModel() {
  const project = ProjectStorageRepository.getCurrentProject();
  return project?.diagrams?.ClassDiagram?.model;
}

function getAgentDiagramModel() {
  const project = ProjectStorageRepository.getCurrentProject();
  return project?.diagrams?.AgentDiagram?.model;
}

export function getClassOptions(): { value: string; label: string }[] {
  const classDiagram = getClassDiagramModel();

  if (!isUMLModel(classDiagram) || !classDiagram.elements) {
    console.warn('[diagram-helpers] No UML class diagram data available');
    return [];
  }

  return Object.values(classDiagram.elements)
    .filter((element: any) => element?.type === 'Class')
    .map((element: any) => ({ value: element.id, label: element.name }));
}

export function getAttributeOptionsByClassId(classId: string): { value: string; label: string }[] {
  const classDiagram = getClassDiagramModel();

  if (!isUMLModel(classDiagram) || !classDiagram.elements) {
    return [];
  }

  return Object.values(classDiagram.elements)
    .filter((element: any) => element?.type === 'ClassAttribute' && element?.owner === classId)
    .map((attr: any) => {
      const cleanName = stripVisibility(attr.name);
      // Extract just the attribute name (without type suffix if present in legacy format)
      const justName = cleanName?.split(':')[0]?.trim() || cleanName;
      return { value: attr.id, label: justName };
    });
}

/**
 * Get attribute options filtered by type compatibility
 */
export function getAttributeOptionsByType(classId: string, requireNumeric: boolean = false): { value: string; label: string; type: string }[] {
  const classDiagram = getClassDiagramModel();

  if (!isUMLModel(classDiagram) || !classDiagram.elements) {
    return [];
  }

  const attributes = Object.values(classDiagram.elements)
    .filter((element: any) => element?.type === 'ClassAttribute' && element?.owner === classId)
    .map((attr: any) => {
      const cleanName = stripVisibility(attr.name);
      // Use attributeType property if available (new format), otherwise parse from name (legacy)
      const type = attr.attributeType || cleanName?.split(':')[1]?.trim() || 'str';
      // Extract just the attribute name (without type suffix)
      const justName = cleanName?.split(':')[0]?.trim() || cleanName;
      return {
        value: attr.id,
        label: justName,
        type: type
      };
    });

  if (requireNumeric) {
    return attributes.filter(attr => isNumericType(attr.type));
  }

  return attributes;
}

/**
 * Get full class metadata including attributes with types
 * @param classId - The ID of the class
 * @param includeInherited - Whether to include inherited attributes from parent classes (default: true)
 */
export function getClassMetadata(classId: string, includeInherited: boolean = true): ClassMetadata | undefined {
  const classDiagram = getClassDiagramModel();

  if (!isUMLModel(classDiagram) || !classDiagram.elements) {
    return undefined;
  }

  const classElement = Object.values(classDiagram.elements).find(
    (el: any) => el?.type === 'Class' && el?.id === classId
  ) as any;

  if (!classElement) {
    return undefined;
  }

  // Get direct attributes
  const attributes: AttributeMetadata[] = Object.values(classDiagram.elements)
    .filter((element: any) => element?.type === 'ClassAttribute' && element?.owner === classId)
    .map((attr: any) => {
      const cleanName = stripVisibility(attr.name);
      // Use attributeType property if available (new format), otherwise parse from name (legacy)
      const type = attr.attributeType || cleanName?.split(':')[1]?.trim() || 'str';
      // Extract just the attribute name (without type suffix)
      const justName = cleanName?.split(':')[0]?.trim() || cleanName;
      return {
        id: attr.id,
        name: justName,
        type: type,
        isNumeric: isNumericType(type),
        isString: isStringType(type)
      };
    });

  // Add inherited attributes if requested
  if (includeInherited && classDiagram.relationships) {
    const inheritedAttributeIds = getInheritedAttributeOptionsByClassId(classId).map(a => a.value);
    const inheritedAttributes = Object.values(classDiagram.elements)
      .filter((element: any) => element?.type === 'ClassAttribute' && inheritedAttributeIds.includes(element.id))
      .map((attr: any) => {
        const cleanName = stripVisibility(attr.name);
        const type = attr.attributeType || cleanName?.split(':')[1]?.trim() || 'str';
        const justName = cleanName?.split(':')[0]?.trim() || cleanName;
        return {
          id: attr.id,
          name: justName,
          type: type,
          isNumeric: isNumericType(type),
          isString: isStringType(type)
        };
      });
    
    attributes.push(...inheritedAttributes);
  }

  return {
    id: classElement.id,
    name: classElement.name,
    attributes
  };
}

export function getEndsByClassId(classId: string, includeInherited: boolean = true): { value: string; label: string }[] {
  const classDiagram = getClassDiagramModel();

  if (!isUMLModel(classDiagram) || !classDiagram.relationships) {
    return [];
  }

  // Get direct association ends
  const directEnds = Object.values(classDiagram.relationships)
    .filter((relationship: any) => relationship?.type !== 'ClassInheritance')
    .map((relationship: any) => {
      if (relationship?.source?.element === classId) {
        return { value: relationship.target.element, label: relationship.target.role };
      }

      if (relationship?.target?.element === classId) {
        return { value: relationship.source.element, label: relationship.source.role };
      }

      return null;
    })
    .filter((end): end is { value: string; label: string } => end !== null);

  // Add inherited association ends if requested
  if (includeInherited) {
    const inheritedEnds = getInheritedEndsByClassId(classId);
    return [...directEnds, ...inheritedEnds];
  }

  return directEnds;
}

export function getElementNameById(elementId: string): string | null {
  const classDiagram = getClassDiagramModel();

  if (!isUMLModel(classDiagram) || !classDiagram.elements) {
    return null;
  }

  const element = Object.values(classDiagram.elements).find((el: any) => el?.id === elementId);
  return element ? (element as any).name : null;
}

/**
 * Get attributes inherited from parent classes (traverse up the inheritance tree)
 */
export function getInheritedAttributeOptionsByClassId(classId: string): { value: string; label: string }[] {
  const classDiagram = getClassDiagramModel();

  if (!isUMLModel(classDiagram) || !classDiagram.elements || !('relationships' in classDiagram) || !classDiagram.relationships) {
    return [];
  }

  // Helper to recursively collect parent class IDs (where classId is the source, parent is the target)
  function getParentClassIds(currentId: string, visited = new Set<string>()): string[] {
    if (visited.has(currentId)) return [];
    visited.add(currentId);
    const parents = Object.values((classDiagram as any).relationships)
      .filter((rel: any) => rel?.type === 'ClassInheritance' && rel?.source?.element === currentId)
      .map((rel: any) => rel.target.element);
    return parents.reduce((acc: string[], parentId: string) => {
      acc.push(parentId);
      acc.push(...getParentClassIds(parentId, visited));
      return acc;
    }, []);
  }

  const parentIds = getParentClassIds(classId);
  if (parentIds.length === 0) return [];

  // Collect attributes from all parent classes
  const inheritedAttributes = Object.values(classDiagram.elements)
    .filter((element: any) => element?.type === 'ClassAttribute' && parentIds.includes(element.owner))
    .map((attr: any) => {
      const cleanName = stripVisibility(attr.name);
      // Extract just the attribute name (without type suffix if present in legacy format)
      const justName = cleanName?.split(':')[0]?.trim() || cleanName;
      return { value: attr.id, label: justName };
    });

  return inheritedAttributes;
}

/**
 * Get relationships inherited from parent classes (traverse up the inheritance tree)
 */
export function getInheritedEndsByClassId(classId: string): { value: string; label: string }[] {
  const classDiagram = getClassDiagramModel();

  if (!isUMLModel(classDiagram) || !classDiagram.elements || !('relationships' in classDiagram) || !classDiagram.relationships) {
    return [];
  }

  // Helper to recursively collect parent class IDs (where classId is the source, parent is the target)
  function getParentClassIds(currentId: string, visited = new Set<string>()): string[] {
    if (visited.has(currentId)) return [];
    visited.add(currentId);
    const parents = Object.values((classDiagram as any).relationships)
      .filter((rel: any) => rel?.type === 'ClassInheritance' && rel?.source?.element === currentId)
      .map((rel: any) => rel.target.element);
    return parents.reduce((acc: string[], parentId: string) => {
      acc.push(parentId);
      acc.push(...getParentClassIds(parentId, visited));
      return acc;
    }, []);
  }

  const parentIds = getParentClassIds(classId);
  if (parentIds.length === 0) return [];

  // Collect relationships from all parent classes (excluding inheritance relationships)
  const inheritedEnds: { value: string; label: string }[] = [];
  Object.values((classDiagram as any).relationships)
    .filter((rel: any) => rel?.type !== 'ClassInheritance')
    .forEach((rel: any) => {
      if (parentIds.includes(rel?.source?.element)) {
        inheritedEnds.push({ value: rel.target.element, label: rel.target.role });
      } else if (parentIds.includes(rel?.target?.element)) {
        inheritedEnds.push({ value: rel.source.element, label: rel.source.role });
      }
    });

  return inheritedEnds;
}

/**
 * Get agent options from AgentDiagram - returns the entire diagram as an option
 */
export function getAgentOptions(): { value: string; label: string }[] {
  // Get the project to access AgentDiagram
  const project = ProjectStorageRepository.getCurrentProject();
  const agentDiagramData = project?.diagrams?.AgentDiagram;
  
  if (agentDiagramData?.title) {
    // Return the diagram title as the agent identifier (entire diagram, not individual states)
    return [{ value: agentDiagramData.title, label: agentDiagramData.title }];
  }
  
  console.warn('[diagram-helpers] No Agent diagram data available');
  return [];
}

/**
 * Get methods for a specific class
 */
export interface MethodMetadata {
  id: string;
  name: string;
  isInstanceMethod: boolean;
  parameters: MethodParameter[];
}

export interface MethodParameter {
  name: string;
  type: string;
  hasDefault: boolean;
  defaultValue?: any;
}

export function getMethodsByClassId(classId: string): MethodMetadata[] {
  const classDiagram = getClassDiagramModel();

  if (!isUMLModel(classDiagram) || !classDiagram.elements) {
    return [];
  }

  // Find class by name (classId might be a name now)
  const classElement = Object.values(classDiagram.elements).find(
    (element: any) => element?.type === 'Class' && (element?.id === classId || element?.name === classId)
  );
  
  if (!classElement) {
    return [];
  }

  return Object.values(classDiagram.elements)
    .filter((element: any) => element?.type === 'ClassMethod' && element?.owner === (classElement as any).id)
    .map((method: any) => {
      // Parse method signature to extract parameters
      const methodName = method.name || '';
      const isInstanceMethod = methodName.includes('(self') || methodName.includes('(session');
      
      // Extract method name (before parentheses)
      const nameMatch = methodName.match(/^([^(]+)/);
      const cleanName = nameMatch ? nameMatch[1].trim() : methodName;
      
      // Extract parameters from signature like "method_name(param1: type1 = default1, param2: type2)"
      const paramsMatch = methodName.match(/\(([^)]*)\)/);
      const parameters: MethodParameter[] = [];
      
      if (paramsMatch && paramsMatch[1]) {
        const paramString = paramsMatch[1];
        const paramParts = paramString.split(',').map((p: string) => p.trim());
        
        for (const part of paramParts) {
          // Skip 'self' and 'session' parameters
          if (part.startsWith('self') || part.startsWith('session')) {
            continue;
          }
          
          // Parse "param_name: type = default" or "param_name: type" or "param_name"
          const paramMatch = part.match(/^([^:=]+)(?::\s*([^=]+))?(?:=\s*(.+))?$/);
          if (paramMatch) {
            const paramName = paramMatch[1].trim();
            const paramType = paramMatch[2]?.trim() || 'str';
            const defaultValue = paramMatch[3]?.trim();
            
            parameters.push({
              name: paramName,
              type: paramType,
              hasDefault: !!defaultValue,
              defaultValue: defaultValue
            });
          }
        }
      }
      
      return {
        id: method.id,
        name: cleanName,
        isInstanceMethod: isInstanceMethod,
        parameters: parameters
      };
    });
}

/**
 * Get method options for dropdown (formatted as value: label)
 */
export function getMethodOptions(classId: string): { value: string; label: string; isInstanceMethod: boolean }[] {
  const methods = getMethodsByClassId(classId);
  return methods.map(method => {
    // Remove visibility prefix (+ or -) from method name
    const cleanName = method.name.replace(/^[+-]\s*/, '');
    return {
      value: method.id,  // Store the method ID
      label: cleanName,  // Show only the clean method name without (static) suffix
      isInstanceMethod: method.isInstanceMethod
    };
  });
}

/**
 * Get table options from the GrapesJS editor
 * Returns an array of { value: tableId, label: "TableTitle (table)" }
 */
export function getTableOptions(editor: any): { value: string; label: string }[] {
  const options: Array<{ value: string; label: string }> = [
    { value: '', label: '-- Select Source --' }
  ];
  
  if (!editor) return options;
  
  try {
    const wrapper = editor.getWrapper?.();
    if (!wrapper) return options;
    
    // Find all table components in the current page
    const tables = wrapper.find('[class*="table-component"]');
    
    if (!tables) return options;
    
    tables.forEach((table: any) => {
      try {
        const attrs = table.getAttributes();
        const title = attrs['chart-title'] || 'Untitled Table';
        const componentId = table.getId();
        
        options.push({
          value: componentId,  // Store the component ID as the value
          label: `${title} (table)`  // Display the title with "(table)" suffix
        });
      } catch (err) {
        console.warn('[getTableOptions] Error processing table:', err);
      }
    });
  } catch (err) {
    console.warn('[getTableOptions] Error getting wrapper:', err);
  }
  
  return options;
}
