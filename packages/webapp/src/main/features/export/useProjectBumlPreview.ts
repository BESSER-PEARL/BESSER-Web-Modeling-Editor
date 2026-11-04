import { useCallback } from 'react';
import { exportProjectAsBuml } from '../../shared/api/conversion';
import { BesserProject } from '../../shared/types/project';
import { buildProjectPayloadForBackend } from '../../shared/utils/projectExportUtils';
import { ProjectStorageRepository } from '../../shared/services/storage/ProjectStorageRepository';

export const useProjectBumlPreview = () => {
  return useCallback(async (project: BesserProject) => {
    if (!project) {
      throw new Error('No project is available for BUML preview.');
    }

    // Always get fresh data from storage to avoid stale Redux state
    const freshProject = ProjectStorageRepository.loadProject(project.id);
    const projectPayload = buildProjectPayloadForBackend(freshProject || project);

    const { blob } = await exportProjectAsBuml(projectPayload);
    return blob.text();
  }, []);
};
