import { useState, useCallback } from 'react';
import { toast } from 'react-toastify';
import { useImportDiagramPictureFromImage } from '../../../services/import/useImportDiagramPicture';
import { useImportDiagramFromKG } from '../../../services/import/useImportDiagramKG';
import type { AssistantImportMode } from '../dialogs';
import type { BesserProject } from '../../../types/project';

interface UseAssistantImportOptions {
  currentProject: BesserProject | null;
}

export function useAssistantImport({ currentProject }: UseAssistantImportOptions) {
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
      toast.error('Create or load a project first.');
      return;
    }
    setAssistantImportMode(mode);
    setAssistantApiKey('');
    setAssistantSelectedFile(null);
    setAssistantImportError('');
  }, [currentProject]);

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
        setAssistantImportError('Only PNG or JPEG files are allowed.');
        return;
      }
    } else {
      const allowedTypes = ['application/json', 'text/turtle', 'application/x-turtle'];
      const allowedExtensions = ['.json', '.ttl', '.rdf'];
      const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
      if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(extension)) {
        setAssistantSelectedFile(null);
        setAssistantImportError('Only TTL, RDF, or JSON files are allowed.');
        return;
      }
    }

    setAssistantSelectedFile(file);
    setAssistantImportError('');
  }, [assistantImportMode]);

  const handleAssistantImport = useCallback(async () => {
    if (!assistantImportMode || !assistantSelectedFile || !assistantApiKey || assistantImportError) {
      return;
    }

    setIsAssistantImporting(true);
    try {
      const result =
        assistantImportMode === 'image'
          ? await importDiagramPictureFromImage(assistantSelectedFile, assistantApiKey)
          : await importDiagramFromKG(assistantSelectedFile, assistantApiKey);
      toast.success(result.message);
      resetAssistantImportDialog();
    } catch (error) {
      toast.error(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsAssistantImporting(false);
    }
  }, [assistantImportMode, assistantSelectedFile, assistantApiKey, assistantImportError, importDiagramPictureFromImage, importDiagramFromKG, resetAssistantImportDialog]);

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
