import { configureStore, Middleware } from '@reduxjs/toolkit';
import { workspaceReducer } from './workspaceSlice';
import { errorReducer } from './errorManagementSlice';
import { getPostHog } from '../../shared/services/analytics/lazy-analytics';
import { ENABLE_STUDY_DEPLOY } from '../../shared/constants/constant';
type WorkspaceSlice = { workspace: { activeDiagramType: string } };

// Debounce handle for batching rapid model edits into a single event.
let _editDebounceTimer: ReturnType<typeof setTimeout> | null = null;

const studyAnalyticsMiddleware: Middleware = (api) => (next) => (action) => {
  const result = next(action);

  if (!ENABLE_STUDY_DEPLOY) return result;

  const type = (action as { type: string }).type;

  // Debounce rapid canvas edits into one event per ~2 s of idle time.
  if (
    type === 'workspace/updateDiagramModel/fulfilled' ||
    type === 'workspace/updateQuantumDiagram/fulfilled'
  ) {
    if (_editDebounceTimer) clearTimeout(_editDebounceTimer);
    _editDebounceTimer = setTimeout(() => {
      const state = api.getState() as WorkspaceSlice;
      const diagramType = state.workspace.activeDiagramType;
      getPostHog()?.capture('model_edited', { diagram_type: diagramType });
      _editDebounceTimer = null;
    }, 2000);
  }

  // Diagram tab added/removed/renamed.
  if (
    type === 'workspace/addDiagram/fulfilled' ||
    type === 'workspace/removeDiagram/fulfilled' ||
    type === 'workspace/renameDiagram/fulfilled'
  ) {
    const state = api.getState() as WorkspaceSlice;
    const diagramType = state.workspace.activeDiagramType;
    getPostHog()?.capture('diagram_structure_changed', {
      action: type.split('/')[1],
      diagram_type: diagramType,
    });
  }

  return result;
};

export const store = configureStore({
  reducer: {
    workspace: workspaceReducer,
    errors: errorReducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(studyAnalyticsMiddleware),
  devTools: !import.meta.env.PROD,
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
