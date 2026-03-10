import { UMLDiagramType } from '@besser/wme';
import {
  BesserProject,
  ProjectDiagram,
  createDefaultProject,
  createEmptyDiagram,
  getActiveDiagram,
  isProject,
  MAX_DIAGRAMS_PER_TYPE,
  SupportedDiagramType,
  toSupportedDiagramType,
  toUMLDiagramType,
} from '../../types/project';
import { localStorageProjectPrefix, localStorageLatestProject, localStorageProjectsList } from '../../constant';

export class ProjectStorageRepository {
  
  // Save complete project (diagrams included)
  static saveProject(project: BesserProject): void {
    try {
      const projectKey = `${localStorageProjectPrefix}${project.id}`;
      localStorage.setItem(projectKey, JSON.stringify(project));
      
      // Update latest project pointer
      localStorage.setItem(localStorageLatestProject, project.id);
      
      // Update projects list
      this.updateProjectsList(project.id);
      
      // console.log('Project saved successfully:', project.name);
    } catch (error) {
      console.error('Error saving project:', error);
      throw new Error('Failed to save project');
    }
  }
  
  // Load complete project by ID
  static loadProject(projectId: string): BesserProject | null {
    try {
      const projectKey = `${localStorageProjectPrefix}${projectId}`;
      const projectData = localStorage.getItem(projectKey);
      
      if (!projectData) {
        console.warn(`Project not found: ${projectId}`);
        return null;
      }
      
      const project = JSON.parse(projectData);
      
      if (!isProject(project)) {
        console.warn(`Invalid project structure: ${projectId}`);
        return null;
      }
      
      return project;
    } catch (error) {
      console.error('Error loading project:', error);
      return null;
    }
  }
  
  // Get current active project
  static getCurrentProject(): BesserProject | null {
    const latestProjectId = localStorage.getItem(localStorageLatestProject);
    if (!latestProjectId) {
      return null;
    }
    
    return this.loadProject(latestProjectId);
  }
  
  // Get all projects (metadata only for performance)
  static getAllProjects(): Array<Pick<BesserProject, 'id' | 'name' | 'description' | 'owner' | 'createdAt'>> {
    const projectIds = this.getProjectsList();
    const projects: Array<Pick<BesserProject, 'id' | 'name' | 'description' | 'owner' | 'createdAt'>> = [];
    
    for (const id of projectIds) {
      const project = this.loadProject(id);
      if (project) {
        projects.push({
          id: project.id,
          name: project.name,
          description: project.description,
          owner: project.owner,
          createdAt: project.createdAt,
        });
      }
    }
    
    // Sort by creation date (newest first)
    return projects.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
  
  // Create and save new project
  static createNewProject(name: string, description: string, owner: string): BesserProject {
    const project = createDefaultProject(name, description, owner);
    this.saveProject(project);
    return project;
  }
  
  // Update specific diagram within project
  static updateDiagram(projectId: string, diagramType: SupportedDiagramType, diagram: ProjectDiagram, diagramIndex?: number): boolean {
    const project = this.loadProject(projectId);
    if (!project) {
      console.error(`Project not found: ${projectId}`);
      return false;
    }

    const index = diagramIndex ?? (project.currentDiagramIndices[diagramType] ?? 0);
    const diagrams = project.diagrams[diagramType];

    if (index < 0 || index >= diagrams.length) {
      console.error(`Diagram index ${index} out of bounds for ${diagramType}`);
      return false;
    }

    diagrams[index] = {
      ...diagram,
      lastUpdate: new Date().toISOString(),
    };

    this.saveProject(project);
    return true;
  }
  
  // Switch active diagram type
  static switchDiagramType(projectId: string, newType: SupportedDiagramType): ProjectDiagram | null {
    const project = this.loadProject(projectId);
    if (!project) {
      console.error(`Project not found: ${projectId}`);
      return null;
    }

    project.currentDiagramType = newType;
    this.saveProject(project);

    return getActiveDiagram(project, newType);
  }
  
  // Get current active diagram
  static getCurrentDiagram(projectId?: string): ProjectDiagram | null {
    const project = projectId ? this.loadProject(projectId) : this.getCurrentProject();
    if (!project) {
      return null;
    }

    return getActiveDiagram(project, project.currentDiagramType);
  }

  // Add a new diagram to a type (returns index, or null if at limit)
  static addDiagram(projectId: string, diagramType: SupportedDiagramType, title?: string): { index: number; diagram: ProjectDiagram } | null {
    const project = this.loadProject(projectId);
    if (!project) {
      return null;
    }

    const diagrams = project.diagrams[diagramType];
    if (diagrams.length >= MAX_DIAGRAMS_PER_TYPE) {
      return null;
    }

    const umlType = toUMLDiagramType(diagramType);
    const kind = diagramType === 'GUINoCodeDiagram' ? 'gui' : diagramType === 'QuantumCircuitDiagram' ? 'quantum' : undefined;
    const defaultTitle = title || `${diagramType.replace('Diagram', '')} ${diagrams.length + 1}`;
    const diagram = createEmptyDiagram(defaultTitle, umlType, kind);

    diagrams.push(diagram);
    const newIndex = diagrams.length - 1;
    project.currentDiagramIndices[diagramType] = newIndex;

    this.saveProject(project);
    return { index: newIndex, diagram };
  }

  // Remove a diagram by index (cannot remove the last one)
  static removeDiagram(projectId: string, diagramType: SupportedDiagramType, diagramIndex: number): boolean {
    const project = this.loadProject(projectId);
    if (!project) {
      return false;
    }

    const diagrams = project.diagrams[diagramType];
    if (diagrams.length <= 1 || diagramIndex < 0 || diagramIndex >= diagrams.length) {
      return false;
    }

    diagrams.splice(diagramIndex, 1);

    // Adjust active index
    const currentIndex = project.currentDiagramIndices[diagramType];
    if (currentIndex >= diagrams.length) {
      project.currentDiagramIndices[diagramType] = diagrams.length - 1;
    } else if (currentIndex > diagramIndex) {
      project.currentDiagramIndices[diagramType] = currentIndex - 1;
    }

    this.saveProject(project);
    return true;
  }

  // Switch active diagram index within a type
  static switchDiagramIndex(projectId: string, diagramType: SupportedDiagramType, index: number): ProjectDiagram | null {
    const project = this.loadProject(projectId);
    if (!project) {
      return null;
    }

    const diagrams = project.diagrams[diagramType];
    if (index < 0 || index >= diagrams.length) {
      return null;
    }

    project.currentDiagramIndices[diagramType] = index;
    this.saveProject(project);
    return diagrams[index];
  }

  // Get all diagrams for a type
  static getDiagramsForType(projectId: string, diagramType: SupportedDiagramType): ProjectDiagram[] {
    const project = this.loadProject(projectId);
    if (!project) {
      return [];
    }
    return project.diagrams[diagramType];
  }
  
  // Delete project
  static deleteProject(projectId: string): void {
    try {
      // Remove project data
      const projectKey = `${localStorageProjectPrefix}${projectId}`;
      localStorage.removeItem(projectKey);
      
      // Update projects list
      const projectsList = this.getProjectsList();
      const updatedList = projectsList.filter(id => id !== projectId);
      localStorage.setItem(localStorageProjectsList, JSON.stringify(updatedList));
      
      // Clear latest project if it was deleted
      const latestProjectId = localStorage.getItem(localStorageLatestProject);
      if (latestProjectId === projectId) {
        localStorage.removeItem(localStorageLatestProject);
      }
      
      // console.log('Project deleted successfully:', projectId);
    } catch (error) {
      console.error('Error deleting project:', error);
      throw new Error('Failed to delete project');
    }
  }
  
  // Helper: Update projects list
  private static updateProjectsList(projectId: string): void {
    const existingList = this.getProjectsList();
    if (!existingList.includes(projectId)) {
      existingList.push(projectId);
      localStorage.setItem(localStorageProjectsList, JSON.stringify(existingList));
    }
  }
  
  // Helper: Get projects list
  private static getProjectsList(): string[] {
    const listData = localStorage.getItem(localStorageProjectsList);
    if (listData) {
      try {
        return JSON.parse(listData) as string[];
      } catch {
        return [];
      }
    }
    return [];
  }
  
  // Migration helper: Check if project exists
  static projectExists(projectId: string): boolean {
    const projectKey = `${localStorageProjectPrefix}${projectId}`;
    return localStorage.getItem(projectKey) !== null;
  }
}
