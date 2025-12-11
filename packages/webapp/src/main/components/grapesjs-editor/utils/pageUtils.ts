/**
 * Get page options dynamically from the editor
 * @param editor - GrapesJS editor instance
 * @returns Array of page options for select dropdown
 */
export const getPageOptions = (editor: any) => {
  const options = [
    { value: '', label: '-- Select Page --' },
    { value: 'custom', label: 'Custom URL' },
  ];
  
  // Check if Pages API is available
  if (!editor.Pages) {
    console.warn('Pages API is not available. Returning default options.');
    return options;
  }
  
  try {
    const pages = editor.Pages.getAll();
    pages.forEach((page: any) => {
      const pageName = page.getName();
      const pageId = page.getId();
      options.push({ 
        value: `page:${pageId}`, 
        label: `📄 ${pageName}` 
      });
    });
  } catch (error) {
    console.warn('Error getting pages:', error);
  }
  
  return options;
};
