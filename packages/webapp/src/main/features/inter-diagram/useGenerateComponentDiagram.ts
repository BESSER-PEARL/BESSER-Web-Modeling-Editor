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

    // id → model for every Agent diagram in the project, so the
    // derivation can resolve task.agentDiagramRef → its tools/skills.
    const agentDiagramsById = new Map<string, UMLModel>();
    for (const d of project?.diagrams.AgentDiagram ?? []) {
      if (d.model) agentDiagramsById.set(d.id, d.model as UMLModel);
    }

    const result = bpmnModelToComponentModel(activeDiagram.model as UMLModel, {
      agentDiagramsById,
      // always derive capabilities
      // (tools + skills today; point 5 adds LLM/DB/RAG). The opt-in
      // `includeTools` toggle is retired — the derivation function keeps
      // its `includeCapabilities` param for tests/back-compat, but the
      // UI always sets it on.
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
