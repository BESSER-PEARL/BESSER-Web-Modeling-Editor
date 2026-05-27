import { Reducer } from 'redux';
import { Actions } from '../../actions';
import { MovingActionTypes, MovingState } from './moving-types';

export const MovingReducer: Reducer<MovingState, Actions> = (state = {}, action) => {
  switch (action.type) {
    case MovingActionTypes.MOVE: {
      const { payload } = action;

      console.log('[moving-reducer] MOVE', {
        ids: payload.ids,
        delta: payload.delta,
        idsInElements: payload.ids.filter((id) => id in state),
      });

      return payload.ids.reduce<MovingState>(
        (elements, id) => ({
          ...elements,
          ...(id in elements && {
            [id]: {
              ...elements[id],
              bounds: {
                ...elements[id].bounds,
                x: elements[id].bounds.x + payload.delta.x,
                y: elements[id].bounds.y + payload.delta.y,
              },
            },
          }),
        }),
        state,
      );
    }
  }

  return state;
};
