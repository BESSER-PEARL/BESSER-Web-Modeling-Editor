import { configureStore } from '@reduxjs/toolkit';
import { workspaceReducer } from './workspaceSlice';
import { errorReducer } from './errorManagementSlice';
import { specDrivenReducer } from '../../features/spec-driven/state/specDrivenSlice';

export const store = configureStore({
  reducer: {
    workspace: workspaceReducer,
    errors: errorReducer,
    specDriven: specDrivenReducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware(),
  devTools: !import.meta.env.PROD,
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
