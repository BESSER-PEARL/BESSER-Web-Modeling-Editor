import { UMLDiagramType } from '@besser/wme';
import { BesserProject, ProjectDiagram, createDefaultProject, isProject, SupportedDiagramType, toSupportedDiagramType } from '../../types/project';
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
  static updateDiagram(projectId: string, diagramType: SupportedDiagramType, diagram: ProjectDiagram): boolean {
    const project = this.loadProject(projectId);
    if (!project) {
      console.error(`Project not found: ${projectId}`);
      return false;
    }
    
    // Update the specific diagram
    project.diagrams[diagramType] = {
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
    
    return project.diagrams[newType];
  }
  
  // Get current active diagram
  static getCurrentDiagram(projectId?: string): ProjectDiagram | null {
    const project = projectId ? this.loadProject(projectId) : this.getCurrentProject();
    if (!project) {
      return null;
    }
    
    return project.diagrams[project.currentDiagramType];
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
