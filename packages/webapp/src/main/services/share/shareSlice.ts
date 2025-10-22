import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Collaborator } from 'shared';
import { localStorageCollaborationName, localStorageCollaborationColor } from '../../constant';

export type ShareState = {
  userCollaborationData: {
    name: string | null;
    color: string | null;
  };
  collaborators: Collaborator[];
  fromServer: boolean;
};

const getInitialShareState = (): ShareState => {
  return {
    userCollaborationData: {
      name: window.localStorage.getItem(localStorageCollaborationName),
      color: window.localStorage.getItem(localStorageCollaborationColor),
    },
    collaborators: [],
    fromServer: false,
  };
};

const shareSlice = createSlice({
  name: 'share',
  initialState: getInitialShareState(),
  reducers: {
    updateCollaborationData(state, action: PayloadAction<{ name: string; color: string }>) {
      state.userCollaborationData.name = action.payload.name;
      state.userCollaborationData.color = action.payload.name;
    },

    updateCollaborators(state, action: PayloadAction<Collaborator[]>) {
      state.collaborators = action.payload;
    },

    gotFromServer(state, action: PayloadAction<{ fromServer: boolean }>) {
      state.fromServer = action.payload.fromServer;
    },
  },
});

export const { updateCollaborationData, updateCollaborators, gotFromServer } = shareSlice.actions;

export const shareReducer = shareSlice.reducer;
