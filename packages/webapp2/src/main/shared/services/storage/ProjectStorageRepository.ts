import {
  ALL_DIAGRAM_TYPES,
  BesserProject,
  ProjectDiagram,
  createDefaultProject,
  createEmptyDiagram,
  ensureProjectMigrated,
  getActiveDiagram,
  isProject,
  MAX_DIAGRAMS_PER_TYPE,
  SupportedDiagramType,
  toUMLDiagramType,
} from '../../types/project';
import { localStorageProjectPrefix, localStorageLatestProject, localStorageProjectsList } from '../../constants/constant';
import { checkLocalStorageQuota } from '../../utils/localStorageQuota';

export class ProjectStorageRepository {

  // ── Write coalescing ────────────────────────────────────────────────────
  // Multiple async thunks may call saveProject in quick succession.
  // Although localStorage is synchronous, reentrant calls (e.g. from
  // notifyChange listeners that trigger another save) could interleave.
  // We use a simple flag to detect reentrant writes and coalesce them:
  // the latest project snapshot wins.

  private static isWriting = false;
  private static pendingProject: BesserProject | null = null;

  // ── Change notification mechanism ──────────────────────────────────────
  // Editors (GrapesJS, Quantum, etc.) write directly to localStorage for
  // performance. This listener pattern lets Redux stay in sync without
  // those editors needing to know about the store.

  private static changeListeners: Array<() => void> = [];

  /**
   * Monotonically increasing counter bumped on every write.
   * Consumers can compare against a cached value to detect real changes
   * and avoid redundant Redux dispatches.
   */
  static revision = 0;

  /**
   * When > 0, notifyChange() is suppressed.  Used by Redux thunks that
   * already update the store themselves (via saveProject inside a thunk
   * whose fulfilled handler writes to Redux).  Avoids a redundant
   * syncProjectFromStorage dispatch after every thunk-driven save.
   */
  private static suppressDepth = 0;

  /**
   * Execute `fn` without firing change listeners.  Calls can nest safely.
   *
   * Usage (in workspaceSlice reducers that call saveProject):
   *   ProjectStorageRepository.withoutNotify(() => {
   *     ProjectStorageRepository.saveProject(project);
   *   });
   */
  static withoutNotify(fn: () => void): void {
    this.suppressDepth += 1;
    try {
      fn();
    } finally {
      this.suppressDepth -= 1;
    }
  }

  /**
   * Register a callback that fires after any project write operation.
   * Returns an unsubscribe function.
   */
  static onProjectChange(listener: () => void): () => void {
    this.changeListeners.push(listener);
    return () => {
      this.changeListeners = this.changeListeners.filter(l => l !== listener);
    };
  }

  private static notifyChange(): void {
    if (this.suppressDepth > 0) return;
    this.revision += 1;
    for (const listener of this.changeListeners) {
      try {
        listener();
      } catch (e) {
        console.error('[ProjectStorageRepository] Change listener error:', e);
      }
    }
  }

  // Save complete project (diagrams included)
  static saveProject(project: BesserProject): void {
    // Coalesce reentrant / rapid-fire writes: if a save is already in
    // progress, queue the latest snapshot and return immediately.
    if (ProjectStorageRepository.isWriting) {
      ProjectStorageRepository.pendingProject = project;
      return;
    }

    ProjectStorageRepository.isWriting = true;
    try {
      const projectKey = `${localStorageProjectPrefix}${project.id}`;
      localStorage.setItem(projectKey, JSON.stringify(project));

      // Update latest project pointer
      localStorage.setItem(localStorageLatestProject, project.id);

      // Update projects list
      this.updateProjectsList(project.id);
    } catch (error) {
      console.error('Error saving project:', error);
      throw new Error('Failed to save project');
    } finally {
      ProjectStorageRepository.isWriting = false;

      // Process any write that arrived while we were busy
      if (ProjectStorageRepository.pendingProject) {
        const pending = ProjectStorageRepository.pendingProject;
        ProjectStorageRepository.pendingProject = null;
        ProjectStorageRepository.saveProject(pending);
      }
    }

    // Notify listeners (Redux sync, etc.)
    this.notifyChange();

    // Check localStorage quota and warn if approaching limit
    checkLocalStorageQuota();
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

      return ensureProjectMigrated(project);
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
    const kind: 'gui' | 'quantum' | 'platform-customization' | undefined =
      diagramType === 'GUINoCodeDiagram'
        ? 'gui'
        : diagramType === 'QuantumCircuitDiagram'
          ? 'quantum'
          : diagramType === 'PlatformCustomizationDiagram'
            ? 'platform-customization'
            : undefined;
    const defaultTitle = title || `${diagramType.replace('Diagram', '')} ${diagrams.length + 1}`;
    const diagram = createEmptyDiagram(defaultTitle, umlType, kind);

    // Populate default cross-references for diagram types that need them
    if (diagramType === 'GUINoCodeDiagram' || diagramType === 'ObjectDiagram' || diagramType === 'PlatformCustomizationDiagram') {
      const refs: Partial<Record<SupportedDiagramType, string>> = {};
      const classDiagrams = project.diagrams.ClassDiagram;
      if (classDiagrams.length > 0) {
        refs.ClassDiagram = classDiagrams[0].id;
      }
      if (diagramType === 'GUINoCodeDiagram') {
        const agentDiagrams = project.diagrams.AgentDiagram;
        if (agentDiagrams.length > 0) {
          refs.AgentDiagram = agentDiagrams[0].id;
        }
      }
      if (Object.keys(refs).length > 0) {
        diagram.references = refs;
      }
    }

    diagrams.push(diagram);
    const newIndex = diagrams.length - 1;
    project.currentDiagramIndices[diagramType] = newIndex;

    this.saveProject(project);
    return { index: newIndex, diagram };
  }

  // Remove a diagram by index (cannot remove the last one).
  // Cleans up dangling ID-based references on all other diagrams.
  static removeDiagram(projectId: string, diagramType: SupportedDiagramType, diagramIndex: number): boolean {
    const project = this.loadProject(projectId);
    if (!project) {
      return false;
    }

    const diagrams = project.diagrams[diagramType];
    if (diagrams.length <= 1 || diagramIndex < 0 || diagramIndex >= diagrams.length) {
      return false;
    }

    const deletedId = diagrams[diagramIndex].id;
    diagrams.splice(diagramIndex, 1);

    // Adjust active index
    const currentIndex = project.currentDiagramIndices[diagramType];
    if (currentIndex >= diagrams.length) {
      project.currentDiagramIndices[diagramType] = diagrams.length - 1;
    } else if (currentIndex > diagramIndex) {
      project.currentDiagramIndices[diagramType] = currentIndex - 1;
    }

    // Clean up dangling references: any diagram referencing the deleted ID
    // gets its reference reset to the first diagram of that type.
    const fallbackId = diagrams[0]?.id;
    for (const type of ALL_DIAGRAM_TYPES) {
      for (const d of project.diagrams[type]) {
        if (d.references?.[diagramType] === deletedId) {
          d.references[diagramType] = fallbackId;
        }
      }
    }

    this.saveProject(project);
    return true;
  }

  // Update a diagram's cross-references (ID-based)
  static updateDiagramReferences(
    projectId: string,
    diagramType: SupportedDiagramType,
    diagramIndex: number,
    references: Partial<Record<SupportedDiagramType, string>>,
  ): boolean {
    const project = this.loadProject(projectId);
    if (!project) return false;

    const diagrams = project.diagrams[diagramType];
    if (diagramIndex < 0 || diagramIndex >= diagrams.length) return false;

    diagrams[diagramIndex] = {
      ...diagrams[diagramIndex],
      references: { ...diagrams[diagramIndex].references, ...references },
    };

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

      // Clean up GitHub-related metadata for this project
      this.cleanupGitHubMetadata(projectId);

      // Notify listeners (Redux sync, etc.)
      this.notifyChange();

      // console.log('Project deleted successfully:', projectId);
    } catch (error) {
      console.error('Error deleting project:', error);
      throw new Error('Failed to delete project');
    }
  }

  /**
   * Remove orphaned GitHub metadata entries for a deleted project.
   * Cleans up besser_github_linked_repos, besser_github_auto_commit,
   * and besser_deploy_linked_ keys.
   */
  private static cleanupGitHubMetadata(projectId: string): void {
    // Clean up linked repos entry
    try {
      const linkedReposRaw = localStorage.getItem('besser_github_linked_repos');
      if (linkedReposRaw) {
        const links = JSON.parse(linkedReposRaw);
        if (links && typeof links === 'object' && projectId in links) {
          delete links[projectId];
          localStorage.setItem('besser_github_linked_repos', JSON.stringify(links));
        }
      }
    } catch {
      // If data is corrupt, remove the entire key to prevent further issues
      localStorage.removeItem('besser_github_linked_repos');
    }

    // Clean up auto-commit settings entry
    try {
      const autoCommitRaw = localStorage.getItem('besser_github_auto_commit');
      if (autoCommitRaw) {
        const settings = JSON.parse(autoCommitRaw);
        if (settings && typeof settings === 'object' && projectId in settings) {
          delete settings[projectId];
          localStorage.setItem('besser_github_auto_commit', JSON.stringify(settings));
        }
      }
    } catch {
      localStorage.removeItem('besser_github_auto_commit');
    }

    // Clean up deploy linked repo entry (per-project key)
    localStorage.removeItem(`besser_deploy_linked_${projectId}`);
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
  
}
