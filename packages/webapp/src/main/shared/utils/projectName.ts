export const normalizeProjectName = (name: string): string => {
  return name.trim().replace(/\s+/g, '_');
};
