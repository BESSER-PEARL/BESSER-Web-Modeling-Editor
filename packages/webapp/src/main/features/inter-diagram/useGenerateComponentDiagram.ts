import { useCallback } from 'react';
import type { UMLModel } from '@besser/wme';
import { useAppDispatch, useAppSelector } from '../../app/store/hooks';
import {
  addDiagramThunk,
  bumpEditorRevision,
  setElementLineageThunk,
  switchDiagramTypeThunk,
  updateDiagramModelThunk,
} from '../../app/store/workspaceSlice';
import type { DiagramLineage } from '../../shared/types/project';
import { normalizeStoredAgentModel } from '../../shared/utils/projectExportUtils';
import { bpmnModelToComponentModel } from './bpmn-to-component';
import { hashUmlModel } from './lineage-hash';
import type { DerivationResult } from './types';

/**
 * Generate a Component diagram from the active BPMN diagram.
 *
 * Compose the existing slice thunks: addDiagramThunk → switchDiagramTypeThunk
 * → updateDiagramModelThunk. The first creates an empty shell at a new
 * index, the second activates it (and bumps `editorRevision`), the
 * third stamps the derived model onto the now-active diagram.
 *
 * Generate-once — each call produces a new diagram; no overwrite.
 */
export function useGenerateComponentDiagram(): () => Promise<DerivationResult> {
  const dispatch = useAppDispatch();
  const activeDiagram = useAppSelector((s) => s.workspace.activeDiagram);
  const activeDiagramType = useAppSelector((s) => s.workspace.activeDiagramType);
  const project = useAppSelector((s) => s.workspace.project);

  return useCallback(async () => {
    if (activeDiagramType !== 'BPMN' || !activeDiagram?.model) {
      return { ok: false, reason: 'not-a-bpmn-diagram', warnings: [] };
    }

    // The lane's agentDiagramRef points to a stored Agent diagram. Normalize
    // legacy components before deriving, just as the Components page does.
    const agentDiagramsById = new Map<string, UMLModel>();
    const sqlDatabasesByAgentId = new Map<string, Array<{ name?: string }>>();
    for (const d of project?.diagrams.AgentDiagram ?? []) {
      const model = normalizeStoredAgentModel(d);
      if (model) agentDiagramsById.set(d.id, model);
      const databases = (d.agentConfigForm as { db?: { sqlDatabases?: unknown } } | undefined)?.db?.sqlDatabases;
      if (Array.isArray(databases)) sqlDatabasesByAgentId.set(d.id, databases);
    }

    const result = bpmnModelToComponentModel(activeDiagram.model as UMLModel, {
      agentDiagramsById,
      sqlDatabasesByAgentId,
      // always derive capabilities
      // The UI always includes configured capabilities and resources.
      includeCapabilities: true,
      sourceDiagramId: activeDiagram.id,
    });
    if (!result.ok) return result;

    const title = `${activeDiagram.title || 'BPMN'} — Components`;

    // record lineage on the new diagram so the UI can show
    // "← Derived from <source title>" and detect staleness when the
    // source model changes.
    const derivedFrom: DiagramLineage = {
      sourceDiagramId: activeDiagram.id,
      sourceDiagramType: 'BPMN',
      derivationKind: 'bpmn-to-component',
      derivedAt: new Date().toISOString(),
      sourceModelHash: hashUmlModel(activeDiagram.model as UMLModel),
    };

    const added = await dispatch(addDiagramThunk({ diagramType: 'ComponentDiagram', title, derivedFrom })).unwrap();
    await dispatch(switchDiagramTypeThunk({ diagramType: 'ComponentDiagram' })).unwrap();
    await dispatch(updateDiagramModelThunk({ model: result.model })).unwrap();
    // write the element-level lineage sidecar for the new diagram.
    await dispatch(
      setElementLineageThunk({ derivedDiagramId: added.diagram.id, mapping: result.elementMapping }),
    ).unwrap();
    // updateDiagramModelThunk is intentionally
    // silent on editorRevision (so normal editing doesn't reinit the
    // editor on every keystroke). For a derivation we DO want the
    // editor to pick up the populated model immediately.
    dispatch(bumpEditorRevision());

    return result;
  }, [dispatch, activeDiagram, activeDiagramType, project]);
}
