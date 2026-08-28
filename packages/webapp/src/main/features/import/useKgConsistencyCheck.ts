// Fetch hook for the backend's /check-kg-consistency endpoint. The endpoint
// validates the KG's ABox against its OWL2 + SHACL constraints (via pyshacl
// + owlrl on the backend) and returns a structured report. Used by:
//   - The new "Consistency" tab in `KgRefineModal` (on-demand check).
//   - The pre-conversion gate in `useKgToUmlConversion` (auto-trigger
//     before /kg-to-class-diagram is called).
import { useCallback } from 'react';

import { BACKEND_URL } from '../../shared/constants/constant';
import type { ConsistencyReport, ProjectDiagram } from '../../shared/types/project';


export function useKgConsistencyCheck() {
  return useCallback(async (kgDiagram: ProjectDiagram): Promise<ConsistencyReport> => {
    const response = await fetch(`${BACKEND_URL}/check-kg-consistency`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: kgDiagram.id,
        title: kgDiagram.title,
        model: kgDiagram.model,
      }),
    });
    if (!response.ok) {
      let detail = `HTTP ${response.status}`;
      try {
        const body = await response.json();
        detail = body.detail || detail;
      } catch {
        /* ignore non-JSON error body */
      }
      throw new Error(detail);
    }
    return response.json();
  }, []);
}
