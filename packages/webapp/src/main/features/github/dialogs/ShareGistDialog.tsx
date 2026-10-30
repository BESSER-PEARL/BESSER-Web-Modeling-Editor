import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { useProject } from '../../../app/hooks/useProject';
import { ProjectStorageRepository } from '../../../shared/services/storage/ProjectStorageRepository';
import { useFlushEditorModel } from '../hooks/useFlushEditorModel';
import { createGist } from '../../../shared/api/github';
import { CreateGistDialog } from './CreateGistDialog';

interface ShareGistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  githubSession: string | null;
}

/** Shares the current project as a GitHub gist (secret unless the user makes it public). */
export const ShareGistDialog: React.FC<ShareGistDialogProps> = ({ open, onOpenChange, githubSession }) => {
  const { t } = useTranslation();
  const { currentProject } = useProject();
  const flushEditor = useFlushEditorModel();
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (open && currentProject) setDescription(t('github.defaultGistDescription', { name: currentProject.name }));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreate = async () => {
    if (!currentProject || !githubSession) return;
    flushEditor();
    const project = ProjectStorageRepository.loadProject(currentProject.id);
    if (!project) {
      toast.error(t('github.toasts.couldNotLoadProjectData'));
      return;
    }
    setIsCreating(true);
    try {
      const result = await createGist(
        githubSession,
        project,
        description || t('github.defaultGistDescription', { name: project.name }),
        isPublic,
      );
      onOpenChange(false);
      toast.success(t('github.toasts.gistCreated'));
      window.open(result.gist_url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <CreateGistDialog
      open={open}
      isLoading={isCreating}
      description={description}
      isPublic={isPublic}
      onOpenChange={onOpenChange}
      onDescriptionChange={setDescription}
      onPublicChange={setIsPublic}
      onCreate={() => void handleCreate()}
    />
  );
};
