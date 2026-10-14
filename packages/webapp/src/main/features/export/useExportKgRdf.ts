// Export the active Knowledge Graph diagram as OWL (RDF/XML) or Turtle (TTL)
// via the backend's /export-kg-rdf/{fmt} endpoint, then trigger a browser
// download. Triggered from the Generate menu when in a KnowledgeGraphDiagram
// context.
import { useCallback } from 'react';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';

import { exportKgRdf, kgApiErrorMessage, type KgRdfFormat, type KgRdfVocab } from '../../shared/api/knowledgeGraph';
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
    async (format: KgRdfFormat, vocab: KgRdfVocab = 'both'): Promise<void> => {
      const project = ProjectStorageRepository.getCurrentProject() as BesserProject | null;
      if (!project) {
        toast.error(t('export.kg.toasts.noProject'));
        return;
      }

      const kgDiagram = getActiveDiagram(project, 'KnowledgeGraphDiagram');
      if (!kgDiagram || !kgDiagram.model) {
        toast.error(t('export.kg.toasts.noDiagram'));
        return;
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
      } catch (error) {
        toast.error(kgApiErrorMessage(error, t, t('export.kg.toasts.failed')));
      }
    },
    [downloadFile, t],
  );
};
