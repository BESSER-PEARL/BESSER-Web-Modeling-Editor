import { Reducer } from 'redux';
import { AppendAction, RemoveAction, UMLContainerActionTypes } from '../uml-container/uml-container-types';
import { UMLDiagram } from './uml-diagram';
import { UMLDiagramActions, UMLDiagramActionTypes, UMLDiagramState } from './uml-diagram-types';

const initialState: UMLDiagramState = new UMLDiagram();

export const UMLDiagramReducer: Reducer<UMLDiagramState, UMLDiagramActions & AppendAction & RemoveAction> = (
  state = initialState,
  action,
) => {
  switch (action.type) {
    case UMLContainerActionTypes.APPEND: {
      const { payload } = action;
      if (state.id !== payload.owner) {
        break;
      }

      return {
        ...state,
        ownedElements: [...new Set([...payload.ids, ...state.ownedElements])],
      };
    }
    case UMLContainerActionTypes.REMOVE: {
      const { payload } = action;
      if (state.id !== payload.owner) {
        break;
      }

      return {
        ...state,
        ownedElements: state.ownedElements.filter(id => !payload.ids.includes(id)),
      };
    }

    // case UMLDiagramActionTypes.ADD_ELEMENT: {
    //   const { payload } = action;
    //   return {
    //     ...state,
    //     ownedElements: [...new Set([...state.ownedElements, payload.id].reverse())].reverse(),
    //   };
    // }
    // case UMLDiagramActionTypes.ADD_RELATIONSHIP: {
    //   const { payload } = action;
    //   return {
    //     ...state,
    //     ownedRelationships: [...new Set([...state.ownedRelationships, payload.id].reverse())].reverse(),
    //   };
    // }
    // case UMLDiagramActionTypes.DELETE_ELEMENT: {
    //   const { payload } = action;
    //   return {
    //     ...state,
    //     ownedElements: state.ownedElements.filter(id => id !== payload.id),
    //   };
    // }
    // case UMLDiagramActionTypes.DELETE_RELATIONSHIP: {
    //   const { payload } = action;
    //   return {
    //     ...state,
    //     ownedRelationships: state.ownedRelationships.filter(id => id !== payload.id),
    //   };
    // }
    // case UMLDiagramActionTypes.UPDATE_BOUNDS: {
    //   const { payload } = action;
    //   return {
    //     ...state,
    //     bounds: { ...payload.bounds },
    //   };
    // }
  }
  return state;
};
