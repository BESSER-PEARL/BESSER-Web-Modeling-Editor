import { ProjectStorageRepository } from '../../../shared/services/storage/ProjectStorageRepository';
import { isUMLModel, getActiveDiagram, getReferencedDiagram } from '../../../shared/types/project';
import { ClassMetadata, AttributeMetadata, isNumericType, isStringType } from './utils/classBindingHelpers';
import i18n from '@/main/shared/i18n';

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

/**
 * Get the ClassDiagram model referenced by the currently active GUI diagram.
 * Uses the GUI diagram's per-diagram `references.ClassDiagram` to find the
 * correct ClassDiagram, falling back to the global `currentDiagramIndices`.
 */
function getClassDiagramModel() {
  const project = ProjectStorageRepository.getCurrentProject();
  if (!project) return undefined;
  const activeGUI = getActiveDiagram(project, 'GUINoCodeDiagram');
  return getReferencedDiagram(project, activeGUI, 'ClassDiagram')?.model;
}

/**
 * Get the AgentDiagram model referenced by the currently active GUI diagram.
 * Uses the GUI diagram's per-diagram `references.AgentDiagram` to find the
 * correct AgentDiagram, falling back to the global `currentDiagramIndices`.
 */
function getAgentDiagramModel() {
  const project = ProjectStorageRepository.getCurrentProject();
  if (!project) return undefined;
  const activeGUI = getActiveDiagram(project, 'GUINoCodeDiagram');
  return getReferencedDiagram(project, activeGUI, 'AgentDiagram')?.model;
}

export function getClassOptions(): { value: string; label: string }[] {
  const classDiagram = getClassDiagramModel();

  if (!isUMLModel(classDiagram) || !classDiagram.elements) {
    console.warn('[diagram-helpers] No UML class diagram data available');
    return [];
  }

  return Object.values(classDiagram.elements)
    .filter((element: any) => (element?.type === 'Class' || element?.type === 'AbstractClass'))
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
    (el: any) => (el?.type === 'Class' || el?.type === 'AbstractClass') && el?.id === classId
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

/**
 * Map a relationship to the association end navigable from any of the given classes.
 * Only real association types (bidirectional, unidirectional, composition, aggregation)
 * produce ends — inheritance, OCL links and any other relationship kinds never do,
 * and an end pointing at an OCL constraint element is never navigable.
 */
function getNavigableEndForClassIds(
  relationship: any,
  classIds: string[],
  elements: any,
): { value: string; label: string } | null {
  const endFor = (other: any): { value: string; label: string } | null => {
    const otherElementId = other?.element;
    const otherElement = elements?.[otherElementId];
    if (otherElement?.type === 'ClassOCLConstraint') return null;
    let label = other?.role;
    if (!label || label.trim() === '') label = otherElement?.name || '';
    return { value: otherElementId, label };
  };

  // For bidirectional and composition/aggregation, both ends are navigable
  if (
    relationship?.type === 'ClassBidirectional' ||
    relationship?.type === 'ClassComposition' ||
    relationship?.type === 'ClassAggregation'
  ) {
    if (classIds.includes(relationship.source?.element)) return endFor(relationship.target);
    if (classIds.includes(relationship.target?.element)) return endFor(relationship.source);
  }
  // For unidirectional, only source can navigate to target
  if (relationship?.type === 'ClassUnidirectional') {
    if (classIds.includes(relationship.source?.element)) return endFor(relationship.target);
  }
  return null;
}

/**
 * Pick the attribute used to DISPLAY a related record in lookup columns:
 * the first string attribute that isn't named "id", falling back to the
 * first non-"id" attribute, then to the first attribute. Mirrors the
 * backend serializer's lookup-field selection so autogenerated tables show
 * readable values (e.g. Room.description) instead of raw keys.
 */
export function getDisplayAttribute(classMetadata: ClassMetadata | undefined): AttributeMetadata | undefined {
  const attributes = classMetadata?.attributes ?? [];
  return (
    attributes.find(attr => attr.name === 'name') ??
    attributes.find(attr => attr.isString && attr.name !== 'id') ??
    attributes.find(attr => attr.name !== 'id') ??
    attributes[0]
  );
}

export function getEndsByClassId(classId: string, includeInherited: boolean = true): { value: string; label: string }[] {
  const classDiagram = getClassDiagramModel();

  if (!isUMLModel(classDiagram) || !classDiagram.relationships) {
    return [];
  }

  // Only return association ends with navigability from the given class
  const directEnds = Object.values(classDiagram.relationships)
    .map((relationship: any) => getNavigableEndForClassIds(relationship, [classId], classDiagram.elements))
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

  // Collect association ends from all parent classes — same navigability and
  // OCL filtering as the direct ends in getEndsByClassId
  const inheritedEnds = Object.values((classDiagram as any).relationships)
    .map((rel: any) => getNavigableEndForClassIds(rel, parentIds, (classDiagram as any).elements))
    .filter((end: any): end is { value: string; label: string } => end !== null);

  return inheritedEnds;
}

/**
 * Get attributes from related classes via relationships (e.g., "measure.value" for Metric->Measure)
 * Returns options like { value: "relationshipRole.attributeId", label: "relationshipRole.attributeName" }
 */
export function getRelatedClassAttributeOptions(classId: string): { value: string; label: string }[] {
  const classDiagram = getClassDiagramModel();

  if (!isUMLModel(classDiagram) || !classDiagram.elements || !classDiagram.relationships) {
    return [];
  }

  const relatedOptions: { value: string; label: string }[] = [];
  
  // Get all relationships where this class is involved (direct and inherited)
  const allEnds = getEndsByClassId(classId, true);
  
  // For each relationship end, get the attributes of the related class
  allEnds.forEach(end => {
    const relatedClassId = end.value;
    const relationshipRole = end.label;
    
    if (!relationshipRole) return;
    
    // Get attributes of the related class (including inherited)
    const relatedAttrs = getAttributeOptionsByClassId(relatedClassId);
    const relatedInheritedAttrs = getInheritedAttributeOptionsByClassId(relatedClassId);
    const allRelatedAttrs = [...relatedAttrs, ...relatedInheritedAttrs];
    
    // Create options like "measure.value"
    allRelatedAttrs.forEach(attr => {
      relatedOptions.push({
        value: `${relationshipRole}.${attr.value}`,
        label: `${relationshipRole}.${attr.label}`
      });
    });
  });
  
  return relatedOptions;
}

/**
 * Get agent options for the AgentComponent dropdown.
 *
 * Returns every AgentDiagram in the project, so multi-agent projects can
 * bind different GUI components to different agents. Previously this helper
 * returned only the GUI diagram's per-diagram reference, which silently
 * collapsed every project to a single selectable agent.
 */
export function getAgentOptions(): { value: string; label: string }[] {
  const project = ProjectStorageRepository.getCurrentProject();
  if (!project) {
    return [];
  }
  const agents = project.diagrams.AgentDiagram ?? [];
  return agents
    .filter((d) => !!d?.title)
    .map((d) => ({ value: d.title as string, label: d.title as string }));
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
    (element: any) => (element?.type === 'Class' || element?.type === 'AbstractClass') && (element?.id === classId || element?.name === classId)
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
 * Get table options from the GrapesJS editor (current page only)
 * Returns an array of { value: tableId, label: "TableTitle (table)" }
 */
export function getTableOptions(editor: any): { value: string; label: string }[] {
  const options: Array<{ value: string; label: string }> = [
    { value: '', label: i18n.t('editors.gui.utils.selectSource') }
  ];
  
  if (!editor) return options;
  
  try {
    // Get the current page's main component instead of global wrapper
    const currentPage = editor.Pages?.getSelected();
    const pageWrapper = currentPage?.getMainComponent();
    
    if (!pageWrapper) return options;
    
    // Find all table components in the current page using both class selector and type check.
    // The class selector works for manually dropped tables; the type-based walk
    // catches auto-generated tables whose class may not survive serialization.
    const tablesByClass = pageWrapper.find('.table-component') || [];
    const seenIds = new Set<string>();

    const processTable = (table: any) => {
      try {
        const attrs = table.getAttributes();
        const title = attrs['chart-title'] || table.get('chart-title') || 'Untitled Table';
        const tableId = attrs['id'] || table.getId();
        if (seenIds.has(tableId)) return;
        seenIds.add(tableId);

        options.push({
          value: tableId,
          label: `${title} (table)`,
        });
      } catch (err) {
        console.warn('[getTableOptions] Error processing table:', err);
      }
    };

    // 1. Tables found by CSS class
    tablesByClass.forEach(processTable);

    // 2. Walk the component tree to find tables by GrapesJS component type
    const walkComponents = (parent: any) => {
      const children = parent.components?.() || parent.get?.('components');
      if (!children) return;
      children.forEach((child: any) => {
        if (child.get('type') === 'table') {
          processTable(child);
        }
        walkComponents(child);
      });
    };
    walkComponents(pageWrapper);

  } catch (err) {
    console.warn('[getTableOptions] Error getting page wrapper:', err);
  }
  
  return options;
}
