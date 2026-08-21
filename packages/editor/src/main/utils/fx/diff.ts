export const diff = <T extends object>(lhs: T, rhs: T): Partial<T> => {
  if (!lhs && !rhs) return {} as Partial<T>;
  if (!lhs) return { ...rhs } as Partial<T>;
  if (!rhs) return {} as Partial<T>;

  const deletedValues = Object.keys(lhs).reduce((acc, key) => {
    return rhs.hasOwnProperty(key) ? acc : { ...acc, [key]: undefined };
  }, {});

  return (Object.keys(rhs) as (keyof T)[]).reduce((acc, key) => {
    if (!lhs.hasOwnProperty(key)) return { ...acc, [key]: rhs[key] };
    if (lhs[key] === rhs[key]) return acc;
    if (Array.isArray(lhs[key])) {
      return { ...acc, [key]: rhs[key] };
    }
    if (typeof lhs[key] === 'object' && lhs[key] !== null && rhs[key] !== null) {
      const difference = diff(lhs[key] as any, rhs[key]);
      if (Object.keys(difference).length) {
        return { ...acc, [key]: diff(lhs[key] as any, rhs[key]) };
      } else {
        return acc;
      }
    }

    return { ...acc, [key]: rhs[key] };
  }, deletedValues);
};
