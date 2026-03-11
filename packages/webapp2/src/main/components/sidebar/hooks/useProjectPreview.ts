import { useState, useCallback } from 'react';
import { toast } from 'react-toastify';
import { ProjectStorageRepository } from '../../../services/storage/ProjectStorageRepository';
import { buildExportableProjectPayload } from '../../../services/export/projectExportUtils';
import { useProjectBumlPreview } from '../../../services/export/useProjectBumlPreview';
import { normalizeProjectName } from '../../../utils/projectName';
import { downloadJson, downloadFile, copyToClipboard } from '../../../utils/download';
import type { BesserProject } from '../../../types/project';

const sanitizeRepoName = (name: string): string => {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
};

interface UseProjectPreviewOptions {
  currentProject: BesserProject | null;
}

export function useProjectPreview({ currentProject }: UseProjectPreviewOptions) {
  const generateProjectBumlPreview = useProjectBumlPreview();

  const [isProjectPreviewOpen, setIsProjectPreviewOpen] = useState(false);
  const [projectPreviewJson, setProjectPreviewJson] = useState('');
  const [projectBumlPreview, setProjectBumlPreview] = useState('');
  const [projectBumlPreviewError, setProjectBumlPreviewError] = useState('');
  const [isProjectBumlPreviewLoading, setIsProjectBumlPreviewLoading] = useState(false);

  const handleOpenProjectPreview = useCallback(() => {
    if (!currentProject) {
      toast.error('Create or load a project first.');
      return;
    }

    const freshProject = ProjectStorageRepository.loadProject(currentProject.id) || currentProject;
    const exportData = {
      project: buildExportableProjectPayload(freshProject),
      exportedAt: new Date().toISOString(),
      version: '2.0.0',
    };
    setProjectPreviewJson(JSON.stringify(exportData, null, 2));
    setProjectBumlPreview('');
    setProjectBumlPreviewError('');
    setIsProjectBumlPreviewLoading(false);
    setIsProjectPreviewOpen(true);
  }, [currentProject]);

  const handleCopyProjectPreview = useCallback(async () => {
    const success = await copyToClipboard(projectPreviewJson);
    if (success) {
      toast.success('Project JSON copied.');
    } else {
      toast.error('Failed to copy project JSON.');
    }
  }, [projectPreviewJson]);

  const handleDownloadProjectPreview = useCallback(() => {
    const projectName = sanitizeRepoName(currentProject?.name || 'project') || 'project';
    downloadJson(projectPreviewJson, `${projectName}_preview.json`);
  }, [projectPreviewJson, currentProject?.name]);

  const handleRequestProjectBumlPreview = useCallback(async () => {
    if (!currentProject) {
      toast.error('Create or load a project first.');
      return;
    }

    const freshProject = ProjectStorageRepository.loadProject(currentProject.id) || currentProject;
    setIsProjectBumlPreviewLoading(true);
    setProjectBumlPreviewError('');

    try {
      const bumlPreview = await generateProjectBumlPreview(freshProject);
      setProjectBumlPreview(bumlPreview);
      toast.success('Project B-UML preview generated.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate B-UML preview.';
      setProjectBumlPreview('');
      setProjectBumlPreviewError(message);
      toast.error(`Failed to generate B-UML preview: ${message}`);
    } finally {
      setIsProjectBumlPreviewLoading(false);
    }
  }, [currentProject, generateProjectBumlPreview]);

  const handleCloseProjectPreview = useCallback(() => {
    setIsProjectPreviewOpen(false);
    setProjectPreviewJson('');
    setProjectBumlPreview('');
    setProjectBumlPreviewError('');
    setIsProjectBumlPreviewLoading(false);
  }, []);

  const handleCopyProjectBumlPreview = useCallback(async () => {
    if (!projectBumlPreview) {
      toast.error('No B-UML preview to copy.');
      return;
    }

    const success = await copyToClipboard(projectBumlPreview);
    if (success) {
      toast.success('Project B-UML copied.');
    } else {
      toast.error('Failed to copy B-UML preview.');
    }
  }, [projectBumlPreview]);

  const handleDownloadProjectBumlPreview = useCallback(() => {
    if (!projectBumlPreview) {
      toast.error('No B-UML preview to download.');
      return;
    }

    const normalizedName =
      normalizeProjectName(currentProject?.name || 'project')
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '_') || 'project';

    downloadFile(projectBumlPreview, `${normalizedName}_preview.py`, 'text/x-python');
  }, [projectBumlPreview, currentProject?.name]);

  return {
    // State
    isProjectPreviewOpen,
    projectPreviewJson,
    projectBumlPreview,
    projectBumlPreviewError,
    isProjectBumlPreviewLoading,

    // Handlers
    handleOpenProjectPreview,
    handleCopyProjectPreview,
    handleDownloadProjectPreview,
    handleRequestProjectBumlPreview,
    handleCloseProjectPreview,
    handleCopyProjectBumlPreview,
    handleDownloadProjectBumlPreview,

    // Expose for assistant export effect
    generateProjectBumlPreview,
  };
}
