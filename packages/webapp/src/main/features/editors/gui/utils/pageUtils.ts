import i18n from '@/main/shared/i18n';

/**
 * Get page options dynamically from the editor
 * @param editor - GrapesJS editor instance
 * @returns Array of page options for select dropdown
 */
export const getPageOptions = (editor: any) => {
  const options = [
    { value: '', label: i18n.t('editors.gui.utils.selectPage') },
    { value: 'custom', label: i18n.t('editors.gui.utils.customUrl') },
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
