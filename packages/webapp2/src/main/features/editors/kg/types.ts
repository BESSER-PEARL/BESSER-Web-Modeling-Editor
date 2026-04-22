export type { KGNodeType, KGNodeData, KGEdgeData, KnowledgeGraphData } from '../../../shared/types/project';

export const KG_NODE_TYPES: Array<{
  type: 'class' | 'individual' | 'property' | 'literal' | 'blank';
  label: string;
  description: string;
}> = [
  { type: 'class', label: 'Class', description: 'A type / concept (owl:Class)' },
  { type: 'individual', label: 'Individual', description: 'An instance of a class' },
  { type: 'property', label: 'Property', description: 'A reified property node' },
  { type: 'literal', label: 'Literal', description: 'A literal value (string, number, …)' },
  { type: 'blank', label: 'Blank', description: 'Anonymous resource (blank node)' },
];
