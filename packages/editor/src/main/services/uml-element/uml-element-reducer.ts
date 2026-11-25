import { Reducer } from 'redux';
import { Actions } from '../actions';
import { UMLElementActionTypes, UMLElementState } from './uml-element-types';

/**
 * Element types whose `name` is a diagram-wide object identifier and must be
 * unique across the model (the backend rejects an object model with duplicate
 * object names). User-model boxes are dropped from the palette with a fixed
 * `<class>_1` name, so a second drop of the same class — e.g. a `User` per
 * profile, each linked to its own `Personal_Information` — would collide.
 */
const UNIQUE_NAME_TYPES = new Set<string>(['UserModelName']);

/**
 * Return `name` if unused, else the next free `<base><n>` (incrementing a
 * trailing number, or appending `_2`, `_3`, … when there isn't one). Keeps a
 * newly-created box's name unique against everything already in the diagram.
 */
const uniqueName = (name: string, taken: Set<string>): string => {
  if (!taken.has(name)) return name;
  const match = name.match(/^(.*?)(\d+)$/);
  const base = match ? match[1] : `${name}_`;
  let n = match ? parseInt(match[2], 10) + 1 : 2;
  let candidate = `${base}${n}`;
  while (taken.has(candidate)) candidate = `${base}${++n}`;
  return candidate;
};

export const UMLElementReducer: Reducer<UMLElementState, Actions> = (state = {}, action) => {
  switch (action.type) {
    case UMLElementActionTypes.CREATE: {
      const { payload } = action;

      // Names of existing identity-bearing boxes; grows as this batch is added
      // so multiple boxes created at once (e.g. paste) also stay distinct.
      const takenNames = new Set<string>(
        Object.values(state)
          .filter((el: any) => UNIQUE_NAME_TYPES.has(el?.type) && typeof el?.name === 'string')
          .map((el: any) => el.name as string),
      );

      return payload.values.reduce<UMLElementState>((elements, values) => {
        let next = values;
        if (UNIQUE_NAME_TYPES.has((values as any)?.type) && typeof (values as any)?.name === 'string') {
          const resolved = uniqueName((values as any).name, takenNames);
          takenNames.add(resolved);
          if (resolved !== (values as any).name) {
            next = { ...values, name: resolved };
          }
        }
        return { ...elements, [next.id]: next };
      }, state);
    }
    case UMLElementActionTypes.UPDATE: {
      const { payload } = action;

      return payload.values.reduce<UMLElementState>(
        (elements, values) => ({
          ...elements,
          [values.id]: {
            ...elements[values.id],
            ...values,
          },
        }),
        state,
      );
    }
    case UMLElementActionTypes.DELETE: {
      const { payload } = action;

      return Object.keys(state).reduce<UMLElementState>(
        (elements, id) => ({
          ...elements,
          ...(!payload.ids.includes(id) && { [id]: state[id] }),
        }),
        {},
      );
    }
  }

  return state;
};
