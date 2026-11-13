export type {
  KGNodeType,
  KGNodeData,
  KGEdgeData,
  KGConstraintSpec,
  KGNestedShape,
  KnowledgeGraphData,
} from '../../../shared/types/project';
export {
  KG_CONSTRAINT_TARGET_CLASS,
  KG_CONSTRAINT_TARGET_PROPERTY,
  KG_SH_PROPERTY,
} from '../../../shared/types/project';

export const KG_NODE_TYPES: Array<{
  type: 'class' | 'individual' | 'property' | 'literal' | 'blank' | 'nodeConstraint' | 'propertyConstraint';
  label: string;
  description: string;
}> = [
  { type: 'class', label: 'Class', description: 'A type / concept (owl:Class)' },
  { type: 'individual', label: 'Individual', description: 'An instance of a class' },
  { type: 'property', label: 'Property', description: 'A reified property node' },
  { type: 'literal', label: 'Literal', description: 'A literal value (string, number, …)' },
  { type: 'blank', label: 'Blank', description: 'Anonymous resource (blank node)' },
  {
    type: 'nodeConstraint',
    label: 'Node Constraint',
    description: 'Constraints that apply to a class (OWL axioms or SHACL NodeShape)',
  },
  {
    type: 'propertyConstraint',
    label: 'Property Constraint',
    description: 'Constraints that apply to a property (OWL restriction or SHACL PropertyShape)',
  },
];

/** What is selected on the canvas, shared by the canvas, the inspector and the editor. */
export type KgSelection =
  | { kind: 'node'; id: string }
  | { kind: 'edge'; id: string }
  | { kind: 'multi'; nodeIds: string[]; edgeIds: string[] }
  | null;

/** `DataTransfer` type of a palette item dragged onto the canvas; its data is the node kind. */
export const KG_DRAG_MIME = 'application/x-besser-kg-node';

/** 'off' = move/select only; 'connect' = drag-from-source-onto-target (node
 *  positions are frozen while this mode is on). */
export type ConnectMode = 'off' | 'connect';

/** Zoom limits of the canvas; the controls bar disables zoom in/out at them. */
export const KG_MIN_ZOOM = 0.1;
export const KG_MAX_ZOOM = 4;
