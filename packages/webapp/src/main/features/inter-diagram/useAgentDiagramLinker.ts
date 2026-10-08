import type { MutableRefObject } from 'react';
import { useCallback, useMemo } from 'react';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import type { AgentDiagramLinker, ApollonEditor, UMLModel } from '@besser/wme';
import { useAppDispatch, useAppSelector } from '../../app/store/hooks';
import {
  addDiagramThunk,
  bumpEditorRevision,
  openDiagramThunk,
  refreshProjectStateThunk,
  selectActiveDiagram,
  selectActiveDiagramType,
  setElementLineageThunk,
  switchDiagramTypeThunk,
  updateDiagramModelThunk,
} from '../../app/store/workspaceSlice';
import { ProjectStorageRepository } from '../../shared/services/storage/ProjectStorageRepository';
import { MAX_DIAGRAMS_PER_TYPE, isUMLModel } from '../../shared/types/project';
import { hashUmlModel } from '../../shared/utils/lineageHash';
import { reportDerivationWarnings } from './derivation-warnings';
import { laneToAgentModel } from './lane-to-agent';
import type { AgentDerivationRefusalReason } from './types';

/** Why a lane produced an empty Agent diagram instead of a derived one. */
const REFUSAL_MESSAGE_KEYS: Record<AgentDerivationRefusalReason, string> = {
  'no-tasks-in-lane': 'interDiagram.linker.emptyAgent.noTasksInLane',
  'lane-not-agentic': 'interDiagram.linker.emptyAgent.laneNotAgentic',
  'lane-not-found': 'interDiagram.linker.emptyAgent.laneNotFound',
  'not-a-bpmn-diagram': 'interDiagram.linker.emptyAgent.laneNotFound',
};

/**
 * Writes `agentDiagramRef` onto the source BPMN element in storage and, for a
 * lane derivation, records the lineage on the new Agent diagram. The lineage
 * hash is taken after the ref is written, so the link itself does not make the
 * source look changed. Returns false when the source element is gone.
 */
function linkAgentDiagramInStorage(
  bpmnDiagramId: string,
  elementId: string,
  agentDiagramId: string,
  withLineage: boolean,
): boolean {
  const project = ProjectStorageRepository.getCurrentProject();
  if (!project) return false;
  const bpmnIndex = project.diagrams.BPMN.findIndex((d) => d.id === bpmnDiagramId);
  const bpmn = project.diagrams.BPMN[bpmnIndex];
  if (!bpmn || !isUMLModel(bpmn.model)) return false;
  const element = bpmn.model.elements[elementId];
  if (!element || (element.type !== 'BPMNSwimlane' && element.type !== 'BPMNTask')) return false;

  const linkedElement = { ...element, agentDiagramRef: agentDiagramId };
  const linkedModel: UMLModel = {
    ...bpmn.model,
    elements: { ...bpmn.model.elements, [elementId]: linkedElement },
  };
  project.diagrams.BPMN[bpmnIndex] = { ...bpmn, model: linkedModel, lastUpdate: new Date().toISOString() };

  if (withLineage) {
    const agentIndex = project.diagrams.AgentDiagram.findIndex((d) => d.id === agentDiagramId);
    if (agentIndex >= 0) {
      project.diagrams.AgentDiagram[agentIndex] = {
        ...project.diagrams.AgentDiagram[agentIndex],
        derivedFrom: {
          sourceDiagramId: bpmnDiagramId,
          sourceDiagramType: 'BPMN',
          derivationKind: 'bpmn-to-agent',
          derivedAt: new Date().toISOString(),
          sourceModelHash: hashUmlModel(linkedModel),
        },
      };
    }
  }

  ProjectStorageRepository.withoutNotify(() => {
    ProjectStorageRepository.saveProject(project);
  });
  return true;
}

/**
 * Host-side linker passed to `editor.setAgentDiagramLinker(...)`.
 *
 * Define (popup → `createForLane`):
 *   1. flush the editor's in-memory BPMN model (pending debounced edits) and
 *      derive from that model — only a lane source derives; a task source,
 *      or a lane that refuses, gets an empty Agent diagram
 *   2. add the Agent diagram
 *   3. write `agentDiagramRef` (and the lineage) in storage, resync Redux
 *   4. switch to the Agent diagram, then stamp the derived model on it
 * Every failure is reported with a toast; after a failed switch nothing is
 * written, because the next model update would land on the BPMN diagram.
 *
 * Open (popup → `openByRef`): switch to the referenced Agent diagram.
 */
export function useAgentDiagramLinker(editorRef: MutableRefObject<ApollonEditor | null>): AgentDiagramLinker {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const activeDiagram = useAppSelector(selectActiveDiagram);
  const activeDiagramType = useAppSelector(selectActiveDiagramType);

  const isRefAlive = useCallback((ref: string) => {
    // Read storage, not the Redux project: right after an addDiagramThunk the
    // selector can lag a render behind and briefly show "Define" again.
    const fresh = ProjectStorageRepository.getCurrentProject();
    return fresh?.diagrams.AgentDiagram.some((d) => d.id === ref) ?? false;
  }, []);

  const createForLane = useCallback(
    async (suggestedTitle: string, elementId: string) => {
      const sourceDiagram = activeDiagram;
      if (!sourceDiagram || activeDiagramType !== 'BPMN' || !isUMLModel(sourceDiagram.model)) {
        toast.error(t('interDiagram.linker.bpmnNotActive'));
        return null;
      }

      const project = ProjectStorageRepository.getCurrentProject();
      if (!project) {
        toast.error(t('interDiagram.linker.noProject'));
        return null;
      }
      if (project.diagrams.AgentDiagram.length >= MAX_DIAGRAMS_PER_TYPE) {
        toast.warn(t('interDiagram.linker.limitReached', { max: MAX_DIAGRAMS_PER_TYPE }));
        return null;
      }

      // 1. Flush first: the user may have toggled the lane agentic a moment
      //    ago and the change is still inside the 300 ms save debounce.
      let sourceModel: UMLModel = sourceDiagram.model;
      const editor = editorRef.current;
      if (editor) {
        sourceModel = editor.model;
        try {
          await dispatch(updateDiagramModelThunk({ model: sourceModel })).unwrap();
        } catch (err) {
          console.error('[agent-diagram-linker] saving the BPMN diagram failed:', err);
          toast.error(t('interDiagram.linker.flushFailed'));
          return null;
        }
      }

      const isLaneSource = sourceModel.elements[elementId]?.type === 'BPMNSwimlane';
      const derivation = isLaneSource ? laneToAgentModel(sourceModel, elementId) : null;
      if (derivation && !derivation.ok) {
        toast.warning(t(REFUSAL_MESSAGE_KEYS[derivation.reason]));
      }

      // 2. addDiagramThunk makes the new diagram the active one but leaves the
      //    active type on BPMN; step 3 resyncs before the switch.
      let newDiagramId: string;
      try {
        const added = await dispatch(addDiagramThunk({ diagramType: 'AgentDiagram', title: suggestedTitle })).unwrap();
        newDiagramId = added.diagram.id;
      } catch (err) {
        console.error('[agent-diagram-linker] adding the Agent diagram failed:', err);
        toast.error(t('interDiagram.linker.createFailed'));
        return null;
      }

      // 3. The BPMN editor is about to be torn down, so the ref goes straight
      //    to storage instead of through the editor model.
      const linked = linkAgentDiagramInStorage(sourceDiagram.id, elementId, newDiagramId, !!derivation?.ok);
      if (!linked) {
        toast.warning(t('interDiagram.linker.linkNotSaved'));
      }
      try {
        await dispatch(refreshProjectStateThunk()).unwrap();
      } catch (err) {
        console.error('[agent-diagram-linker] reloading the project failed:', err);
        toast.error(t('interDiagram.linker.openFailed'));
        return null;
      }

      // 4. Switch, then populate. updateDiagramModelThunk writes to the active
      //    diagram, so a failed switch must stop here.
      try {
        await dispatch(switchDiagramTypeThunk({ diagramType: 'AgentDiagram' })).unwrap();
      } catch (err) {
        console.error('[agent-diagram-linker] switching to the Agent diagram failed:', err);
        toast.error(t('interDiagram.linker.openFailed'));
        return null;
      }

      if (derivation?.ok) {
        try {
          await dispatch(updateDiagramModelThunk({ model: derivation.model })).unwrap();
          await dispatch(
            setElementLineageThunk({ derivedDiagramId: newDiagramId, mapping: derivation.elementMapping }),
          ).unwrap();
          dispatch(bumpEditorRevision());
        } catch (err) {
          console.error('[agent-diagram-linker] filling the Agent diagram failed:', err);
          toast.error(t('interDiagram.linker.populateFailed'));
          return newDiagramId;
        }
        reportDerivationWarnings(
          '[agent-diagram-linker]',
          t('interDiagram.linker.derivedWithWarnings', { count: derivation.warnings.length }),
          derivation.warnings,
          t,
        );
      }

      return newDiagramId;
    },
    [activeDiagram, activeDiagramType, dispatch, editorRef, t],
  );

  const openByRef = useCallback(
    (ref: string) => {
      const fresh = ProjectStorageRepository.getCurrentProject();
      const index = fresh?.diagrams.AgentDiagram.findIndex((d) => d.id === ref) ?? -1;
      if (index < 0) return;
      dispatch(openDiagramThunk({ diagramType: 'AgentDiagram', index }))
        .unwrap()
        .catch((err: unknown) => {
          console.error('[agent-diagram-linker] opening the Agent diagram failed:', err);
          toast.error(t('interDiagram.linker.openExistingFailed'));
        });
    },
    [dispatch, t],
  );

  // ApollonEditorComponent re-registers the linker when this identity changes.
  return useMemo(() => ({ isRefAlive, createForLane, openByRef }), [isRefAlive, createForLane, openByRef]);
}
