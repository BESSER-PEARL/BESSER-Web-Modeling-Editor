import { localStorageDiagramPrefix, localStorageLatest, localStorageProjectPrefix, localStorageLatestProject, localStorageProjectsList } from '../constant';
import { Diagram } from '../services/diagram/diagramSlice';
import { BesserProject } from '../components/modals/create-project-modal/CreateProjectModal';
import { uuid } from './uuid';

// Re-export for convenience
export type { BesserProject };

export const saveDiagramToLocalStorage = (diagram: Diagram) => {
  localStorage.setItem('latestDiagram', JSON.stringify(diagram));
};

export const getDiagramFromLocalStorage = (): Diagram | null => {
  const latestId: string | null = window.localStorage.getItem(localStorageLatest);

  let diagram: Diagram;

  if (latestId) {
    const latestDiagram: Diagram = JSON.parse(window.localStorage.getItem(localStorageDiagramPrefix + latestId)!);
    diagram = latestDiagram;
  } else {
    diagram = { id: uuid(), title: 'UMLClassDiagram', model: undefined, lastUpdate: new Date().toISOString() };
  }
  return diagram ?? null;
};

// Project management utilities
export const saveProjectToLocalStorage = (project: BesserProject) => {
  // Save the individual project
  localStorage.setItem(`${localStorageProjectPrefix}${project.id}`, JSON.stringify(project));
  
  // Update the latest project
  localStorage.setItem(localStorageLatestProject, project.id);
  
  // Update the projects list
  const existingProjectsList = getProjectsList();
  if (!existingProjectsList.includes(project.id)) {
    existingProjectsList.push(project.id);
    localStorage.setItem(localStorageProjectsList, JSON.stringify(existingProjectsList));
  }
};

// Get list of all project IDs
export const getProjectsList = (): string[] => {
  const projectsListStr = localStorage.getItem(localStorageProjectsList);
  if (projectsListStr) {
    try {
      return JSON.parse(projectsListStr) as string[];
    } catch {
      return [];
    }
  }
  return [];
};

// Get all projects
export const getAllProjectsFromLocalStorage = (): BesserProject[] => {
  const projectIds = getProjectsList();
  const projects: BesserProject[] = [];
  
  for (const id of projectIds) {
    const projectStr = localStorage.getItem(`${localStorageProjectPrefix}${id}`);
    if (projectStr) {
      try {
        const project = JSON.parse(projectStr) as BesserProject;
        if (project && project.createdAt) {
          projects.push(project);
        }
      } catch {
        console.warn(`Failed to parse project with ID: ${id}`);
      }
    }
  }
  
  // Sort by creation date (newest first)
  return projects.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

// Remove a project from localStorage
export const removeProjectFromLocalStorage = (projectId: string) => {
  // Remove the individual project
  localStorage.removeItem(`${localStorageProjectPrefix}${projectId}`);
  
  // Update the projects list
  const existingProjectsList = getProjectsList();
  const updatedList = existingProjectsList.filter(id => id !== projectId);
  localStorage.setItem(localStorageProjectsList, JSON.stringify(updatedList));
  
  // If this was the latest project, clear the latest project reference
  const latestProjectId = localStorage.getItem(localStorageLatestProject);
  if (latestProjectId === projectId) {
    localStorage.removeItem(localStorageLatestProject);
  }
};

export const getLastProjectFromLocalStorage = (): BesserProject | null => {
  const latestProjectId = localStorage.getItem(localStorageLatestProject);
  if (latestProjectId) {
    const latestProjectStr = localStorage.getItem(`${localStorageProjectPrefix}${latestProjectId}`);
    if (latestProjectStr) {
      try {
        const latestProject = JSON.parse(latestProjectStr) as BesserProject;
        if (latestProject && latestProject.createdAt) {
          return latestProject;
        }
      } catch {
        console.error('Error parsing latest project from localStorage:', latestProjectStr);
      }
    }
  }

  // Fallback: get the most recent project from the projects list
  const allProjects = getAllProjectsFromLocalStorage();
  return allProjects.length > 0 ? allProjects[0] : null;
};

// Check if we're currently in a project context
// This checks if the current diagram belongs to the latest project
export const isInProjectContext = (): boolean => {
  const latestDiagram = getDiagramFromLocalStorage();
  const latestProject = getLastProjectFromLocalStorage();
  
  if (!latestDiagram || !latestProject) {
    return false;
  }
  
  // Check if the current diagram ID is in the project's models array
  return latestProject.models?.includes(latestDiagram.id) || false;
};

// Clear project context (when creating standalone diagrams)
export const clearProjectContext = () => {
  localStorage.removeItem(localStorageLatestProject);
};

// Set project context (when working with a project)
export const setProjectContext = (projectId: string) => {
  localStorage.setItem(localStorageLatestProject, projectId);
  
  // Clear any type-based diagram storage to avoid conflicts
  clearTypeDiagramStorage();
};

// Clear type-based diagram storage to avoid conflicts with project diagrams
export const clearTypeDiagramStorage = () => {
  const diagramTypes = ['ClassDiagram', 'ObjectDiagram', 'StateMachineDiagram', 'AgentDiagram'];
  
  diagramTypes.forEach(type => {
    const key = `${localStorageDiagramPrefix}type_${type}`;
    localStorage.removeItem(key);
  });
};

export const addDiagramToCurrentProject = (diagramId: string): void => {
  if (isInProjectContext() && diagramId) {
    const currentProject = getLastProjectFromLocalStorage();
    if (currentProject && !currentProject.models.includes(diagramId)) {
      const updatedProject = {
        ...currentProject,
        models: [...(currentProject.models || []), diagramId]
      };
      saveProjectToLocalStorage(updatedProject);
      console.log('Diagram added to project:', diagramId, 'Project:', currentProject.name);
    }
  }
};
