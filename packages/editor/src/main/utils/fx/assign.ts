import { DeepPartial } from 'redux';

export const assign = <T extends { [key: string]: any }>(target: T, source?: DeepPartial<T>): T => {
  // Initialize a nullish target before the branches below dereference
  // `target[key]`. The object/array branches recurse with `target[key]` as the
  // next target, which is `undefined` for a key that doesn't exist yet (e.g. a
  // nested `personalization` spec assigned onto a fresh element). Without this
  // guard that recursion throws, and the throw — swallowed by the editor's
  // model-change notifier — silently drops the whole update from persistence.
  if (target === undefined || target === null) {
    target = (Array.isArray(source) ? [] : {}) as T;
  }
  for (const key in source) {
    if (Array.isArray(source[key])) {
      if (target[key] === undefined) {
        target[key] = [] as any;
      }
      target[key] = [...assign(target[key], source[key])] as any;
    } else if (typeof source[key] === 'object') {
      if (source[key] == null) {
        target[key] = null as any;
      } else {
        target[key] = { ...target[key], ...assign(target[key], source[key]) };
      }
    } else if (source[key] !== undefined) {
      if (target === undefined) {
        target = {} as T;
      }
      target[key] = source[key] as T[Extract<keyof T, string>];
    }
  }

  return target;
};
