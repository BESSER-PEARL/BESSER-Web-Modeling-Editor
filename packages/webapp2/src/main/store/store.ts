import { configureStore } from '@reduxjs/toolkit';
import { workspaceReducer } from '../services/workspace/workspaceSlice';
import { errorReducer } from '../services/error-management/errorManagementSlice';

export const store = configureStore({
  reducer: {
    workspace: workspaceReducer,
    errors: errorReducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware(),
  devTools: !import.meta.env.PROD,
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
