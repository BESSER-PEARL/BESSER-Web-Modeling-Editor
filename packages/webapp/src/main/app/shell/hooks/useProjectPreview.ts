import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { ProjectStorageRepository } from '../../../shared/services/storage/ProjectStorageRepository';
import { buildProjectExportEnvelope } from '../../../shared/utils/projectExportUtils';
import { useProjectBumlPreview } from '../../../features/export/useProjectBumlPreview';
import { normalizeProjectName } from '../../../shared/utils/projectName';
import { downloadJson, downloadFile, copyToClipboard } from '../../../shared/utils/download';
import type { BesserProject } from '../../../shared/types/project';

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
  const { t } = useTranslation();
  const generateProjectBumlPreview = useProjectBumlPreview();

  const [isProjectPreviewOpen, setIsProjectPreviewOpen] = useState(false);
  const [projectPreviewJson, setProjectPreviewJson] = useState('');
  const [projectBumlPreview, setProjectBumlPreview] = useState('');
  const [projectBumlPreviewError, setProjectBumlPreviewError] = useState('');
  const [isProjectBumlPreviewLoading, setIsProjectBumlPreviewLoading] = useState(false);

  const handleOpenProjectPreview = useCallback(() => {
    if (!currentProject) {
      toast.error(t('project.toasts.createOrLoadFirst'));
      return;
    }

    const freshProject = ProjectStorageRepository.loadProject(currentProject.id) || currentProject;
    const exportData = buildProjectExportEnvelope(freshProject);
    setProjectPreviewJson(JSON.stringify(exportData, null, 2));
    setProjectBumlPreview('');
    setProjectBumlPreviewError('');
    setIsProjectBumlPreviewLoading(false);
    setIsProjectPreviewOpen(true);
  }, [currentProject]);

  const handleCopyProjectPreview = useCallback(async () => {
    const success = await copyToClipboard(projectPreviewJson);
    if (success) {
      toast.success(t('project.preview.toasts.jsonCopied'));
    } else {
      toast.error(t('project.preview.toasts.jsonCopyFailed'));
    }
  }, [projectPreviewJson]);

  const handleDownloadProjectPreview = useCallback(() => {
    const projectName = sanitizeRepoName(currentProject?.name || 'project') || 'project';
    downloadJson(projectPreviewJson, `${projectName}_preview.json`);
  }, [projectPreviewJson, currentProject?.name]);

  const handleRequestProjectBumlPreview = useCallback(async () => {
    if (!currentProject) {
      toast.error(t('project.toasts.createOrLoadFirst'));
      return;
    }

    const freshProject = ProjectStorageRepository.loadProject(currentProject.id) || currentProject;
    setIsProjectBumlPreviewLoading(true);
    setProjectBumlPreviewError('');

    try {
      const bumlPreview = await generateProjectBumlPreview(freshProject);
      setProjectBumlPreview(bumlPreview);
      // toast.success('Project B-UML preview generated.');
    } catch (error) {
      const message = error instanceof Error ? error.message : t('project.preview.toasts.bumlFailedFallback');
      setProjectBumlPreview('');
      setProjectBumlPreviewError(message);
      toast.error(t('project.preview.toasts.bumlFailed', { message }));
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
      toast.error(t('project.preview.toasts.noBumlToCopy'));
      return;
    }

    const success = await copyToClipboard(projectBumlPreview);
    if (success) {
      toast.success(t('project.preview.toasts.bumlCopied'));
    } else {
      toast.error(t('project.preview.toasts.bumlCopyFailed'));
    }
  }, [projectBumlPreview]);

  const handleDownloadProjectBumlPreview = useCallback(() => {
    if (!projectBumlPreview) {
      toast.error(t('project.preview.toasts.noBumlToDownload'));
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
