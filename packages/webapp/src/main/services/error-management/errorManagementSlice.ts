import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { v4 as uuidv4 } from 'uuid';

export type ApollonError = {
  id: string;
  headerText: string;
  bodyText: string;
};

const initialState: ApollonError[] = [];

const errorSlice = createSlice({
  name: 'error',
  initialState,
  reducers: {
    displayError: {
      reducer: (state, action: PayloadAction<ApollonError>) => {
        state.push(action.payload);
      },
      prepare: (headerText: string, bodyText: string) => ({
        payload: {
          id: uuidv4(),
          headerText,
          bodyText,
        },
      }),
    },

    dismissError: (state, action: PayloadAction<string>) => {
      return state.filter((error) => error.id !== action.payload);
    },
  },
});

export const { displayError, dismissError } = errorSlice.actions;

export const errorReducer = errorSlice.reducer;
