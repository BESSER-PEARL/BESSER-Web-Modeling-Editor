import { useCallback } from 'react';
import { BACKEND_URL } from '../../constant';
import { BesserProject } from '../../types/project';
import { flattenProjectForBackend } from './projectExportUtils';

export const useProjectBumlPreview = () => {
  return useCallback(async (project: BesserProject) => {
    if (!project) {
      throw new Error('No project is available for BUML preview.');
    }

    const projectPayload = flattenProjectForBackend(project);

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
