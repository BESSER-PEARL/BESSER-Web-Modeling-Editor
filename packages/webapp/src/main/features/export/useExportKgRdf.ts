// Export the active Knowledge Graph diagram as OWL (RDF/XML) or Turtle (TTL)
// via the backend's /export-kg-rdf/{fmt} endpoint, then trigger a browser
// download. Used by the Export dialog when a KnowledgeGraphDiagram is active.
// Resolves to whether a file was downloaded; failures are reported by toast.
import { useCallback } from 'react';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';

import { exportKgRdf, kgApiErrorMessage, type KgRdfFormat, type KgRdfVocab } from '../../shared/api/knowledgeGraph';
import { getPostHog } from '../../shared/services/analytics/lazy-analytics';
import { useFileDownload } from '../../shared/services/file-download/useFileDownload';
import { ProjectStorageRepository } from '../../shared/services/storage/ProjectStorageRepository';
import { getActiveDiagram } from '../../shared/types/project';
import type { BesserProject } from '../../shared/types/project';

export type { KgRdfFormat, KgRdfVocab };

const FALLBACK_FILENAME_BY_FORMAT: Record<KgRdfFormat, string> = {
  owl: 'knowledge_graph.owl',
  ttl: 'knowledge_graph.ttl',
};

export const useExportKgRdf = () => {
  const { t } = useTranslation();
  const downloadFile = useFileDownload();

  return useCallback(
    async (format: KgRdfFormat, vocab: KgRdfVocab = 'both'): Promise<boolean> => {
      const project = ProjectStorageRepository.getCurrentProject() as BesserProject | null;
      if (!project) {
        toast.error(t('export.kg.toasts.noProject'));
        return false;
      }

      const kgDiagram = getActiveDiagram(project, 'KnowledgeGraphDiagram');
      if (!kgDiagram || !kgDiagram.model) {
        toast.error(t('export.kg.toasts.noDiagram'));
        return false;
      }

      try {
        const { blob, filename: serverFilename } = await exportKgRdf({ diagram: kgDiagram, format, vocab });
        const fallback = kgDiagram.title
          ? `${kgDiagram.title.toLowerCase().replace(/\s+/g, '_')}.${format}`
          : FALLBACK_FILENAME_BY_FORMAT[format];

        downloadFile({ file: blob, filename: serverFilename ?? fallback });
        // Composed from two keys rather than concatenating an English
        // clause onto a translated one.
        const vocabSuffix =
          vocab === 'both' ? '' : t('export.kg.toasts.vocabSuffix', { vocab: vocab.toUpperCase() });
        toast.success(t('export.kg.toasts.exportCompleted', { format: format.toUpperCase(), suffix: vocabSuffix }));
        getPostHog()?.capture('generator_used', {
          generator_type: `kg_export_${format}`,
          diagram_type: project.currentDiagramType,
          vocab,
        });
        return true;
      } catch (error) {
        toast.error(kgApiErrorMessage(error, t, t('export.kg.toasts.failed')));
        return false;
      }
    },
    [downloadFile, t],
  );
};
