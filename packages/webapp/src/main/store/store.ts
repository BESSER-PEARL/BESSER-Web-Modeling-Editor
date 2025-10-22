import { configureStore } from '@reduxjs/toolkit';
import { diagramReducer } from '../services/diagram/diagramSlice';
import { projectReducer } from '../services/project/projectSlice';

export const store = configureStore({
  reducer: {
    diagram: diagramReducer,
    project: projectReducer,
    // Add other reducers here
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch; 