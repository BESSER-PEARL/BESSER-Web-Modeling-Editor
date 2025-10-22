import { Reducer } from 'redux';
import { Actions } from '../../actions';
import { AssociationPopupActionTypes, AssociationPopupState } from './association-popup-repository';

const initialState: AssociationPopupState = {
  sourceObjectId: null,
  isIconObjectDiagram: null,
  isOpen: false,
};

export const AssociationPopupReducer: Reducer<AssociationPopupState, Actions> = (state = initialState, action) => {
  switch (action.type) {
    case AssociationPopupActionTypes.OPEN: {
      const { payload } = action;
      return {
        sourceObjectId: payload.sourceObjectId,
        isIconObjectDiagram: payload.isIconObjectDiagram || null,
        isOpen: true,
      };
    }

    case AssociationPopupActionTypes.CLOSE: {
      return {
        ...state,
        isOpen: false,
      };
    }

    case AssociationPopupActionTypes.CLOSE_ALL: {
      return initialState;
    }
  }

  return state;
};