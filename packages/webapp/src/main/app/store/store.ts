import { configureStore } from '@reduxjs/toolkit';
import { workspaceReducer } from './workspaceSlice';
import { errorReducer } from './errorManagementSlice';
import { smartGeneratorReducer } from '../../features/smart-generation/state/smartGeneratorSlice';

export const store = configureStore({
  reducer: {
    workspace: workspaceReducer,
    errors: errorReducer,
    smartGenerator: smartGeneratorReducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware(),
  devTools: !import.meta.env.PROD,
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
