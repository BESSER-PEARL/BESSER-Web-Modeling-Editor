import type { UMLModel } from '@besser/wme';

/** `bpmnSwimlane` → `BPMNSwimlane`, `component` → `Component`; edge types are already PascalCase. */
const elementTypeName = (type: string): string =>
  type.startsWith('bpmn') ? `BPMN${type.slice(4)}` : type.charAt(0).toUpperCase() + type.slice(1);

const nameOf = (data: unknown): string | undefined => {
  const name = (data as { name?: unknown } | undefined)?.name;
  return typeof name === 'string' && name.trim() ? name : undefined;
};

/**
 * Name and type a lineage link shows for a source element. An unnamed flow
 * (e.g. the BPMN flow a ComponentDependency was derived from) is named by its
 * endpoints, an unnamed endpoint by its container: "AgentReviewer → Fix bug".
 */
export function describeLineageSource(model: UMLModel | null, elementId: string): { name?: string; type?: string } {
  const node = model?.nodes.find((n) => n.id === elementId);
  if (node) return { name: nameOf(node.data), type: elementTypeName(node.type) };
  const edge = model?.edges.find((e) => e.id === elementId);
  if (!edge) return {};
  const nodeById = (id: string | undefined) => (id ? model?.nodes.find((n) => n.id === id) : undefined);
  const endpoint = (id: string) => {
    const end = nodeById(id);
    return nameOf(end?.data) ?? nameOf(nodeById(end?.parentId)?.data);
  };
  const source = endpoint(edge.source);
  const target = endpoint(edge.target);
  return {
    name: nameOf(edge.data) ?? (source && target ? `${source} → ${target}` : undefined),
    type: elementTypeName(edge.type),
  };
}
