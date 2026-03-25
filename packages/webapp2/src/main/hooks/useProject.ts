import { UMLDiagramType, UMLModel } from '@besser/wme';
import { BesserProject } from '../types/project';
import { ProjectStorageRepository } from '../services/storage/ProjectStorageRepository';
import { exportProjectAsJson } from '../services/export/useExportProjectJSON';
import { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { normalizeProjectName } from '../utils/projectName';
import {
  loadProjectThunk,
  createProjectThunk,
  updateDiagramModelThunk,
  switchDiagramTypeThunk,
  clearError,
  updateProjectInfo,
  selectProject,
  selectActiveDiagram,
  selectActiveDiagramType,
  selectWorkspaceLoading,
  selectWorkspaceError,
} from '../store/workspaceSlice';

export const useProject = () => {
  const dispatch = useAppDispatch();
  
  // Redux state selectors (unified workspace slice)
  const currentProject = useAppSelector(selectProject);
  const currentDiagram = useAppSelector(selectActiveDiagram);
  const currentDiagramType = useAppSelector(selectActiveDiagramType);
  const loading = useAppSelector(selectWorkspaceLoading);
  const error = useAppSelector(selectWorkspaceError);
  
  // Actions
  const createProject = useCallback(async (name: string, description: string, owner: string) => {
    const normalizedName = normalizeProjectName(name);
    if (!normalizedName) {
      throw new Error('Project name is required');
    }

    const result = await dispatch(createProjectThunk({ name: normalizedName, description, owner }));
    if (createProjectThunk.fulfilled.match(result)) {
      return result.payload;
    }
    throw new Error(result.error?.message || 'Failed to create project');
  }, [dispatch]);

  const loadProject = useCallback(async (projectId?: string) => {
    const result = await dispatch(loadProjectThunk(projectId));
    if (loadProjectThunk.fulfilled.match(result)) {
      return result.payload;
    }
    throw new Error(result.error?.message || 'Failed to load project');
  }, [dispatch]);
  
  const switchDiagramType = useCallback(async (diagramType: UMLDiagramType) => {
    if (!currentProject) {
      throw new Error('No active project');
    }

    await dispatch(switchDiagramTypeThunk({ diagramType }));
  }, [dispatch, currentProject]);
  
  const updateCurrentDiagram = useCallback((model: UMLModel) => {
    if (!currentProject) {
      throw new Error('No active project');
    }
    
    dispatch(updateDiagramModelThunk({ model }));
  }, [dispatch, currentProject]);
  
  const clearProjectError = useCallback(() => {
    dispatch(clearError());
  }, [dispatch]);
  
  const updateProject = useCallback((updates: Partial<Pick<BesserProject, 'name' | 'description' | 'owner'>>) => {
    const normalizedUpdates = updates.name !== undefined
      ? { ...updates, name: normalizeProjectName(updates.name) }
      : updates;

    dispatch(updateProjectInfo(normalizedUpdates));
  }, [dispatch]);
  
  // Utility functions
  const getAllProjects = useCallback(() => {
    return ProjectStorageRepository.getAllProjects();
  }, []);
  
  const deleteProject = useCallback(async (projectId: string) => {
    ProjectStorageRepository.deleteProject(projectId);
    
    // If we deleted the current project, load another one or create new
    if (currentProject?.id === projectId) {
      const remainingProjects = ProjectStorageRepository.getAllProjects();
      if (remainingProjects.length > 0) {
        await loadProject(remainingProjects[0].id);
      } else {
        await createProject('New_Project', 'New project with all diagram types', 'User');
      }
    }
  }, [currentProject?.id, loadProject, createProject]);
  
  const exportProject = useCallback(async (projectId?: string, forceRefresh: boolean = false) => {
    let project = projectId ? 
      ProjectStorageRepository.loadProject(projectId) : 
      currentProject;
    
    if (!project) {
      throw new Error('No project to export');
    }
    
    // If forceRefresh is true, reload the project from storage to get the latest data
    if (forceRefresh) {
      project = ProjectStorageRepository.loadProject(project.id);
      if (!project) {
        throw new Error('Failed to reload project data');
      }
    }
    
    // Use the simple JSON export function instead of ZIP export
    exportProjectAsJson(project);
  }, [currentProject]);
  
  return {
    // State
    currentProject,
    currentDiagram,
    currentDiagramType,
    loading,
    error,
    
    // Actions
    createProject,
    loadProject,
    switchDiagramType,
    updateCurrentDiagram,
    clearProjectError,
    updateProject,
    
    // Utilities
    getAllProjects,
    deleteProject,
    exportProject,
  };
};
