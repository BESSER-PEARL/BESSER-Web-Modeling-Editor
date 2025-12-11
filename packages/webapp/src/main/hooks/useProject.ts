import { UMLDiagramType, UMLModel } from '@besser/wme';
import { BesserProject } from '../types/project';
import { ProjectStorageRepository } from '../services/storage/ProjectStorageRepository';
import { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../components/store/hooks';
import {
  loadProjectThunk,
  createProjectThunk,
  updateCurrentDiagramThunk,
  switchDiagramTypeThunk,
  clearError,
  updateProjectInfo,
  selectCurrentProject,
  selectCurrentDiagram,
  selectCurrentDiagramType,
  selectCurrentUMLDiagramType,
  selectLoading,
  selectError,
} from '../services/project/projectSlice';

export const useProject = () => {
  const dispatch = useAppDispatch();
  
  // Redux state selectors
  const currentProject = useAppSelector(state => state.project.currentProject);
  const currentDiagram = useAppSelector(state => state.project.currentDiagram);
  const currentDiagramType = useAppSelector(state => state.project.currentDiagramType);
  const loading = useAppSelector(state => state.project.loading);
  const error = useAppSelector(state => state.project.error);
  
  // Actions
  const createProject = useCallback(async (name: string, description: string, owner: string) => {
    const result = await dispatch(createProjectThunk({ name, description, owner }));
    if (createProjectThunk.fulfilled.match(result)) {
      return result.payload;
    }
    throw new Error(result.payload as string || 'Failed to create project');
  }, [dispatch]);
  
  const loadProject = useCallback(async (projectId?: string) => {
    const result = await dispatch(loadProjectThunk(projectId));
    if (loadProjectThunk.fulfilled.match(result)) {
      return result.payload;
    }
    throw new Error(result.payload as string || 'Failed to load project');
  }, [dispatch]);
  
  const switchDiagramType = useCallback((diagramType: UMLDiagramType) => {
    console.log('switchDiagramType called with:', diagramType);
    
    if (!currentProject) {
      throw new Error('No active project');
    }
    
    dispatch(switchDiagramTypeThunk({ diagramType }));
  }, [dispatch, currentProject]);
  
  const updateCurrentDiagram = useCallback((model: UMLModel) => {
    if (!currentProject) {
      throw new Error('No active project');
    }
    
    dispatch(updateCurrentDiagramThunk({ model }));
  }, [dispatch, currentProject]);
  
  const clearProjectError = useCallback(() => {
    dispatch(clearError());
  }, [dispatch]);
  
  const updateProject = useCallback((updates: Partial<Pick<BesserProject, 'name' | 'description' | 'owner'>>) => {
    dispatch(updateProjectInfo(updates));
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
        await createProject('New Project', 'New project with all diagram types', 'User');
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
      console.log('[Export] Force refreshing project data from storage');
      project = ProjectStorageRepository.loadProject(project.id);
      if (!project) {
        throw new Error('Failed to reload project data');
      }
    }
    
    // Use the simple JSON export function instead of ZIP export
    const { exportProjectAsJson } = await import('../services/export/useExportProjectJSON');
    await exportProjectAsJson(project);
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
