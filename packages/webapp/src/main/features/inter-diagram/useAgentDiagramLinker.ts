import type { MutableRefObject } from 'react';
import { useCallback, useMemo } from 'react';
import { toast } from 'react-toastify';
import type { ApollonEditor, UMLModel } from '@besser/wme';
import { useAppDispatch, useAppSelector } from '../../app/store/hooks';
import {
  addDiagramThunk,
  bumpEditorRevision,
  selectActiveDiagram,
  selectActiveDiagramType,
  setElementLineageThunk,
  switchDiagramIndexThunk,
  switchDiagramTypeThunk,
  updateDiagramModelThunk,
} from '../../app/store/workspaceSlice';
import { ProjectStorageRepository } from '../../shared/services/storage/ProjectStorageRepository';
import { MAX_DIAGRAMS_PER_TYPE, isUMLModel, type ProjectDiagram } from '../../shared/types/project';
import type { DiagramLineage } from '../../shared/types/project';
import type { AgentDiagramLinker } from '@besser/wme';
import { laneToAgentModel } from './lane-to-agent';
import { hashUmlModel } from './lineage-hash';

/**
 * Host-side linker passed to `editor.setAgentDiagramLinker(...)`.
 *
 * Contract: see `AgentDiagramLinker` in @besser/wme. The lifecycle is:
 *
 *   Define click (popup → linker.createForLane)
 *     ├─ Flush editor's in-memory BPMN to storage (preserves pending
 *     │   isAgentic / role / trustScore edits under the 300ms debounce)
 *     ├─ addDiagramThunk → new Agent diagram (id=newRef)
 *     ├─ Storage-direct write: set `agentDiagramRef = newRef` on the
 *     │   source BPMN lane (bypasses editor model entirely — the BPMN
 *     │   editor is being torn down by the upcoming switch)
 *     └─ switchDiagramTypeThunk('AgentDiagram') — flips activeDiagramType
 *         so the tab UI / toolbar update. (addDiagramThunk already set
 *         activeDiagram + currentDiagramIndices + bumped revision.)
 *
 *   Open click (popup → linker.openByRef)
 *     ├─ Read project fresh from storage (in case the closure is stale)
 *     ├─ Resolve index
 *     └─ switchDiagramTypeThunk + switchDiagramIndexThunk
 *
 * Failure modes:
 *  - max-5 Agent diagrams hit → createForLane returns null after a toast;
 *    the popup keeps the Define button.
 *  - openByRef on a vanished ref → no-op (the popup will have rendered
 *    the Define button instead anyway).
 */
export function useAgentDiagramLinker(editorRef: MutableRefObject<ApollonEditor | null>): AgentDiagramLinker {
  const dispatch = useAppDispatch();
  const activeDiagram = useAppSelector(selectActiveDiagram);
  const activeDiagramType = useAppSelector(selectActiveDiagramType);

  const isRefAlive = useCallback((ref: string) => {
    // Always read fresh from storage — the closed-over `project` from
    // `useAppSelector(selectProject)` can lag behind an addDiagramThunk
    // dispatch by one render cycle, which would briefly show "Define"
    // on a lane whose Agent diagram already exists.
    const fresh = ProjectStorageRepository.getCurrentProject();
    return fresh?.diagrams.AgentDiagram.some((d) => d.id === ref) ?? false;
  }, []);

  const createForLane = useCallback(
    async (suggestedTitle: string, laneId: string) => {
      const sourceDiagram = activeDiagram;
      const sourceType = activeDiagramType;

      // Defensive: the affordance only renders on a BPMN agentic lane,
      // so this should never bite. If it does, bail cleanly.
      if (!sourceDiagram || sourceType !== 'BPMN' || !isUMLModel(sourceDiagram.model)) {
        toast.error('Cannot define agent: BPMN diagram is not active.');
        return null;
      }
      const sourceDiagramId = sourceDiagram.id;

      // Max-5 check using fresh storage.
      const initial = ProjectStorageRepository.getCurrentProject();
      if (!initial) {
        toast.error('No project is open.');
        return null;
      }
      if (initial.diagrams.AgentDiagram.length >= MAX_DIAGRAMS_PER_TYPE) {
        toast.warn(
          `Cannot add more Agent diagrams (max ${MAX_DIAGRAMS_PER_TYPE} per project). ` +
            `Delete an existing Agent diagram first.`,
        );
        return null;
      }

      // If the source element is a LANE, derive a populated Agent diagram
      // (states from tasks). If it's a TASK, leave the empty-diagram path
      // untouched. A lane that refuses to derive (no tasks) falls back to
      // empty so the link still works.
      const sourceEl = sourceDiagram.model.elements?.[laneId] as { type?: string } | undefined;
      const isLaneSource = sourceEl?.type === 'BPMNSwimlane';
      const derivation = isLaneSource ? laneToAgentModel(sourceDiagram.model as UMLModel, laneId) : null;
      const derivedFrom: DiagramLineage | undefined =
        isLaneSource && derivation?.ok
          ? {
              sourceDiagramId,
              sourceDiagramType: 'BPMN',
              derivationKind: 'bpmn-to-agent',
              derivedAt: new Date().toISOString(),
              sourceModelHash: hashUmlModel(sourceDiagram.model as UMLModel),
            }
          : undefined;

      // Flush the editor's in-memory BPMN to storage. Captures
      // any pending edits sitting in the 300ms debounce window (e.g. the
      // user just toggled isAgentic on, then immediately clicked Define).
      // Without this, the storage-direct write below would overlay onto
      // pre-toggle storage and the lane would re-render non-agentic.
      const editor = editorRef.current;
      if (editor) {
        try {
          await dispatch(updateDiagramModelThunk({ model: editor.model as UMLModel })).unwrap();
        } catch (err) {
          console.warn('[08] pre-define flush failed:', err);
        }
      }

      // Add the Agent diagram. This sets activeDiagram = new
      // Agent, sets currentDiagramIndices.AgentDiagram, AND bumps
      // editorRevision (the BPMN editor will be torn down + a new
      // editor created from the now-active Agent diagram). Note that
      // addDiagramThunk does NOT update activeDiagramType — the type
      // switch below does.
      let newDiagramId: string;
      try {
        const added = await dispatch(
          addDiagramThunk({ diagramType: 'AgentDiagram', title: suggestedTitle, derivedFrom }),
        ).unwrap();
        newDiagramId = added.diagram.id;
      } catch (err) {
        console.error('[08] addDiagramThunk failed:', err);
        toast.error('Failed to create Agent diagram. Please try again.');
        return null;
      }

      // Write the ref to the source BPMN lane in storage
      // directly (bypassing the editor's model-change subscription,
      // which is now dispatching against a soon-to-be-destroyed editor).
      // Read fresh storage so we pick up: (a) the earlier flush and (b)
      // the new Agent diagram already added by addDiagramThunk.
      const fresh = ProjectStorageRepository.getCurrentProject();
      if (fresh) {
        const bpmnIndex = fresh.diagrams.BPMN.findIndex((d) => d.id === sourceDiagramId);
        if (bpmnIndex >= 0) {
          const bpmn = fresh.diagrams.BPMN[bpmnIndex];
          if (isUMLModel(bpmn.model)) {
            const storageLane = bpmn.model.elements?.[laneId] as
              | { type?: string; agentDiagramRef?: string }
              | undefined;
            // The affordance now lives on the agentic TASK; accept it,
            // and keep BPMNSwimlane for tolerant handling of any legacy
            // lane-linked element. `laneId` is a carry-over name.
            if (storageLane && (storageLane.type === 'BPMNTask' || storageLane.type === 'BPMNSwimlane')) {
              const updatedBpmn: ProjectDiagram = {
                ...bpmn,
                model: {
                  ...bpmn.model,
                  elements: {
                    ...bpmn.model.elements,
                    [laneId]: { ...storageLane, agentDiagramRef: newDiagramId },
                  },
                },
                lastUpdate: new Date().toISOString(),
              };
              ProjectStorageRepository.withoutNotify(() => {
                ProjectStorageRepository.updateDiagram(fresh.id, 'BPMN', updatedBpmn, bpmnIndex);
              });
            } else {
              console.warn('[08] source lane not found in storage; ref not written');
            }
          }
        }
      }

      // Step 4 — flip activeDiagramType to AgentDiagram so the tab UI
      // and toolbar match the now-active model. activeDiagramIndex is
      // re-derived from currentDiagramIndices (set by addDiagramThunk),
      // so the new Agent diagram becomes the active one — no need for
      // an extra switchDiagramIndexThunk.
      try {
        await dispatch(switchDiagramTypeThunk({ diagramType: 'AgentDiagram' })).unwrap();
      } catch (err) {
        console.error('[08] switchDiagramType failed:', err);
      }

      // Populate the now-active Agent diagram from the lane derivation.
      // MUST run after the switch so updateDiagramModelThunk targets the Agent
      // diagram (it writes to the active diagram type/index), not the BPMN.
      if (isLaneSource && derivation?.ok) {
        try {
          await dispatch(updateDiagramModelThunk({ model: derivation.model })).unwrap();
          await dispatch(
            setElementLineageThunk({ derivedDiagramId: newDiagramId, mapping: derivation.elementMapping }),
          ).unwrap();
          dispatch(bumpEditorRevision());
        } catch (err) {
          console.error('[29] populate Agent diagram failed:', err);
        }
      }

      return newDiagramId;
    },
    [activeDiagram, activeDiagramType, dispatch, editorRef],
  );

  const openByRef = useCallback(
    (ref: string) => {
      // Read fresh from storage — the closed-over `project` selector
      // can lag a render behind reality (e.g. immediately after a
      // sibling thunk added a diagram).
      const fresh = ProjectStorageRepository.getCurrentProject();
      const idx = fresh?.diagrams.AgentDiagram.findIndex((d) => d.id === ref) ?? -1;
      if (idx < 0) return;
      void (async () => {
        try {
          await dispatch(switchDiagramTypeThunk({ diagramType: 'AgentDiagram' })).unwrap();
          await dispatch(switchDiagramIndexThunk({ diagramType: 'AgentDiagram', index: idx })).unwrap();
        } catch (err) {
          console.error('[08] openByRef navigation failed:', err);
        }
      })();
    },
    [dispatch],
  );

  // Stable identity per render slice — the imperative-register call in
  // ApollonEditorComponent reads linkerRef.current; the post-mount
  // `[linker]` effect re-registers on identity change.
  return useMemo(() => ({ isRefAlive, createForLane, openByRef }), [isRefAlive, createForLane, openByRef]);
}
