import { useState, useCallback } from 'react';
import { toast } from 'react-toastify';
import { reportError } from '../../../shared/services/errors/reportError';
import { errorProperties, track } from '../../../shared/services/analytics/events';
import { useTranslation } from 'react-i18next';
import { useImportDiagramPictureFromImage } from '../../../features/import/useImportDiagramPicture';
import { useImportDiagramFromKG } from '../../../features/import/useImportDiagramKG';
import type { AssistantImportMode } from '../../../features/assistant/components/AssistantImportDialog';
import type { BesserProject } from '../../../shared/types/project';

interface UseAssistantImportOptions {
  currentProject: BesserProject | null;
}

export function useAssistantImport({ currentProject }: UseAssistantImportOptions) {
  const { t } = useTranslation();
  const importDiagramPictureFromImage = useImportDiagramPictureFromImage();
  const importDiagramFromKG = useImportDiagramFromKG();

  const [assistantImportMode, setAssistantImportMode] = useState<AssistantImportMode>(null);
  const [assistantApiKey, setAssistantApiKey] = useState('');
  const [assistantSelectedFile, setAssistantSelectedFile] = useState<File | null>(null);
  const [assistantImportError, setAssistantImportError] = useState('');
  const [isAssistantImporting, setIsAssistantImporting] = useState(false);

  const resetAssistantImportDialog = useCallback(() => {
    setAssistantImportMode(null);
    setAssistantApiKey('');
    setAssistantSelectedFile(null);
    setAssistantImportError('');
    setIsAssistantImporting(false);
  }, []);

  const openAssistantImportDialog = useCallback((mode: Exclude<AssistantImportMode, null>) => {
    if (!currentProject) {
      reportError(t('assistant.import.errors.noProject'));
      return;
    }
    setAssistantImportMode(mode);
    setAssistantApiKey('');
    setAssistantSelectedFile(null);
    setAssistantImportError('');
  }, [currentProject, t]);

  const handleAssistantFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file || !assistantImportMode) {
      setAssistantSelectedFile(null);
      setAssistantImportError('');
      return;
    }

    if (assistantImportMode === 'image') {
      const allowedTypes = ['image/png', 'image/jpeg'];
      if (!allowedTypes.includes(file.type)) {
        setAssistantSelectedFile(null);
        setAssistantImportError(t('assistant.import.errors.imageType'));
        return;
      }
    } else {
      const allowedTypes = ['application/json', 'text/turtle', 'application/x-turtle'];
      const allowedExtensions = ['.json', '.ttl', '.rdf'];
      const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
      if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(extension)) {
        setAssistantSelectedFile(null);
        setAssistantImportError(t('assistant.import.errors.kgType'));
        return;
      }
    }

    setAssistantSelectedFile(file);
    setAssistantImportError('');
  }, [assistantImportMode, t]);

  const handleAssistantImport = useCallback(async () => {
    if (!assistantImportMode || !assistantSelectedFile || !assistantApiKey || assistantImportError) {
      return;
    }

    setIsAssistantImporting(true);
    // Read by an LLM: from a picture, or from a knowledge-graph file.
    const format = assistantImportMode === 'image' ? 'image' : 'kg_file';
    try {
      const result =
        assistantImportMode === 'image'
          ? await importDiagramPictureFromImage(assistantSelectedFile, assistantApiKey)
          : await importDiagramFromKG(assistantSelectedFile, assistantApiKey);
      toast.success(result.message);
      track('diagram_imported', { format, diagram_type: result.diagramType, source: 'ai' });
      resetAssistantImportDialog();
    } catch (error) {
      reportError(t('assistant.import.errors.importFailed', {
        error: error instanceof Error ? error.message : t('assistant.errors.unknownError'),
      }), { error });
      track('diagram_import_failed', { format, source: 'ai', reason: 'request', ...errorProperties(error) });
    } finally {
      setIsAssistantImporting(false);
    }
  }, [assistantImportMode, assistantSelectedFile, assistantApiKey, assistantImportError, importDiagramPictureFromImage, importDiagramFromKG, resetAssistantImportDialog, t]);

  return {
    // State
    assistantImportMode,
    assistantApiKey,
    assistantSelectedFile,
    assistantImportError,
    isAssistantImporting,

    // Setters
    setAssistantApiKey,

    // Handlers
    openAssistantImportDialog,
    resetAssistantImportDialog,
    handleAssistantFileChange,
    handleAssistantImport,
  };
}
