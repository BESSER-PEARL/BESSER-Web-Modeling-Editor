// Fetch hook for the backend's /kg/consistency endpoint. The endpoint
// validates the KG's ABox against its OWL2 + SHACL constraints (via pyshacl
// + owlrl on the backend) and returns a structured report. Used by:
//   - The new "Consistency" tab in `KgRefineModal` (on-demand check).
//   - The pre-conversion gate in `useKgToUmlConversion` (auto-trigger
//     before /kg/to-class-diagram is called).
import { useCallback } from 'react';

import { checkKgConsistency } from '../../shared/api/knowledgeGraph';
import type { ConsistencyReport, ProjectDiagram } from '../../shared/types/project';

export function useKgConsistencyCheck() {
  return useCallback(
    (kgDiagram: ProjectDiagram): Promise<ConsistencyReport> => checkKgConsistency(kgDiagram),
    [],
  );
}
