import { configureStore } from '@reduxjs/toolkit';
import { workspaceReducer } from './workspaceSlice';
import { errorReducer } from './errorManagementSlice';
import { agentTestReducer } from '../../features/agent-testing';

export const store = configureStore({
  reducer: {
    workspace: workspaceReducer,
    errors: errorReducer,
    agentTest: agentTestReducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware(),
  devTools: !import.meta.env.PROD,
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
