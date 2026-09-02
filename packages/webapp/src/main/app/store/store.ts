import { configureStore } from '@reduxjs/toolkit';
import { workspaceReducer } from './workspaceSlice';
import { errorReducer } from './errorManagementSlice';
import { agentSimulationReducer } from '../../features/agent-simulation';

export const store = configureStore({
  reducer: {
    workspace: workspaceReducer,
    errors: errorReducer,
    agentSimulation: agentSimulationReducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware(),
  devTools: !import.meta.env.PROD,
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
