import { ProjectStorageRepository } from '../ProjectStorageRepository';
import { createDefaultProject, ALL_DIAGRAM_TYPES, BesserProject } from '../../../types/project';
import { localStorageProjectPrefix, localStorageLatestProject, localStorageProjectsList } from '../../../constant';

// Mock react-toastify (imported transitively by localStorageQuota)
vi.mock('react-toastify', () => ({
  toast: { warning: vi.fn() },
}));

describe('ProjectStorageRepository', () => {
  beforeEach(() => {
    localStorage.clear();
    // Reset static state
    ProjectStorageRepository.revision = 0;
    // Clear any lingering listeners
    (ProjectStorageRepository as any).changeListeners = [];
    (ProjectStorageRepository as any).suppressDepth = 0;
  });

  // ── Save / Load ────────────────────────────────────────────────────────

  describe('saveProject / loadProject', () => {
    it('round-trips a project through localStorage', () => {
      const project = createDefaultProject('Test', 'desc', 'alice');
      ProjectStorageRepository.saveProject(project);

      const loaded = ProjectStorageRepository.loadProject(project.id);
      expect(loaded).not.toBeNull();
      expect(loaded!.id).toBe(project.id);
      expect(loaded!.name).toBe('Test');
      expect(loaded!.owner).toBe('alice');
    });

    it('sets the latest project pointer', () => {
      const project = createDefaultProject('P', '', '');
      ProjectStorageRepository.saveProject(project);

      expect(localStorage.getItem(localStorageLatestProject)).toBe(project.id);
    });

    it('adds the project ID to the projects list', () => {
      const project = createDefaultProject('P', '', '');
      ProjectStorageRepository.saveProject(project);

      const list = JSON.parse(localStorage.getItem(localStorageProjectsList) ?? '[]');
      expect(list).toContain(project.id);
    });

    it('returns null for a non-existent project ID', () => {
      expect(ProjectStorageRepository.loadProject('does-not-exist')).toBeNull();
    });

    it('returns null for corrupted JSON data', () => {
      localStorage.setItem(`${localStorageProjectPrefix}broken`, '{bad json');
      expect(ProjectStorageRepository.loadProject('broken')).toBeNull();
    });
  });

  // ── getCurrentProject ──────────────────────────────────────────────────

  describe('getCurrentProject', () => {
    it('returns the latest saved project', () => {
      const project = createDefaultProject('Current', '', '');
      ProjectStorageRepository.saveProject(project);

      const current = ProjectStorageRepository.getCurrentProject();
      expect(current).not.toBeNull();
      expect(current!.id).toBe(project.id);
    });

    it('returns null when no project has been saved', () => {
      expect(ProjectStorageRepository.getCurrentProject()).toBeNull();
    });
  });

  // ── getAllProjects ─────────────────────────────────────────────────────

  describe('getAllProjects', () => {
    it('returns all projects sorted newest-first', () => {
      const p1 = createDefaultProject('First', '', '');
      const p2 = createDefaultProject('Second', '', '');

      // Force distinct timestamps
      p1.createdAt = '2024-01-01T00:00:00.000Z';
      p2.createdAt = '2024-06-01T00:00:00.000Z';

      ProjectStorageRepository.saveProject(p1);
      ProjectStorageRepository.saveProject(p2);

      const all = ProjectStorageRepository.getAllProjects();
      expect(all).toHaveLength(2);
      expect(all[0].name).toBe('Second');
      expect(all[1].name).toBe('First');
    });

    it('returns an empty array when no projects exist', () => {
      expect(ProjectStorageRepository.getAllProjects()).toEqual([]);
    });
  });

  // ── createNewProject ──────────────────────────────────────────────────

  describe('createNewProject', () => {
    it('creates, saves, and returns a new project', () => {
      const project = ProjectStorageRepository.createNewProject('New', 'A new project', 'bob');

      expect(project.name).toBe('New');
      expect(project.description).toBe('A new project');
      expect(project.owner).toBe('bob');

      // Should be loadable
      const loaded = ProjectStorageRepository.loadProject(project.id);
      expect(loaded).not.toBeNull();
    });
  });

  // ── deleteProject ─────────────────────────────────────────────────────

  describe('deleteProject', () => {
    it('removes the project from localStorage and the projects list', () => {
      const project = createDefaultProject('ToDelete', '', '');
      ProjectStorageRepository.saveProject(project);

      ProjectStorageRepository.deleteProject(project.id);

      expect(ProjectStorageRepository.loadProject(project.id)).toBeNull();
      const list = JSON.parse(localStorage.getItem(localStorageProjectsList) ?? '[]');
      expect(list).not.toContain(project.id);
    });

    it('clears the latest project pointer if the deleted project was latest', () => {
      const project = createDefaultProject('Latest', '', '');
      ProjectStorageRepository.saveProject(project);

      ProjectStorageRepository.deleteProject(project.id);
      expect(localStorage.getItem(localStorageLatestProject)).toBeNull();
    });
  });

  // ── updateDiagram ─────────────────────────────────────────────────────

  describe('updateDiagram', () => {
    it('updates the diagram at the current active index', () => {
      const project = createDefaultProject('P', '', '');
      ProjectStorageRepository.saveProject(project);

      const updatedDiagram = {
        ...project.diagrams.ClassDiagram[0],
        title: 'Updated Title',
      };

      const result = ProjectStorageRepository.updateDiagram(project.id, 'ClassDiagram', updatedDiagram);
      expect(result).toBe(true);

      const loaded = ProjectStorageRepository.loadProject(project.id);
      expect(loaded!.diagrams.ClassDiagram[0].title).toBe('Updated Title');
    });

    it('returns false for a non-existent project', () => {
      const diagram = createDefaultProject('P', '', '').diagrams.ClassDiagram[0];
      expect(ProjectStorageRepository.updateDiagram('no-such-id', 'ClassDiagram', diagram)).toBe(false);
    });
  });

  // ── switchDiagramType ─────────────────────────────────────────────────

  describe('switchDiagramType', () => {
    it('changes the active diagram type and returns the active diagram', () => {
      const project = createDefaultProject('P', '', '');
      ProjectStorageRepository.saveProject(project);

      const diagram = ProjectStorageRepository.switchDiagramType(project.id, 'ObjectDiagram');
      expect(diagram).not.toBeNull();

      const loaded = ProjectStorageRepository.loadProject(project.id);
      expect(loaded!.currentDiagramType).toBe('ObjectDiagram');
    });
  });

  // ── addDiagram / removeDiagram ────────────────────────────────────────

  describe('addDiagram', () => {
    it('adds a new diagram and returns its index', () => {
      const project = createDefaultProject('P', '', '');
      ProjectStorageRepository.saveProject(project);

      const result = ProjectStorageRepository.addDiagram(project.id, 'ClassDiagram', 'Second Class Diagram');
      expect(result).not.toBeNull();
      expect(result!.index).toBe(1);
      expect(result!.diagram.title).toBe('Second Class Diagram');

      const loaded = ProjectStorageRepository.loadProject(project.id);
      expect(loaded!.diagrams.ClassDiagram).toHaveLength(2);
    });

    it('returns null when the project does not exist', () => {
      expect(ProjectStorageRepository.addDiagram('ghost', 'ClassDiagram')).toBeNull();
    });
  });

  describe('removeDiagram', () => {
    it('removes a diagram by index', () => {
      const project = createDefaultProject('P', '', '');
      ProjectStorageRepository.saveProject(project);

      // Add a second diagram so we can remove one
      ProjectStorageRepository.addDiagram(project.id, 'ClassDiagram', 'Extra');

      const result = ProjectStorageRepository.removeDiagram(project.id, 'ClassDiagram', 0);
      expect(result).toBe(true);

      const loaded = ProjectStorageRepository.loadProject(project.id);
      expect(loaded!.diagrams.ClassDiagram).toHaveLength(1);
    });

    it('cannot remove the last remaining diagram', () => {
      const project = createDefaultProject('P', '', '');
      ProjectStorageRepository.saveProject(project);

      expect(ProjectStorageRepository.removeDiagram(project.id, 'ClassDiagram', 0)).toBe(false);
    });
  });

  // ── Change notifications ──────────────────────────────────────────────

  describe('change listeners', () => {
    it('fires listeners on save and increments revision', () => {
      const listener = vi.fn();
      const unsub = ProjectStorageRepository.onProjectChange(listener);

      const project = createDefaultProject('P', '', '');
      ProjectStorageRepository.saveProject(project);

      expect(listener).toHaveBeenCalledOnce();
      expect(ProjectStorageRepository.revision).toBe(1);

      unsub();
    });

    it('suppresses notifications inside withoutNotify', () => {
      const listener = vi.fn();
      const unsub = ProjectStorageRepository.onProjectChange(listener);

      const project = createDefaultProject('P', '', '');

      ProjectStorageRepository.withoutNotify(() => {
        ProjectStorageRepository.saveProject(project);
      });

      expect(listener).not.toHaveBeenCalled();

      unsub();
    });

    it('unsubscribes correctly', () => {
      const listener = vi.fn();
      const unsub = ProjectStorageRepository.onProjectChange(listener);
      unsub();

      const project = createDefaultProject('P', '', '');
      ProjectStorageRepository.saveProject(project);

      expect(listener).not.toHaveBeenCalled();
    });
  });
});
