// Export the active Knowledge Graph diagram as OWL (RDF/XML) or Turtle (TTL)
// via the backend's /export-kg-rdf/{fmt} endpoint, then trigger a browser
// download. Triggered from the Generate menu when in a KnowledgeGraphDiagram
// context.
import { useCallback } from 'react';
import { toast } from 'react-toastify';

import { BACKEND_URL } from '../../shared/constants/constant';
import { useFileDownload } from '../../shared/services/file-download/useFileDownload';
import { ProjectStorageRepository } from '../../shared/services/storage/ProjectStorageRepository';
import { getActiveDiagram } from '../../shared/types/project';
import type { BesserProject } from '../../shared/types/project';

export type KgRdfFormat = 'owl' | 'ttl';

const FALLBACK_FILENAME_BY_FORMAT: Record<KgRdfFormat, string> = {
  owl: 'knowledge_graph.owl',
  ttl: 'knowledge_graph.ttl',
};

function extractFilename(contentDisposition: string | null, fallback: string): string {
  if (!contentDisposition) return fallback;
  const patterns = [/filename="([^"]+)"/, /filename=([^;\s]+)/];
  for (const pattern of patterns) {
    const match = contentDisposition.match(pattern);
    if (match) return match[1];
  }
  return fallback;
}

export const useExportKgRdf = () => {
  const downloadFile = useFileDownload();

  return useCallback(
    async (format: KgRdfFormat): Promise<void> => {
      const project = ProjectStorageRepository.getCurrentProject() as BesserProject | null;
      if (!project) {
        toast.error('Open a project before exporting.');
        return;
      }

      const kgDiagram = getActiveDiagram(project, 'KnowledgeGraphDiagram');
      if (!kgDiagram || !kgDiagram.model) {
        toast.error('No active Knowledge Graph diagram to export.');
        return;
      }

      try {
        const response = await fetch(`${BACKEND_URL}/export-kg-rdf/${format}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: kgDiagram.id,
            title: kgDiagram.title,
            model: kgDiagram.model,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ detail: `HTTP ${response.status}` }));
          toast.error(errorData.detail || `HTTP ${response.status}`);
          return;
        }

        const blob = await response.blob();
        const fallback =
          (kgDiagram.title
            ? `${kgDiagram.title.toLowerCase().replace(/\s+/g, '_')}.${format}`
            : FALLBACK_FILENAME_BY_FORMAT[format]);
        const filename = extractFilename(response.headers.get('Content-Disposition'), fallback);

        downloadFile({ file: blob, filename });
        toast.success(`${format.toUpperCase()} export completed successfully`);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'KG export failed.';
        toast.error(message);
      }
    },
    [downloadFile],
  );
};
