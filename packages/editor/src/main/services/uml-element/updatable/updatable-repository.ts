import { AsyncAction } from '../../../utils/actions/actions';
import { UpdatableActionTypes, UpdateEndAction, UpdateEndAllAction, UpdateStartAction } from './updatable-types';

export const Updatable = {
  updateStart:
    (id: string | string[]): AsyncAction =>
    (dispatch, getState) => {
      const current = getState().updating;
      if (current.length) {
        dispatch<UpdateEndAction>({
          type: UpdatableActionTypes.END,
          payload: { ids: current },
          undoable: false,
        });
      }
      dispatch<UpdateStartAction>({
        type: UpdatableActionTypes.START,
        payload: { ids: Array.isArray(id) ? id : [id] },
        undoable: true,
      });
    },

  updateEnd: (id: string | string[]): UpdateEndAction => ({
    type: UpdatableActionTypes.END,
    payload: { ids: Array.isArray(id) ? id : [id] },
    undoable: false,
  }),

  updateEndAll: (): UpdateEndAllAction => ({
    type: UpdatableActionTypes.ENDALL,
    payload: {},
    undoable: false,
  }),
};
