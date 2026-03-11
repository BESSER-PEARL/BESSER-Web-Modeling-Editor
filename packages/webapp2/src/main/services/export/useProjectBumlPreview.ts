import { useCallback } from 'react';
import { BACKEND_URL } from '../../constant';
import { BesserProject } from '../../types/project';
import { buildProjectPayloadForBackend } from './projectExportUtils';
import { ProjectStorageRepository } from '../storage/ProjectStorageRepository';

export const useProjectBumlPreview = () => {
  return useCallback(async (project: BesserProject) => {
    if (!project) {
      throw new Error('No project is available for BUML preview.');
    }

    // Always get fresh data from storage to avoid stale Redux state
    const freshProject = ProjectStorageRepository.loadProject(project.id);
    const projectPayload = buildProjectPayloadForBackend(freshProject || project);

    const response = await fetch(`${BACKEND_URL}/export-project_as_buml`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(projectPayload),
    });

    if (!response.ok) {
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const errorText = await response.text();
        if (errorText) {
          errorMessage = errorText;
        }
      } catch (error) {
        console.error('Failed to parse BUML preview error response:', error);
      }
      throw new Error(errorMessage);
    }

    return response.text();
  }, []);
};
