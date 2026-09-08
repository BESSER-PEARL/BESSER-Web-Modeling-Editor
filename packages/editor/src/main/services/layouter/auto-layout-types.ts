import { Action } from '../../utils/actions/actions';

export const enum AutoLayoutActionTypes {
  AUTO_LAYOUT = '@@layouter/AUTO_LAYOUT',
}

export type AutoLayoutActions = AutoLayoutAction;

export type AutoLayoutAction = Action<AutoLayoutActionTypes.AUTO_LAYOUT>;
