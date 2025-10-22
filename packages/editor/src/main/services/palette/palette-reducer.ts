import { Reducer } from 'redux';
import { PaletteActions, PaletteActionTypes } from './palette-types';
import { PreviewElement } from '../../packages/compose-preview';

import { Actions } from '../actions'; // import your global Actions type


// Type guard for SET_PALETTE action
function isSetPaletteAction(action: Actions): action is PaletteActions {
  return (
    action.type === PaletteActionTypes.SET_PALETTE &&
    Array.isArray((action as PaletteActions).payload)
  );
}

export const PaletteReducer: Reducer<PreviewElement[], Actions> = (state = [], action) => {
  switch (action.type) {
    case PaletteActionTypes.SET_PALETTE: {
      // Only set to empty if payload is explicitly empty, otherwise keep previous state
      return isSetPaletteAction(action) ? (action as PaletteActions).payload : state;
    }
    default:
      return state;
  }
};