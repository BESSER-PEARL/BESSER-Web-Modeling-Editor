// Import an OWL/RDF ontology into the active KnowledgeGraphDiagram.
// Separate from `useImportDiagramKG` (which targets ClassDiagram via an LLM);
// this hook hits `/import-owl` (rdflib-backed) and replaces the KG diagram's
// model with the parsed graph so the Cytoscape canvas renders it directly.
import { toast } from 'react-toastify';
import { useCallback } from 'react';
import { BACKEND_URL } from '../../shared/constants/constant';
import { useAppDispatch } from '../../app/store/hooks';
import { bumpEditorRevision } from '../../app/store/workspaceSlice';
import { displayError } from '../../app/store/errorManagementSlice';
import { ProjectStorageRepository } from '../../shared/services/storage/ProjectStorageRepository';
import { getActiveDiagram } from '../../shared/types/project';

const OWL_ACCEPT = '.owl,.ttl,.rdf,.xml,.nt,.n3';

export const useImportOwlToKg = () => {
  const dispatch = useAppDispatch();

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
        throw new Error('Invalid KG JSON returned from backend');
      }

      const currentProject = ProjectStorageRepository.getCurrentProject();
      if (!currentProject) {
        throw new Error('No project is currently open. Please create or open a project first.');
      }

      const active = getActiveDiagram(currentProject, 'KnowledgeGraphDiagram');
      if (!active) {
        throw new Error('No active Knowledge Graph diagram found in this project.');
      }

      const updated = ProjectStorageRepository.updateDiagram(
        currentProject.id,
        'KnowledgeGraphDiagram',
        {
          ...active,
          title: data.title || active.title || file.name,
          model: {
            type: 'KnowledgeGraphDiagram',
            version: data.model.version || '1.0.0',
            nodes: data.model.nodes,
            edges: data.model.edges,
          },
          lastUpdate: new Date().toISOString(),
        },
      );

      if (!updated) {
        throw new Error('Failed to update the Knowledge Graph diagram.');
      }

      if (currentProject.currentDiagramType === 'KnowledgeGraphDiagram') {
        dispatch(bumpEditorRevision());
      }
      toast.success(`Imported ${data.model.nodes.length} nodes and ${data.model.edges.length} edges from ${file.name}.`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred during import';
      dispatch(displayError('OWL import failed', errorMessage));
      toast.error(errorMessage);
    }
  }, [dispatch]);

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

  return { openPickerAndImport, runImport };
};
