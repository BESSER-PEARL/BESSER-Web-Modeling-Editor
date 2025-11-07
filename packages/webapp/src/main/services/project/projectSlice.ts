import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { UMLModel, UMLDiagramType } from '@besser/wme';
import { BesserProject, ProjectDiagram, SupportedDiagramType, isUMLModel, toSupportedDiagramType, toUMLDiagramType } from '../../types/project';
import { ProjectStorageRepository } from '../storage/ProjectStorageRepository';
import { localStorageLatestProject } from '../../constant';

// Project state interface
export interface ProjectState {
  currentProject: BesserProject | null;
  currentDiagram: ProjectDiagram | null;
  currentDiagramType: SupportedDiagramType;
  loading: boolean;
  error: string | null;
  createNewEditor: boolean;
}

// Initial state
const initialState: ProjectState = {
  currentProject: null,
  currentDiagram: null,
  currentDiagramType: 'ClassDiagram',
  loading: false,
  error: null,
  createNewEditor: true,
};

// Async thunks
export const loadProjectThunk = createAsyncThunk(
  'project/loadProject',
  async (projectId: string | undefined, { dispatch }) => {
    const project = projectId ? 
      ProjectStorageRepository.loadProject(projectId) : 
      ProjectStorageRepository.getCurrentProject();
    
    if (!project) {
      throw new Error('Project not found');
    }
    
    // If loading a specific project, update the latest project reference
    if (projectId && project.id !== projectId) {
      console.warn('Loaded project ID does not match requested ID');
    }
    
    // Update latest project reference when loading a project
    localStorage.setItem(localStorageLatestProject, project.id);
    
    // Also sync to diagram slice to keep Apollo editor in sync
    try {
      const { changeDiagramType, setCreateNewEditor, loadDiagram } = await import('../diagram/diagramSlice');
      
      const currentDiagram = project.diagrams[project.currentDiagramType];
      const diagramType = toUMLDiagramType(project.currentDiagramType);
      
      // Create a compatible diagram object for the diagram slice
      const compatibleDiagram = {
        id: currentDiagram.id,
        title: currentDiagram.title,
        model: isUMLModel(currentDiagram.model) ? currentDiagram.model : undefined,
        lastUpdate: currentDiagram.lastUpdate,
      };
      
      // Update the diagram slice (only for UML diagrams, skip GUINoCodeDiagram)
      if (diagramType !== null) {
        console.log('Syncing project load to diagram slice...');
        dispatch(changeDiagramType(diagramType));
        dispatch(loadDiagram(compatibleDiagram));
        dispatch(setCreateNewEditor(true));
        console.log('Successfully synced project load');
      } else {
        console.log('Skipping diagram sync for non-UML diagram type:', project.currentDiagramType);
      }
    } catch (error) {
      console.warn('Could not sync to diagram slice:', error);
    }
    
    return project;
  }
);

export const createProjectThunk = createAsyncThunk(
  'project/createProject',
  async ({ name, description, owner }: { name: string; description: string; owner: string }, { dispatch }) => {
    const project = ProjectStorageRepository.createNewProject(name, description, owner);
    
    // Also sync to diagram slice to keep Apollo editor in sync
    try {
      const { changeDiagramType, setCreateNewEditor, loadDiagram } = await import('../diagram/diagramSlice');
      
      const currentDiagram = project.diagrams[project.currentDiagramType];
      const diagramType = toUMLDiagramType(project.currentDiagramType);
      
      // Create a compatible diagram object for the diagram slice
      const compatibleDiagram = {
        id: currentDiagram.id,
        title: currentDiagram.title,
        model: currentDiagram.model,
        lastUpdate: currentDiagram.lastUpdate,
      };
      
      // Update the diagram slice (only for UML diagrams, skip GUINoCodeDiagram)
      if (diagramType !== null) {
        console.log('Syncing project creation to diagram slice...');
        dispatch(changeDiagramType(diagramType));
        dispatch(loadDiagram({
          id: currentDiagram.id,
          title: currentDiagram.title,
          model: isUMLModel(currentDiagram.model) ? currentDiagram.model : undefined,
          lastUpdate: currentDiagram.lastUpdate,
        }));
        dispatch(setCreateNewEditor(true));
        console.log('Successfully synced project creation');
      } else {
        console.log('Skipping diagram sync for non-UML diagram type:', project.currentDiagramType);
      }
    } catch (error) {
      console.warn('Could not sync to diagram slice:', error);
    }
    
    return project;
  }
);

export const updateCurrentDiagramThunk = createAsyncThunk(
  'project/updateCurrentDiagram',
  async (updates: Partial<Pick<ProjectDiagram, 'model' | 'title' | 'description'>>, { getState }) => {
    const state = getState() as { project: ProjectState };
    const { currentProject, currentDiagramType } = state.project;
    
    if (!currentProject) {
      throw new Error('No active project');
    }
    
    const updatedDiagram: ProjectDiagram = {
      ...currentProject.diagrams[currentDiagramType],
      ...updates,
      lastUpdate: new Date().toISOString(),
    };
    
    const success = ProjectStorageRepository.updateDiagram(
      currentProject.id,
      currentDiagramType,
      updatedDiagram
    );
    
    if (!success) {
      throw new Error('Failed to update diagram');
    }
    
    return updatedDiagram;
  }
);

export const switchDiagramTypeThunk = createAsyncThunk(
  'project/switchDiagramType',
  async ({ diagramType }: { diagramType: UMLDiagramType }, { getState, dispatch }) => {
    const state = getState() as { project: ProjectState };
    const { currentProject } = state.project;
    
    if (!currentProject) {
      throw new Error('No active project');
    }
    
    const supportedType = toSupportedDiagramType(diagramType);
    const diagram = ProjectStorageRepository.switchDiagramType(currentProject.id, supportedType);
    
    if (!diagram) {
      throw new Error('Failed to switch diagram type');
    }
    
    // Special handling for Object Diagrams - set up reference to Class Diagram
    if (diagramType === UMLDiagramType.ObjectDiagram) {
      const classDiagram = currentProject.diagrams.ClassDiagram;
      const classDiagramModel = classDiagram?.model;
      if (isUMLModel(classDiagramModel)) {
        try {
          const { diagramBridge } = await import('@besser/wme');
          // Set the class diagram data in the bridge so Object Diagram can reference it
          diagramBridge.setClassDiagramData(classDiagramModel);
          console.log('Set class diagram reference for object diagram');
        } catch (error) {
          console.warn('Could not set class diagram reference:', error);
        }
      }
    }
    
    // Also sync to diagram slice to keep Apollo editor in sync
    try {
      const { changeDiagramType, setCreateNewEditor, loadDiagram } = await import('../diagram/diagramSlice');
      
      // Create a compatible diagram object for the diagram slice
      const compatibleDiagram = {
        id: diagram.id,
        title: diagram.title,
        model: isUMLModel(diagram.model) ? diagram.model : undefined,
        lastUpdate: diagram.lastUpdate,
      };
      
      // Update the diagram slice
      console.log('Syncing diagram type switch to diagram slice...');
      dispatch(changeDiagramType(diagramType));
      dispatch(loadDiagram(compatibleDiagram));
      dispatch(setCreateNewEditor(true));
      console.log('Successfully synced diagram type switch');
    } catch (error) {
      console.warn('Could not sync to diagram slice:', error);
    }
    
    return { diagram, diagramType: supportedType };
  }
);

// Project slice
const projectSlice = createSlice({
  name: 'project',
  initialState,
  reducers: {
    setCreateNewEditor: (state, action: PayloadAction<boolean>) => {
      state.createNewEditor = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
    updateProjectInfo: (state, action: PayloadAction<Partial<Pick<BesserProject, 'name' | 'description' | 'owner'>>>) => {
      if (state.currentProject) {
        Object.assign(state.currentProject, action.payload);
        ProjectStorageRepository.saveProject(state.currentProject);
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Load project
      .addCase(loadProjectThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loadProjectThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.currentProject = action.payload;
        state.currentDiagramType = action.payload.currentDiagramType;
        state.currentDiagram = action.payload.diagrams[action.payload.currentDiagramType];
        state.createNewEditor = true;
      })
      .addCase(loadProjectThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to load project';
      })
      
      // Create project
      .addCase(createProjectThunk.fulfilled, (state, action) => {
        state.currentProject = action.payload;
        state.currentDiagramType = action.payload.currentDiagramType;
        state.currentDiagram = action.payload.diagrams[action.payload.currentDiagramType];
        state.createNewEditor = true;
      })
      
      // Update current diagram
      .addCase(updateCurrentDiagramThunk.fulfilled, (state, action) => {
        state.currentDiagram = action.payload;
        if (state.currentProject) {
          state.currentProject.diagrams[state.currentDiagramType] = action.payload;
        }
      })
      .addCase(updateCurrentDiagramThunk.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to update diagram';
      })
      
      // Switch diagram type
      .addCase(switchDiagramTypeThunk.fulfilled, (state, action) => {
        state.currentDiagram = action.payload.diagram;
        state.currentDiagramType = action.payload.diagramType;
        state.createNewEditor = true;
        if (state.currentProject) {
          state.currentProject.currentDiagramType = action.payload.diagramType;
        }
      })
      .addCase(switchDiagramTypeThunk.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to switch diagram type';
      });
  },
  selectors: {
    selectCurrentProject: (state) => state.currentProject,
    selectCurrentDiagram: (state) => state.currentDiagram,
    selectCurrentDiagramType: (state) => state.currentDiagramType,
    selectCurrentUMLDiagramType: (state) => state.currentDiagramType ? toUMLDiagramType(state.currentDiagramType) : UMLDiagramType.ClassDiagram,
    selectCreateNewEditor: (state) => state.createNewEditor,
    selectLoading: (state) => state.loading,
    selectError: (state) => state.error,
  },
});

export const {
  setCreateNewEditor,
  clearError,
  updateProjectInfo,
} = projectSlice.actions;

export const {
  selectCurrentProject,
  selectCurrentDiagram,
  selectCurrentDiagramType,
  selectCurrentUMLDiagramType,
  selectCreateNewEditor,
  selectLoading,
  selectError,
} = projectSlice.selectors;

export const projectReducer = projectSlice.reducer;
