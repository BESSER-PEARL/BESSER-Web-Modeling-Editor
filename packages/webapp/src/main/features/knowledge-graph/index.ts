// The Knowledge Graph workflow: refining a graph (static preflight, OWL/SHACL
// consistency, AI suggestions) and converting it into a class diagram.
//
// The two dialogs (`refine/KgRefineModal`, `convert/KgConsistencyConfirmModal`)
// are not re-exported: the app root lazy-loads them by path, and a static
// re-export here would pull them into the main chunk.
export { useKgFlows } from './useKgFlows';
export type { KgRefineTab } from './types';
