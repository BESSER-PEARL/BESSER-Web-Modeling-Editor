import { AutoLayoutAction, AutoLayoutActionTypes } from './auto-layout-types';

export const AutoLayoutRepository = {
  /** Triggers ELK-based auto-layout of the current class diagram. */
  layout: (): AutoLayoutAction => ({
    type: AutoLayoutActionTypes.AUTO_LAYOUT,
    payload: {},
    undoable: false,
  }),
};
