// Import a class diagram by reverse-engineering an external database via the
// backend `/db-upload-sqlite`, `/db-introspect`, and `/db-to-domain-model`
// endpoints. Mirrors the shape of useImportDiagramFromKG.

import { useCallback } from 'react';
import { UMLDiagramType } from '@besser/wme';
import { BACKEND_URL } from '../../shared/constants/constant';
import { useAppDispatch } from '../../app/store/hooks';
import { uuid } from '../../shared/utils/uuid';
import { bumpEditorRevision } from '../../app/store/workspaceSlice';
import { displayError } from '../../app/store/errorManagementSlice';
import { ProjectStorageRepository } from '../../shared/services/storage/ProjectStorageRepository';
import { MAX_DIAGRAMS_PER_TYPE, type ProjectDiagram } from '../../shared/types/project';

export type SupportedDbDialect =
  | 'postgresql'
  | 'mysql'
  | 'sqlite'
  | 'mssql'
  | 'oracle';

export interface DbConnectionParams {
  dialect?: SupportedDbDialect;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  database?: string;
  raw_url?: string;
  database_token?: string;
  options?: Record<string, string>;
}

export interface DbIntrospectResult {
  schemas: Record<string, string[]>;
  warnings: string[];
}

export interface DbUploadResult {
  database_token: string;
  filename: string;
}

const parseError = async (response: Response, fallback: string): Promise<string> => {
  try {
    const data = await response.json();
    if (data?.detail) {
      return typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
    }
  } catch {
    /* ignore */
  }
  return `${fallback} (HTTP ${response.status})`;
};

export const useImportDiagramFromDb = () => {
  const dispatch = useAppDispatch();

  const uploadSqliteFile = useCallback(async (file: File): Promise<DbUploadResult> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${BACKEND_URL}/db-upload-sqlite`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      throw new Error(await parseError(response, 'Upload failed'));
    }
    return response.json();
  }, []);

  const introspect = useCallback(async (connection: DbConnectionParams): Promise<DbIntrospectResult> => {
    const response = await fetch(`${BACKEND_URL}/db-introspect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connection }),
    });
    if (!response.ok) {
      throw new Error(await parseError(response, 'Introspection failed'));
    }
    return response.json();
  }, []);

  const importSelected = useCallback(
    async (connection: DbConnectionParams, selection: Record<string, string[]>) => {
      try {
        const currentProject = ProjectStorageRepository.getCurrentProject();
        if (!currentProject) {
          throw new Error('No project is currently open. Please create or open a project first.');
        }

        const existing = currentProject.diagrams.ClassDiagram ?? [];
        if (existing.length >= MAX_DIAGRAMS_PER_TYPE) {
          throw new Error(
            `Project already has ${MAX_DIAGRAMS_PER_TYPE} class diagrams. Remove one before importing.`,
          );
        }

        const response = await fetch(`${BACKEND_URL}/db-to-domain-model`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ connection, selection }),
        });
        if (!response.ok) {
          throw new Error(await parseError(response, 'Import failed'));
        }
        const data = await response.json();
        if (!data?.model) {
          throw new Error('Backend returned no model.');
        }

        const newId = uuid();
        const baseTitle = data.title || 'Imported Class Diagram';
        const existingTitles = new Set(existing.map((d) => d.title.trim().toLowerCase()));
        let uniqueTitle = baseTitle;
        if (existingTitles.has(uniqueTitle.trim().toLowerCase())) {
          for (let attempt = 2; attempt <= MAX_DIAGRAMS_PER_TYPE + 1; attempt += 1) {
            const candidate = `${baseTitle} ${attempt}`;
            if (!existingTitles.has(candidate.trim().toLowerCase())) {
              uniqueTitle = candidate;
              break;
            }
          }
        }

        const importedDiagram: ProjectDiagram = {
          id: newId,
          title: uniqueTitle,
          model: { ...data.model, type: UMLDiagramType.ClassDiagram },
          lastUpdate: new Date().toISOString(),
          description: 'Imported from external database',
        };

        const newIndex = existing.length;
        const updatedProject = {
          ...currentProject,
          diagrams: {
            ...currentProject.diagrams,
            ClassDiagram: [...existing, importedDiagram],
          },
          currentDiagramIndices: {
            ...currentProject.currentDiagramIndices,
            ClassDiagram: newIndex,
          },
        };
        ProjectStorageRepository.saveProject(updatedProject);

        if (currentProject.currentDiagramType === 'ClassDiagram') {
          dispatch(bumpEditorRevision());
        }

        return {
          success: true,
          diagramTitle: uniqueTitle,
          message: `Class diagram "${uniqueTitle}" imported successfully and added to project "${currentProject.name}".`,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error occurred during import';
        dispatch(displayError('Import failed', `Could not import diagram from database: ${errorMessage}`));
        throw error;
      }
    },
    [dispatch],
  );

  return { uploadSqliteFile, introspect, importSelected };
};
