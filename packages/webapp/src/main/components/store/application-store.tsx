import React from 'react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { diagramReducer } from '../../services/diagram/diagramSlice';
import { projectReducer } from '../../services/project/projectSlice';

import { errorReducer } from '../../services/error-management/errorManagementSlice';
import { modalReducer } from '../../services/modal/modalSlice';
import { shareReducer } from '../../services/share/shareSlice';
import { versionManagementReducer } from '../../services/version-management/versionManagementSlice';

const store = configureStore({
  reducer: {
    diagram: diagramReducer,
    project: projectReducer,
    errors: errorReducer,
    modal: modalReducer,
    share: shareReducer,
    versionManagement: versionManagementReducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware(),
  devTools: process.env.NODE_ENV !== 'production', // Enable Redux DevTools in non-production environments
});

interface Props {
  children: React.ReactNode;
}

export const ApplicationStore: React.FC<Props> = ({ children }) => {
  return <Provider store={store}>{children}</Provider>;
};

export type AppDispatch = typeof store.dispatch;

export type RootState = ReturnType<typeof store.getState>;
