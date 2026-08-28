// Import an OWL/RDF ontology into a KnowledgeGraphDiagram.
// Separate from `useImportDiagramKG` (which targets ClassDiagram via an LLM);
// this hook hits `/import-owl` (rdflib-backed) and writes the parsed graph as
// the KG diagram's model so the Cytoscape canvas renders it directly.
//
// Where the parsed graph lands depends on the active KG tab:
//   - empty tab  → written straight into it (no prompt);
//   - non-empty  → `KgImportTargetModal` asks the user to either merge it into
//     the current tab (see `kgMerge.ts`) or drop it into a new tab.
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { useCallback, useMemo, useState } from 'react';
import { BACKEND_URL } from '../../shared/constants/constant';
import { useAppDispatch } from '../../app/store/hooks';
import { addDiagramThunk, bumpEditorRevision, switchDiagramIndexThunk } from '../../app/store/workspaceSlice';
import { displayError } from '../../app/store/errorManagementSlice';
import { ProjectStorageRepository } from '../../shared/services/storage/ProjectStorageRepository';
import {
  MAX_DIAGRAMS_PER_TYPE,
  diagramHasContent,
  getActiveDiagram,
  getKgHardLimit,
  getKgSoftLimit,
  isKnowledgeGraphData,
} from '../../shared/types/project';
import type {
  BesserProject,
  KGNodeData,
  KnowledgeGraphData,
  ProjectDiagram,
} from '../../shared/types/project';
import { sortIdsByPriority } from '../editors/kg/node-priority';
import { mergeKnowledgeGraphs } from './kgMerge';
import type { KgImportTargetModalProps } from './KgImportTargetModal';

const OWL_ACCEPT = '.owl,.ttl,.rdf,.xml,.nt,.n3';
const KG_TYPE = 'KnowledgeGraphDiagram' as const;

/** A parsed import waiting for the user to pick a destination. */
interface PendingKgImport {
  fileName: string;
  /** Title proposed for a new tab (the file's base name). */
  title: string;
  incoming: KnowledgeGraphData;
  currentTabTitle: string;
  canAddTab: boolean;
}

function baseName(fileName: string): string {
  const withoutPath = fileName.split(/[\\/]/).pop() ?? fileName;
  return withoutPath.replace(/\.[^.]+$/, '') || withoutPath;
}

/** Merge extends the persisted visible set with the imported nodes, otherwise
 *  they'd stay hidden behind the stored selection. Bounded by the same
 *  soft/hard limits the editor applies on a fresh load, and — when the import
 *  brings more nodes than that budget — filled by the same display priority
 *  (classes first, literals last). */
function extendVisibleIds(
  existing: KnowledgeGraphData,
  addedNodeIds: string[],
  mergedNodes: readonly KGNodeData[],
): KnowledgeGraphData['settings'] {
  const stored = existing.settings?.visibleIds;
  if (!Array.isArray(stored) || addedNodeIds.length === 0) {
    return existing.settings;
  }
  const softLimit = getKgSoftLimit(existing.settings);
  const hardLimit = getKgHardLimit(existing.settings);
  const room = Math.max(0, hardLimit - stored.length);
  const budget = Math.min(softLimit, room);
  const ranked =
    addedNodeIds.length <= budget
      ? addedNodeIds
      : sortIdsByPriority(addedNodeIds, new Map(mergedNodes.map((n) => [n.id, n])));
  const additions = ranked.slice(0, budget);
  if (additions.length === 0) return existing.settings;
  return { ...existing.settings, visibleIds: [...stored, ...additions] };
}

export const useImportOwlToKg = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [pending, setPending] = useState<PendingKgImport | null>(null);

  /** Write a model into the active KG tab (replacing whatever it held). */
  const writeToActiveTab = useCallback(
    (project: BesserProject, active: ProjectDiagram, model: KnowledgeGraphData, title: string) => {
      const updated = ProjectStorageRepository.updateDiagram(project.id, KG_TYPE, {
        ...active,
        title,
        model,
        lastUpdate: new Date().toISOString(),
      });
      if (!updated) {
        throw new Error(t('import.kg.owl.updateFailed'));
      }
      if (project.currentDiagramType === KG_TYPE) {
        dispatch(bumpEditorRevision());
      }
    },
    [dispatch],
  );

  const importIntoNewTab = useCallback(
    async (project: BesserProject, model: KnowledgeGraphData, title: string) => {
      const addResult = await dispatch(addDiagramThunk({ diagramType: KG_TYPE, title })).unwrap();
      // Spread ``addResult.diagram`` so an auto-suffixed title survives
      // (importing "people.ttl" twice yields "people" and "people 2").
      const updated = ProjectStorageRepository.updateDiagram(
        project.id,
        KG_TYPE,
        { ...addResult.diagram, model, lastUpdate: new Date().toISOString() },
        addResult.index,
      );
      if (!updated) {
        throw new Error(t('import.kg.owl.writeNewTabFailed'));
      }
      await dispatch(switchDiagramIndexThunk({ diagramType: KG_TYPE, index: addResult.index }));
    },
    [dispatch],
  );

  const runImport = useCallback(async (file: File) => {
    try {
      const formData = new FormData();
      formData.append('owl_file', file);

      const response = await fetch(`${BACKEND_URL}/import-owl`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Could not parse error response' }));
        const errorMsg = errorData.detail || `HTTP error! status: ${response.status}`;
        throw new Error(errorMsg);
      }

      const data = await response.json();
      if (!data || !data.model || !Array.isArray(data.model.nodes) || !Array.isArray(data.model.edges)) {
        throw new Error(t('import.kg.owl.invalidJson'));
      }

      const currentProject = ProjectStorageRepository.getCurrentProject();
      if (!currentProject) {
        throw new Error(t('import.kg.owl.noProjectOpen'));
      }

      const active = getActiveDiagram(currentProject, KG_TYPE);
      if (!active) {
        throw new Error(t('import.kg.owl.noActiveDiagram'));
      }

      const incoming: KnowledgeGraphData = {
        type: KG_TYPE,
        version: data.model.version || '1.0.0',
        nodes: data.model.nodes,
        edges: data.model.edges,
      };

      // Empty tab → import straight into it, no question asked.
      if (!diagramHasContent(active)) {
        writeToActiveTab(currentProject, active, incoming, data.title || active.title || file.name);
        toast.success(
          t('import.kg.owl.imported', {
            nodes: t('import.kg.owl.nodesFragment', { count: incoming.nodes.length }),
            edges: t('import.kg.owl.edgesFragment', { count: incoming.edges.length }),
            file: file.name,
          }),
        );
        return;
      }

      setPending({
        fileName: file.name,
        title: baseName(file.name),
        incoming,
        currentTabTitle: active.title,
        canAddTab: (currentProject.diagrams[KG_TYPE]?.length ?? 0) < MAX_DIAGRAMS_PER_TYPE,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t('import.kg.owl.unknownError');
      dispatch(displayError(t('import.kg.owl.failedTitle'), errorMessage));
      toast.error(errorMessage);
    }
  }, [dispatch, writeToActiveTab, t]);

  /** Apply a pending import once the user has picked a destination. */
  const resolvePending = useCallback(
    async (mode: 'merge' | 'new_tab') => {
      if (!pending) return;
      const { incoming, fileName, title } = pending;
      setPending(null);

      try {
        // Re-read from storage: the editor may have saved changes while the
        // dialog was open.
        const project = ProjectStorageRepository.getCurrentProject();
        if (!project) {
          throw new Error(t('import.kg.owl.noProjectOpen'));
        }
        const active = getActiveDiagram(project, KG_TYPE);
        if (!active) {
          throw new Error(t('import.kg.owl.noActiveDiagram'));
        }

        if (mode === 'new_tab') {
          await importIntoNewTab(project, incoming, title);
          toast.success(
            t('import.kg.owl.importedNewTab', {
              nodes: t('import.kg.owl.nodesFragment', { count: incoming.nodes.length }),
              edges: t('import.kg.owl.edgesFragment', { count: incoming.edges.length }),
              file: fileName,
            }),
          );
          return;
        }

        const existing = isKnowledgeGraphData(active.model)
          ? active.model
          : { type: KG_TYPE, version: '1.0.0', nodes: [], edges: [] };
        const merged = mergeKnowledgeGraphs(existing, incoming);
        writeToActiveTab(
          project,
          active,
          {
            ...merged.model,
            settings: extendVisibleIds(existing, merged.addedNodeIds, merged.model.nodes),
          },
          active.title,
        );

        const skipped = merged.duplicateNodeCount + merged.duplicateEdgeCount;
        toast.success(
          t('import.kg.owl.merged', {
            nodes: t('import.kg.owl.nodesFragment', { count: merged.addedNodeCount }),
            edges: t('import.kg.owl.edgesFragment', { count: merged.addedEdgeCount }),
            file: fileName,
          }) + (skipped > 0 ? t('import.kg.owl.mergedSkippedSuffix', { count: skipped }) : '.'),
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : t('import.kg.owl.unknownError');
        dispatch(displayError(t('import.kg.owl.failedTitle'), errorMessage));
        toast.error(errorMessage);
      }
    },
    [pending, dispatch, importIntoNewTab, writeToActiveTab, t],
  );

  const openPickerAndImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = OWL_ACCEPT;
    input.style.display = 'none';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (file) {
        await runImport(file);
      }
      input.remove();
    });
    document.body.appendChild(input);
    input.click();
  }, [runImport]);

  const importTargetModalProps: KgImportTargetModalProps = useMemo(
    () => ({
      open: pending !== null,
      fileName: pending?.fileName ?? '',
      currentTabTitle: pending?.currentTabTitle ?? '',
      incomingNodeCount: pending?.incoming.nodes.length ?? 0,
      incomingEdgeCount: pending?.incoming.edges.length ?? 0,
      canAddTab: pending?.canAddTab ?? false,
      onMerge: () => { resolvePending('merge').catch(console.error); },
      onNewTab: () => { resolvePending('new_tab').catch(console.error); },
      onCancel: () => setPending(null),
    }),
    [pending, resolvePending],
  );

  return { openPickerAndImport, runImport, importTargetModalProps };
};
