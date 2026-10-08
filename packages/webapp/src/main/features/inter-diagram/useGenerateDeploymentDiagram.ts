import { useCallback } from 'react';
import type { UMLModel } from '@besser/wme';
import { isUMLModel, type BesserProject, type ProjectDiagram } from '../../shared/types/project';
import { useAppDispatch, useAppSelector } from '../../app/store/hooks';
import {
  addDiagramThunk,
  bumpEditorRevision,
  setElementLineageThunk,
  switchDiagramTypeThunk,
  updateDiagramModelThunk,
} from '../../app/store/workspaceSlice';
import type { DiagramLineage } from '../../shared/types/project';
import { componentModelToDeploymentModel } from './component-to-deployment';
import type { DeploymentDerivationResult } from './types';
import { hashUmlModel } from '../../shared/utils/lineageHash';

/**
 * Generate a Deployment diagram from the active Component diagram.
 *
 * Mirrors `useGenerateComponentDiagram`: addDiagramThunk →
 * switchDiagramTypeThunk → updateDiagramModelThunk → bumpEditorRevision.
 * Generate-once: each call produces a new diagram.
 */
export function useGenerateDeploymentDiagram(): () => Promise<DeploymentDerivationResult> {
  const dispatch = useAppDispatch();
  const activeDiagram = useAppSelector((s) => s.workspace.activeDiagram);
  const activeDiagramType = useAppSelector((s) => s.workspace.activeDiagramType);
  // The project carries the lineage sidecar (`elementLineage`) + the BPMN
  // diagrams, both needed to trace artifact→Component→lane for swarm multiplicity.
  const project = useAppSelector((s) => s.workspace.project);

  return useCallback(async () => {
    if (activeDiagramType !== 'ComponentDiagram' || !activeDiagram?.model) {
      return { ok: false, reason: 'not-a-component-diagram', warnings: [] };
    }

    // Trace each source Component back to its BPMN agentic lane via the
    // lineage sidecars and read the lane's swarm size, so the derived Artifact
    // can carry `[N]`. Empty when the Component diagram wasn't derived from BPMN.
    const multiplicityByComponentId = resolveLaneMultiplicities(project, activeDiagram);

    const result = componentModelToDeploymentModel(activeDiagram.model as UMLModel, multiplicityByComponentId);
    if (!result.ok) return result;

    const title = `${activeDiagram.title || 'Components'} — Deployment`;

    // record lineage so the UI can show "← Derived from ..."
    // and detect staleness when the source Component model changes.
    const derivedFrom: DiagramLineage = {
      sourceDiagramId: activeDiagram.id,
      sourceDiagramType: 'ComponentDiagram',
      derivationKind: 'component-to-deployment',
      derivedAt: new Date().toISOString(),
      sourceModelHash: hashUmlModel(activeDiagram.model as UMLModel),
    };

    const added = await dispatch(addDiagramThunk({ diagramType: 'DeploymentDiagram', title, derivedFrom })).unwrap();
    await dispatch(switchDiagramTypeThunk({ diagramType: 'DeploymentDiagram' })).unwrap();
    await dispatch(updateDiagramModelThunk({ model: result.model })).unwrap();
    // element-level lineage sidecar.
    await dispatch(
      setElementLineageThunk({ derivedDiagramId: added.diagram.id, mapping: result.elementMapping }),
    ).unwrap();
    // bump revision so the editor picks
    // up the populated model immediately. updateDiagramModelThunk is
    // intentionally silent on editorRevision for normal edits.
    dispatch(bumpEditorRevision());

    return result;
  }, [dispatch, activeDiagram, activeDiagramType, project]);
}

/**
 *  Build `{ [componentElementId]: swarmSize }` for the Component→Deployment
 * derivation by walking the lineage chain Component → BPMN lane → `multiplicity`.
 *
 * - `elementLineage[componentDiagram.id]` maps each derived element id back to its
 *   BPMN source id; agent-Components map to their
 *   **lane** id directly (line 102).
 * - `derivedFrom.sourceDiagramId` names the BPMN diagram the lanes live in.
 *
 * Returns `{}` (every artifact keeps its plain name) when the Component diagram is
 * hand-built (no `derivedFrom`), has no lineage entry, the BPMN diagram is gone, or
 * no lane has a count > 1. Only `bpmnSwimlane` sources with `multiplicity > 1` are
 * recorded — pool/flow lineage entries and Components that resolve to N==1 are skipped.
 */
function resolveLaneMultiplicities(
  project: BesserProject | null | undefined,
  componentDiagram: ProjectDiagram | null | undefined,
): Record<string, number> {
  const out: Record<string, number> = {};
  if (!project || !componentDiagram) return out;

  const lineage = project.elementLineage?.[componentDiagram.id];
  const bpmnDiagramId = componentDiagram.derivedFrom?.sourceDiagramId;
  if (!lineage || !bpmnDiagramId) return out;

  const bpmnDiagram = project.diagrams.BPMN?.find((d) => d.id === bpmnDiagramId);
  if (!bpmnDiagram || !isUMLModel(bpmnDiagram.model) || !isUMLModel(componentDiagram.model)) return out;

  const componentNodes = new Map(componentDiagram.model.nodes.map((n) => [n.id, n]));
  const bpmnNodes = new Map(bpmnDiagram.model.nodes.map((n) => [n.id, n]));

  for (const [componentElementId, sourceElementId] of Object.entries(lineage)) {
    // Only Component nodes carry a swarm count; skip Subsystem←Pool / edge←flow rows.
    if (componentNodes.get(componentElementId)?.type !== 'component') continue;
    const lane = bpmnNodes.get(sourceElementId);
    if (lane?.type !== 'bpmnSwimlane') continue;
    const n = typeof lane.data.multiplicity === 'number' ? lane.data.multiplicity : 1;
    if (n > 1) out[componentElementId] = n;
  }

  return out;
}
