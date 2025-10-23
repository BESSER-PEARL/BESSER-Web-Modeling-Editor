import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { ApollonMode, Locale, Styles, UMLDiagramType, UMLModel } from '@besser/wme';
import { uuid } from '../../utils/uuid';
import { addDiagramToCurrentProject } from '../../utils/localStorage';
import { ProjectStorageRepository } from '../storage/ProjectStorageRepository';
import { GrapesJSProjectData, isUMLModel, toUMLDiagramType } from '../../types/project';
import { DeepPartial } from '../../utils/types';

export type Diagram = {
  id: string;
  title: string;
  model?: UMLModel | GrapesJSProjectData;
  lastUpdate: string;
  versions?: Diagram[];
  description?: string;
  token?: string;
};

export type EditorOptions = {
  type: UMLDiagramType;
  mode?: ApollonMode;
  readonly?: boolean;
  enablePopups?: boolean;
  enableCopyPaste?: boolean;
  theme?: DeepPartial<Styles>;
  locale: Locale;
  colorEnabled?: boolean;
};

export const defaultEditorOptions: EditorOptions = {
  type: UMLDiagramType.ClassDiagram,
  mode: ApollonMode.Modelling,
  readonly: false,
  enablePopups: true,
  enableCopyPaste: true,
  locale: Locale.en,
  colorEnabled: true,
};

const getInitialEditorOptions = (): EditorOptions => {
  const editorOptions = defaultEditorOptions;

  // Always try to get from current project first
  try {
    const currentProject = ProjectStorageRepository.getCurrentProject();
    if (currentProject) {
      const diagramType = toUMLDiagramType(currentProject.currentDiagramType);
      // Only set type if it's a UML diagram (not GUINoCodeDiagram which returns null)
      if (diagramType !== null) {
        editorOptions.type = diagramType;
      }
      return editorOptions;
    }
  } catch (error) {
    console.warn('Error loading project for initial editor options:', error);
  }

  // If no project, return default options
  return editorOptions;
};

const getInitialDiagram = (): Diagram => {
  // Always get from current project - no localStorage fallback
  try {
    const currentProject = ProjectStorageRepository.getCurrentProject();
    if (currentProject) {
      const currentDiagram = currentProject.diagrams[currentProject.currentDiagramType];

      return {
        id: currentDiagram.id,
        title: currentDiagram.title,
        model: isUMLModel(currentDiagram.model) ? currentDiagram.model : undefined,
        lastUpdate: currentDiagram.lastUpdate,
      };
    }
  } catch (error) {
    console.warn('Error loading project for initial diagram:', error);
  }

  // If no project found, create a default diagram
  // This should only happen during development or if there's an issue with project creation
  console.warn('No project found - creating default diagram. This might indicate a project setup issue.');
  return { 
    id: uuid(), 
    title: 'UMLClassDiagram', 
    model: undefined, 
    lastUpdate: new Date().toISOString() 
  };
};

const initialState = {
  diagram: getInitialDiagram(),
  editorOptions: getInitialEditorOptions(),
  loading: false,
  error: null,
  createNewEditor: true,
  displayUnpublishedVersion: true,
};

export const updateDiagramThunk = createAsyncThunk(
  'diagram/updateWithProject',
  async (diagram: Partial<Diagram>, { getState, dispatch }) => {
    const state = getState() as any;
    const currentDiagram = state.diagram.diagram;
    
    // Merge changes carefully
    const updatedDiagram = {
      ...currentDiagram,
      ...diagram,
      lastUpdate: new Date().toISOString(),
      // Keep existing model if not explicitly provided
      model: diagram.model || currentDiagram.model
    };

    // Always use project system - no localStorage fallback
    try {
      // Import the project thunk dynamically to avoid circular imports
      const { updateCurrentDiagramThunk } = await import('../project/projectSlice');
      
      // Prepare updates for the project system
      const projectUpdates: any = {};
      if (updatedDiagram.model) {
        projectUpdates.model = updatedDiagram.model;
      }
      if (diagram.title !== undefined) {
        projectUpdates.title = diagram.title;
      }
      if (diagram.description !== undefined) {
        projectUpdates.description = diagram.description;
      }
      
      // Only update project if we have something to update
      if (Object.keys(projectUpdates).length > 0) {
        await dispatch(updateCurrentDiagramThunk(projectUpdates));
        // console.log('Successfully synced to project system');
      }
    } catch (error) {
      console.error('Project sync failed:', error);
      throw error; // Propagate the error since we no longer fall back to localStorage
    }

    return updatedDiagram;
  }
);

const diagramSlice = createSlice({
  name: 'diagram',
  initialState,
  reducers: {
    updateDiagram: (state, action: PayloadAction<Partial<Diagram>>) => {
      if (state.diagram) {
        // Preserve existing model if not provided in update
        const model = action.payload.model || state.diagram.model;
        state.diagram = {
          ...state.diagram,
          ...action.payload,
          model
        };
      }

      if (!state.displayUnpublishedVersion) {
        state.displayUnpublishedVersion = true;
      }
    },
    createDiagram: (
      state,
      action: PayloadAction<{ title: string; diagramType: UMLDiagramType; template?: UMLModel }>,
    ) => {
      const newDiagramId = uuid();
      state.diagram = {
        id: newDiagramId,
        title: action.payload.title,
        model: action.payload.template,
        lastUpdate: new Date().toISOString(),
      };
      state.editorOptions.type = action.payload.diagramType;
      state.createNewEditor = true;
      
      // Automatically add the new diagram to the current project if in project context
      // This ensures all diagram creation flows (drag-drop, modals, imports) work with projects
      addDiagramToCurrentProject(newDiagramId);
    },
    loadDiagram: (state, action: PayloadAction<Diagram>) => {
      state.diagram = action.payload;
      state.createNewEditor = true;
      if (isUMLModel(action.payload.model)) {
        state.editorOptions.type = action.payload.model.type;
      }
    },
    loadImportedDiagram: (state, action: PayloadAction<Diagram>) => {
      // Like loadDiagram but also adds to project if in project context
      state.diagram = action.payload;
      state.createNewEditor = true;
      if (isUMLModel(action.payload.model)) {
        state.editorOptions.type = action.payload.model.type;
      }
      
      // Add imported diagram to current project if in project context
      addDiagramToCurrentProject(action.payload.id);
    },
    setCreateNewEditor: (state, action: PayloadAction<boolean>) => {
      state.createNewEditor = action.payload;
    },
    changeDiagramType: (state, action: PayloadAction<UMLDiagramType>) => {
      state.editorOptions.type = action.payload;
    },
    changeEditorMode: (state, action: PayloadAction<ApollonMode>) => {
      state.editorOptions.mode = action.payload;
    },
    changeReadonlyMode: (state, action: PayloadAction<boolean>) => {
      state.editorOptions.readonly = action.payload;
    },
    setDisplayUnpublishedVersion(state, action: PayloadAction<boolean>) {
      state.displayUnpublishedVersion = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(updateDiagramThunk.fulfilled, (state, action) => {
      state.diagram = action.payload;
      state.loading = false;
    });
  },

  selectors: {
    selectDiagram: (state) => state.diagram,
    selectCreatenewEditor: (state) => state.createNewEditor,
    selectDisplayUnpublishedVersion: (state) => state.displayUnpublishedVersion,
  },
});

export const {
  updateDiagram,
  setCreateNewEditor,
  changeEditorMode,
  changeReadonlyMode,
  changeDiagramType,
  createDiagram,
  loadDiagram,
  loadImportedDiagram,
  setDisplayUnpublishedVersion,
} = diagramSlice.actions;

export const { selectDiagram, selectCreatenewEditor, selectDisplayUnpublishedVersion } = diagramSlice.selectors;

export const diagramReducer = diagramSlice.reducer;
