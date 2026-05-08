import { ProjectStorageRepository } from '../../../shared/services/storage/ProjectStorageRepository';
import { isUMLModel, getActiveDiagram, getReferencedDiagram } from '../../../shared/types/project';
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

/**
 * SA-7b: v4 ClassDiagram nodes carry attribute/method rows inline on
 * `node.data.attributes` / `node.data.methods` (each row has `id`, `name`,
 * `attributeType`, `visibility`, ...). Previously v3 had each attribute /
 * method as a separate UMLElement with `owner === classId`.
 *
 * `node.type === 'class'` covers Class | AbstractClass | Interface |
 * Enumeration; the `data.stereotype` discriminates them.
 */
function isPlainOrAbstractClassNode(node: any): boolean {
  if (!node) return false;
  if (node.type === 'class') {
    const stereo = node?.data?.stereotype;
    return !stereo || stereo === 'abstract';
  }
  return node.type === 'Class' || node.type === 'AbstractClass';
}

function classNodeName(node: any): string {
  return node?.data?.name ?? node?.name ?? '';
}

function classNodeAttributes(node: any): any[] {
  return Array.isArray(node?.data?.attributes) ? node.data.attributes : [];
}

function classNodeMethods(node: any): any[] {
  return Array.isArray(node?.data?.methods) ? node.data.methods : [];
}

export function getClassOptions(): { value: string; label: string }[] {
  const classDiagram = getClassDiagramModel();

  if (!isUMLModel(classDiagram) || !Array.isArray(classDiagram.nodes)) {
    console.warn('[diagram-helpers] No UML class diagram data available');
    return [];
  }

  return classDiagram.nodes
    .filter((n: any) => isPlainOrAbstractClassNode(n))
    .map((n: any) => ({ value: n.id, label: classNodeName(n) }));
}

export function getAttributeOptionsByClassId(classId: string): { value: string; label: string }[] {
  const classDiagram = getClassDiagramModel();

  if (!isUMLModel(classDiagram) || !Array.isArray(classDiagram.nodes)) {
    return [];
  }

  const classNode = classDiagram.nodes.find((n: any) => n.id === classId);
  if (!classNode) return [];

  return classNodeAttributes(classNode).map((attr: any) => {
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

  if (!isUMLModel(classDiagram) || !Array.isArray(classDiagram.nodes)) {
    return [];
  }

  const classNode = classDiagram.nodes.find((n: any) => n.id === classId);
  if (!classNode) return [];

  const attributes = classNodeAttributes(classNode).map((attr: any) => {
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

  if (!isUMLModel(classDiagram) || !Array.isArray(classDiagram.nodes)) {
    return undefined;
  }

  const classNode = classDiagram.nodes.find(
    (n: any) => isPlainOrAbstractClassNode(n) && n.id === classId,
  ) as any;

  if (!classNode) {
    return undefined;
  }

  // Get direct attributes (rows on node.data.attributes)
  const attributes: AttributeMetadata[] = classNodeAttributes(classNode).map((attr: any) => {
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

  // Add inherited attributes (walk inheritance edges to parent classes)
  if (includeInherited && Array.isArray(classDiagram.edges)) {
    // Collect parent class IDs by walking ClassInheritance edges (source = child).
    const visited = new Set<string>();
    const collectParents = (currentId: string): string[] => {
      if (visited.has(currentId)) return [];
      visited.add(currentId);
      const parents = (classDiagram.edges as any[])
        .filter((e: any) => e?.type === 'ClassInheritance' && e?.source === currentId)
        .map((e: any) => e.target);
      return parents.reduce<string[]>((acc, parentId) => {
        acc.push(parentId);
        acc.push(...collectParents(parentId));
        return acc;
      }, []);
    };
    const parentIds = collectParents(classId);
    if (parentIds.length > 0) {
      const parentNodes = classDiagram.nodes.filter((n: any) => parentIds.includes(n.id));
      for (const parentNode of parentNodes) {
        for (const attr of classNodeAttributes(parentNode)) {
          const cleanName = stripVisibility(attr.name);
          const type = attr.attributeType || cleanName?.split(':')[1]?.trim() || 'str';
          const justName = cleanName?.split(':')[0]?.trim() || cleanName;
          attributes.push({
            id: attr.id,
            name: justName,
            type,
            isNumeric: isNumericType(type),
            isString: isStringType(type),
          });
        }
      }
    }
  }

  return {
    id: classNode.id,
    name: classNodeName(classNode),
    attributes
  };
}

export function getEndsByClassId(classId: string, includeInherited: boolean = true): { value: string; label: string }[] {
  const classDiagram = getClassDiagramModel();

  if (!isUMLModel(classDiagram) || !Array.isArray(classDiagram.edges)) {
    return [];
  }

  // v4 edge mapping (per migrations/uml-v4-shape.md ClassDiagram §):
  //   - source/target are now node ids on the edge itself.
  //   - role / multiplicity moved to edge.data.{sourceRole, sourceMultiplicity,
  //     targetRole, targetMultiplicity}.
  const nodes = classDiagram.nodes ?? [];
  const findNode = (id: string) => nodes.find((n: any) => n.id === id);

  const directEnds = (classDiagram.edges as any[])
    .filter((edge: any) => edge?.type !== 'ClassInheritance')
    .map((edge: any) => {
      const sourceId = edge.source;
      const targetId = edge.target;
      const sourceRole = edge?.data?.sourceRole;
      const targetRole = edge?.data?.targetRole;

      // For bidirectional, composition, aggregation, both ends are navigable.
      const bothNavigable =
        edge.type === 'ClassBidirectional' ||
        edge.type === 'ClassComposition' ||
        edge.type === 'ClassAggregation';
      // Unidirectional only navigable from source.
      const sourceNavigable = bothNavigable || edge.type === 'ClassUnidirectional';
      const targetNavigable = bothNavigable;

      if (sourceId === classId && sourceNavigable) {
        const otherNode: any = findNode(targetId);
        if (otherNode?.type === 'ClassOCLConstraint') return null;
        let label = targetRole;
        if (!label || label.trim() === '') label = classNodeName(otherNode);
        return { value: targetId, label };
      }
      if (targetId === classId && targetNavigable) {
        const otherNode: any = findNode(sourceId);
        if (otherNode?.type === 'ClassOCLConstraint') return null;
        let label = sourceRole;
        if (!label || label.trim() === '') label = classNodeName(otherNode);
        return { value: sourceId, label };
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

  if (!isUMLModel(classDiagram) || !Array.isArray(classDiagram.nodes)) {
    return null;
  }

  const node = classDiagram.nodes.find((n: any) => n.id === elementId);
  if (!node) return null;
  return classNodeName(node) || null;
}

/**
 * Get attributes inherited from parent classes (traverse up the inheritance tree)
 */
export function getInheritedAttributeOptionsByClassId(classId: string): { value: string; label: string }[] {
  const classDiagram = getClassDiagramModel();

  if (!isUMLModel(classDiagram) || !Array.isArray(classDiagram.nodes) || !Array.isArray(classDiagram.edges)) {
    return [];
  }

  // Walk inheritance edges (source = child class, target = parent class).
  function getParentClassIds(currentId: string, visited = new Set<string>()): string[] {
    if (visited.has(currentId)) return [];
    visited.add(currentId);
    const parents = ((classDiagram as any).edges as any[])
      .filter((edge: any) => edge?.type === 'ClassInheritance' && edge?.source === currentId)
      .map((edge: any) => edge.target);
    return parents.reduce((acc: string[], parentId: string) => {
      acc.push(parentId);
      acc.push(...getParentClassIds(parentId, visited));
      return acc;
    }, []);
  }

  const parentIds = getParentClassIds(classId);
  if (parentIds.length === 0) return [];

  const inheritedAttributes: { value: string; label: string }[] = [];
  for (const parentNode of (classDiagram.nodes as any[]).filter((n: any) => parentIds.includes(n.id))) {
    for (const attr of classNodeAttributes(parentNode)) {
      const cleanName = stripVisibility(attr.name);
      const justName = cleanName?.split(':')[0]?.trim() || cleanName;
      inheritedAttributes.push({ value: attr.id, label: justName });
    }
  }
  return inheritedAttributes;
}

/**
 * Get relationships inherited from parent classes (traverse up the inheritance tree)
 */
export function getInheritedEndsByClassId(classId: string): { value: string; label: string }[] {
  const classDiagram = getClassDiagramModel();

  if (!isUMLModel(classDiagram) || !Array.isArray(classDiagram.edges)) {
    return [];
  }

  function getParentClassIds(currentId: string, visited = new Set<string>()): string[] {
    if (visited.has(currentId)) return [];
    visited.add(currentId);
    const parents = ((classDiagram as any).edges as any[])
      .filter((edge: any) => edge?.type === 'ClassInheritance' && edge?.source === currentId)
      .map((edge: any) => edge.target);
    return parents.reduce((acc: string[], parentId: string) => {
      acc.push(parentId);
      acc.push(...getParentClassIds(parentId, visited));
      return acc;
    }, []);
  }

  const parentIds = getParentClassIds(classId);
  if (parentIds.length === 0) return [];

  // Collect non-inheritance edges from all parent classes
  const inheritedEnds: { value: string; label: string }[] = [];
  (classDiagram.edges as any[])
    .filter((edge: any) => edge?.type !== 'ClassInheritance')
    .forEach((edge: any) => {
      if (parentIds.includes(edge?.source)) {
        inheritedEnds.push({ value: edge.target, label: edge?.data?.targetRole ?? '' });
      } else if (parentIds.includes(edge?.target)) {
        inheritedEnds.push({ value: edge.source, label: edge?.data?.sourceRole ?? '' });
      }
    });

  return inheritedEnds;
}

/**
 * Get attributes from related classes via relationships (e.g., "measure.value" for Metric->Measure)
 * Returns options like { value: "relationshipRole.attributeId", label: "relationshipRole.attributeName" }
 */
export function getRelatedClassAttributeOptions(classId: string): { value: string; label: string }[] {
  const classDiagram = getClassDiagramModel();

  if (!isUMLModel(classDiagram) || !Array.isArray(classDiagram.nodes) || !Array.isArray(classDiagram.edges)) {
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

  if (!isUMLModel(classDiagram) || !Array.isArray(classDiagram.nodes)) {
    return [];
  }

  // Find class by id or name (classId might be a name now)
  const classNode: any = classDiagram.nodes.find(
    (n: any) => isPlainOrAbstractClassNode(n) && (n.id === classId || classNodeName(n) === classId),
  );

  if (!classNode) {
    return [];
  }

  return classNodeMethods(classNode)
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
    { value: '', label: '-- Select Source --' }
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
