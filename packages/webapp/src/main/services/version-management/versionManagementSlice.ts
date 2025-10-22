import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type VersionManagementState = {
  displaySidebar: boolean;
  previewedDiagramIndex: number;
  versionActionIndex: number;
};

const initialState: VersionManagementState = {
  displaySidebar: false,
  previewedDiagramIndex: -1,
  versionActionIndex: -1,
};

const versionManagementSlice = createSlice({
  name: 'versionManagement',
  initialState,
  reducers: {
    toggleSidebar(state, action: PayloadAction<void>) {
      state.displaySidebar = !state.displaySidebar;
    },
    setPreviewedDiagramIndex(state, action: PayloadAction<number>) {
      state.previewedDiagramIndex = action.payload;
    },
    setVersionActionIndex(state, action: PayloadAction<number>) {
      state.versionActionIndex = action.payload;
    },
  },
  selectors: {
    selectDisplaySidebar: (state) => state.displaySidebar,
    selectPreviewedDiagramIndex: (state) => state.previewedDiagramIndex,
    selectVersionActionIndex: (state) => state.versionActionIndex,
  },
});

export const { toggleSidebar, setPreviewedDiagramIndex, setVersionActionIndex } = versionManagementSlice.actions;

export const { selectDisplaySidebar, selectPreviewedDiagramIndex, selectVersionActionIndex } =
  versionManagementSlice.selectors;

export const versionManagementReducer = versionManagementSlice.reducer;
