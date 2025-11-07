import React, { useEffect, useRef, useState } from 'react';
import grapesjs, { Editor } from 'grapesjs';
import 'grapesjs/dist/css/grapes.min.css';
import gjsPresetWebpage from 'grapesjs-preset-webpage';
import gjsStyleBg from 'grapesjs-style-bg';
// @ts-ignore
import gjsBlocksBasic from 'grapesjs-blocks-basic';
// @ts-ignore
import gjsPluginForms from 'grapesjs-plugin-forms';
import './grapesjs-styles.css';
import { getClassOptions } from './diagram-helpers';
import { chartConfigs } from './configs/chartConfigs';
import { metricCardConfig } from './configs/metricCardConfigs';
import { mapConfig } from './configs/mapConfig';
import { registerChartComponent } from './component-registrars/registerChartComponent';
import { registerMetricCardComponent } from './component-registrars/registerMetricCardComponent';
import { registerMapComponent } from './component-registrars/registerMapComponent';
import { registerButtonComponent } from './component-registrars/registerButtonComponent';
import { registerFormComponents } from './component-registrars/registerFormComponents';
import { registerLayoutComponents } from './component-registrars/registerLayoutComponents';
import { setupPageSystem, loadDefaultPages } from './setup/setupPageSystem';
import { setupLayoutBlocks } from './setup/setupLayoutBlocks';
import { ProjectStorageRepository } from '../../services/storage/ProjectStorageRepository';
import { GrapesJSProjectData, isGrapesJSProjectData, normalizeToGrapesJSProjectData } from '../../types/project';

export const GraphicalUIEditor: React.FC = () => {
  const editorRef = useRef<Editor | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const saveIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    try {
      // Initialize GrapesJS editor
      const editor = initializeEditor(containerRef.current);
      
      // Store editor reference
      editorRef.current = editor;
      (window as any).editor = editor;

      // Setup all editor features
      const cleanup = setupEditorFeatures(editor, setSaveStatus, saveIntervalRef);

      // Register all custom components
      registerCustomComponents(editor);

      // Handle editor load event
      editor.on('load', () => {
        console.log('[GraphicalUIEditor] Editor ready, loading stored data');
        editor.StorageManager.load((data: unknown) => {
          if (data && Object.keys(data as Record<string, unknown>).length > 0) {
            console.log('[GraphicalUIEditor] Stored data loaded successfully');
          } else {
            console.log('[GraphicalUIEditor] No stored data found, using defaults');
          }
        });
      });

      // Cleanup on unmount
      return () => {
        console.log('[GraphicalUIEditor] Cleaning up...');
        
        // Clear save interval
        if (saveIntervalRef.current) {
          clearInterval(saveIntervalRef.current);
          saveIntervalRef.current = null;
        }
        
        // Call cleanup function
        if (cleanup) cleanup();
        
        // Destroy editor
        if (editorRef.current) {
          editorRef.current.destroy();
          editorRef.current = null;
        }
        
        console.log('[GraphicalUIEditor] Cleanup complete');
      };
    } catch (error) {
      console.error('[GraphicalUIEditor] Failed to initialize editor:', error);
    }
  }, []);

  return (
    <div ref={containerRef} id="gjs"></div>
  );
};

// ============================================
// EDITOR INITIALIZATION
// ============================================

/**
 * Initialize GrapesJS editor with configuration
 */
function initializeEditor(container: HTMLDivElement): Editor {
  return grapesjs.init({
    container,
    height: '100vh',
    width: 'auto',
    fromElement: false,
    components: '', // Empty initially - pages will load default content
    
    // Storage configuration
    storageManager: {
      type: 'remote',
      autosave: true,
      autoload: true,
      stepsBeforeSave: 1,
    },

    // Essential plugins only
    plugins: [
      gjsPresetWebpage as any, 
      gjsStyleBg as any,
      gjsBlocksBasic as any,
      // gjsPluginForms as any,
    ],
    
    pluginsOpts: {
      'grapesjs-preset-webpage': {
        modalImportTitle: 'Import Template',
        modalImportLabel: '<div style="margin-bottom: 10px; font-size: 13px;">Paste here your HTML/CSS and click Import</div>',
        modalImportContent: (editor: Editor) => editor.getHtml() + '<style>' + editor.getCss() + '</style>',
        filestackOpts: null,
        aviaryOpts: false,
        blocksBasicOpts: {
          blocks: ['column1', 'column2', 'column3', 'text', 'image'],
          flexGrid: true,
        },
        customStyleManager: [
          {
            name: 'Position',
            open: true,
            buildProps: ['position', 'top', 'right', 'bottom', 'left', 'z-index'],
          },
          {
            name: 'Dimension',
            open: false,
            buildProps: ['width', 'height', 'max-width', 'min-height', 'padding', 'margin'],
          },
          {
            name: 'Typography',
            open: false,
            buildProps: ['font-size', 'font-weight', 'font-family', 'color', 'line-height', 'text-align'],
          },
          {
            name: 'Decorations',
            open: false,
            buildProps: ['background-color', 'border-radius', 'border', 'box-shadow'],
          },
        ],
      },
      'grapesjs-style-bg': {},
      'grapesjs-blocks-basic': {
        blocks: ['column1', 'column2', 'column3', 'text', 'image'],
        flexGrid: true,
      },
      // 'grapesjs-plugin-forms': {
      //   blocks: ['form', 'input', 'textarea', 'select', 'button', 'label', 'checkbox'],
      // },
    },

    showOffsets: true,
    canvas: {
      styles: [],
      scripts: [],
    },
  });
}

/**
 * Setup all editor features in organized order
 */
function setupEditorFeatures(
  editor: Editor, 
  setSaveStatus: (status: 'saved' | 'saving' | 'error') => void,
  saveIntervalRef: React.MutableRefObject<NodeJS.Timeout | null>
): () => void {
  // Core features
  const cleanupStorage = setupProjectStorageIntegration(editor, setSaveStatus, saveIntervalRef);
  setupCommands(editor);
  setupKeyboardShortcuts(editor);
  
  // Remove unwanted blocks after editor loads
  editor.on('load', () => {
    removeUnwantedBlocks(editor);
  });
  
  // Page system (consolidated)
  if (editor.Pages) {
    setupPageSystem(editor);
    setupPageRouting(editor);
    addPagesButton(editor);
  } else {
    console.warn('[GraphicalUIEditor] Pages API not available');
  }
  
  // Additional features
  setupDataBindingTraits(editor);
  setupLayoutBlocks(editor);
  // enableAbsolutePositioning(editor);
  
  // Return cleanup function
  return cleanupStorage;
}

/**
 * Register all custom components
 */
function registerCustomComponents(editor: Editor) {
  // Register charts
  chartConfigs.forEach((config) => {
    registerChartComponent(editor, config);
  });

  // Register metric card
  registerMetricCardComponent(editor, metricCardConfig);

  // Register other components
  registerMapComponent(editor, mapConfig);
  registerButtonComponent(editor);
  // registerFormComponents(editor); // Commented out - forms removed for now
  registerLayoutComponents(editor);
  
  // console.log('[GraphicalUIEditor] All custom components registered');
}

/**
 * Remove unwanted blocks from the Block Manager
 */
function removeUnwantedBlocks(editor: Editor) {
  const blockManager = editor.BlockManager;
  
  // Blocks to explicitly remove (unwanted blocks)
  const blocksToRemove = [
    'link-block',      // Link Block
    'quote',           // Quote
    'link',            // Link
    'video',           // Video
    'map',             // Map (we have custom map in Charts category)
    'sect100',         // Section blocks
    'sect50',
    'sect30',
    'sect37',
    'divider',
    'text-sect',
    // Form blocks (removing for now as requested)
    'form',            // Form
    'input',           // Input Field
    'textarea',        // Text Area
    'select',          // Dropdown
    'button',          // Button (default form button, we have custom)
    'label',           // Label
    'checkbox',        // Checkbox
    'radio',           // Radio
  ];
  
  // Remove unwanted blocks by ID
  blocksToRemove.forEach(blockId => {
    try {
      blockManager.remove(blockId);
      // console.log(`[Block Manager] Removed block: ${blockId}`);
    } catch (e) {
      // Block might not exist, ignore
    }
  });
  
  // console.log('[Block Manager] Unwanted blocks removed, keeping Basic, Layout, and Charts');
}

// ============================================
// STORAGE INTEGRATION
// ============================================

/**
 * Setup ProjectStorageRepository integration
 */
function setupProjectStorageIntegration(
  editor: Editor,
  setSaveStatus: (status: 'saved' | 'saving' | 'error') => void,
  saveIntervalRef: React.MutableRefObject<NodeJS.Timeout | null>
): () => void {
  const sm = editor.StorageManager;
  
  sm.add('remote', {
    async load() {
      try {
        const project = ProjectStorageRepository.getCurrentProject();
        const model = project?.diagrams?.GUINoCodeDiagram?.model;

        if (isGrapesJSProjectData(model)) {
          // console.log('[Storage] Loading GrapesJS data from project storage');
          if (Array.isArray(model.pages) && model.pages.length > 0) {
            return model;
          }
          // console.log('[Storage] Stored data has no pages, keeping defaults');
          return {};
        }
        // console.log('[Storage] No GrapesJS data found, starting fresh');
        return {};
      } catch (error) {
        console.error('[Storage] Error loading:', error);
        setSaveStatus('error');
        return {};
      }
    },
    
    async store(data: unknown) {
      try {
        setSaveStatus('saving');
        const project = ProjectStorageRepository.getCurrentProject();

        if (!project) {
          console.warn('[Storage] No active project found');
          setSaveStatus('error');
          return;
        }

        if (!isGrapesJSProjectData(data)) {
          console.warn('[Storage] Invalid GrapesJS format, skipping save');
          setSaveStatus('error');
          return;
        }

        const grapesData = normalizeToGrapesJSProjectData(data);
        const updated = ProjectStorageRepository.updateDiagram(
          project.id,
          'GUINoCodeDiagram',
          {
            ...project.diagrams.GUINoCodeDiagram,
            model: grapesData,
            lastUpdate: new Date().toISOString(),
          }
        );
        
        if (updated) {
          // console.log('[Storage] Data saved successfully');
          setSaveStatus('saved');
          setTimeout(() => updateSaveStatusUI(editor, 'saved'), 100);
        } else {
          console.error('[Storage] Failed to save data');
          setSaveStatus('error');
        }
      } catch (error) {
        console.error('[Storage] Error saving:', error);
        setSaveStatus('error');
      }
    },
  });
  
  // Listen to storage events
  editor.on('storage:start', () => {
    setSaveStatus('saving');
    updateSaveStatusUI(editor, 'saving');
  });
  
  editor.on('storage:end', () => {
    setSaveStatus('saved');
    updateSaveStatusUI(editor, 'saved');
  });
  
  editor.on('storage:error', () => {
    setSaveStatus('error');
    updateSaveStatusUI(editor, 'error');
  });
  
  // Wait for editor to be fully loaded before setting up auto-save
  let isEditorReady = false;
  
  editor.on('load', () => {
    // Add a delay to ensure everything is fully initialized
    setTimeout(() => {
      isEditorReady = true;
      // console.log('[Storage] Editor fully loaded, auto-save enabled');
      
      let saveTimeout: NodeJS.Timeout | null = null;
      
      // Safe save function that checks if editor is ready
      const safeSave = () => {
        if (!isEditorReady) {
          console.log('[Storage] Editor not ready, skipping save');
          return;
        }
        
        // Check if editor and its internals are still available
        if (!editor || !(editor as any).em || !(editor as any).em.storables) {
          console.log('[Storage] Editor not available or destroyed, skipping save');
          return;
        }
        
        try {
          // console.log('[Storage] Auto-saving changes...');
          editor.store();
        } catch (error) {
          console.error('[Storage] Auto-save error:', error);
        }
      };
      
      // Debounced save function to avoid too many saves
      const debouncedSave = () => {
        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(safeSave, 2000); // Wait 2 seconds after last change
      };
      
      // Auto-save on changes
      editor.on('component:add component:remove component:update', debouncedSave);
      editor.on('page:add page:remove page:update', debouncedSave);
      editor.on('style:update', debouncedSave);
      
      // Periodic backup save every 30 seconds - store in ref so we can clear it
      saveIntervalRef.current = setInterval(() => {
        safeSave();
      }, 30000);
      
      // console.log('[Storage] Auto-save listeners initialized');
    }, 2000); // Wait 2 seconds after load event
  });
  
  // Return cleanup function
  return () => {
    // console.log('[Storage] Cleaning up storage integration');
    isEditorReady = false;
    
    if (saveIntervalRef.current) {
      clearInterval(saveIntervalRef.current);
      saveIntervalRef.current = null;
    }
  };
}

/**
 * Update save status UI indicator
 */
function updateSaveStatusUI(editor: Editor, status: 'saved' | 'saving' | 'error') {
  const statusEl = document.getElementById('save-status-indicator');
  if (!statusEl) return;
  
  const config = {
    saved: { icon: '✓', message: 'Saved', color: '#27ae60' },
    saving: { icon: '⟳', message: 'Saving...', color: '#3498db' },
    error: { icon: '⚠', message: 'Error saving', color: '#e74c3c' }
  };
  
  const { icon, message, color } = config[status];
  const spinAnimation = status === 'saving' ? 'animation: spin 1s linear infinite;' : '';
  
  statusEl.innerHTML = `
    <span style="color: ${color}; display: flex; align-items: center; gap: 6px;">
      <span style="font-size: 16px; ${spinAnimation}">${icon}</span>
      <span style="font-size: 12px; font-weight: 500;">${message}</span>
    </span>
  `;
}

// ============================================
// COMMANDS
// ============================================

/**
 * Setup custom commands for export, JSON, etc.
 */
/**
 * Setup custom commands for export, JSON, etc.
 */
function setupCommands(editor: Editor) {
  // Save project command
  editor.Commands.add('save-project', {
    run(editor: Editor) {
      try {
        console.log('[Save] Manual save triggered');
        
        // Check if editor has storables before trying to save
        const editorModel = (editor as any).em;
        if (!editorModel || !editorModel.storables) {
          console.warn('[Save] Editor not fully initialized yet, please wait a moment');
          alert('Editor is still loading. Please wait a moment and try again.');
          return;
        }
        
        editor.store();
        console.log('[Save] Manual save completed');
      } catch (error) {
        console.error('[Save] Manual save error:', error);
        alert('Error saving project. Please check the console for details.');
      }
    }
  });
  
  // Export template command
  editor.Commands.add('export-template', {
    run(editor: Editor) {
      const html = editor.getHtml() || '';
      const css = editor.getCss() || '';
      const fullCode = generateHTMLTemplate(html, css);
      
      const downloadBtn = createDownloadButton('download-html-btn', '📥 Download HTML');
      
      editor.Modal
        .setTitle('Export Template')
        .setContent(createModalContent(downloadBtn, fullCode, 'export-code-textarea'))
        .open();
        
      setTimeout(() => {
        attachDownloadHandler('download-html-btn', fullCode, 'index.html', 'text/html');
      }, 100);
    },
  });

  // Show JSON command
  editor.Commands.add('show-json', {
    run(editor: Editor) {
      const projectData = JSON.stringify(editor.getProjectData(), null, 2);
      const downloadBtn = createDownloadButton('download-json-btn', '📥 Download JSON');
      
      editor.Modal
        .setTitle('Project JSON')
        .setContent(createModalContent(downloadBtn, projectData, 'json-data-textarea'))
        .open();
        
      setTimeout(() => {
        attachDownloadHandler('download-json-btn', projectData, 'project.json', 'application/json');
      }, 100);
    },
  });
  
  // Clear canvas command
  editor.Commands.add('clear-canvas', {
    run(editor: Editor) {
      if (confirm('Are you sure you want to clear the entire canvas? This cannot be undone.')) {
        editor.DomComponents.clear();
        editor.CssComposer.clear();
      }
    },
  });
  
  // // Preview mode with filtering
  // editor.Commands.add('preview-mode', {
  //   run(editor: Editor) {
  //     setTimeout(() => filterPreviewContent(editor), 100);
  //     editor.runCommand('preview');
  //   },
  //   stop(editor: Editor) {
  //     editor.stopCommand('preview');
  //     restorePreviewContent(editor);
  //   },
  // });
  
//   // Filter preview on default preview command
//   editor.on('run:preview', () => setTimeout(() => filterPreviewContent(editor), 100));
//   editor.on('stop:preview', () => restorePreviewContent(editor));
}

/**
 * Generate HTML template with CSS
 */
function generateHTMLTemplate(html: string, css: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
${css}
  </style>
</head>
<body>
${html}
  <script>
    console.log('Page loaded successfully');
  </script>
</body>
</html>`;
}

/**
 * Create download button HTML
 */
function createDownloadButton(id: string, label: string): string {
  return `
    <button id="${id}" style="margin-bottom: 15px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 14px;">
      ${label}
    </button>
  `;
}

/**
 * Create modal content with textarea
 */
function createModalContent(downloadBtn: string, content: string, textareaId: string): string {
  return `
    <div style="padding: 20px;">
      ${downloadBtn}
      <textarea id="${textareaId}" style="width:100%; height: 450px; font-family: 'Courier New', monospace; font-size: 12px; padding: 15px; border: 2px solid #ddd; border-radius: 8px; background: #f8f9fa;">${content}</textarea>
    </div>
  `;
}

/**
 * Attach download handler to button
 */
function attachDownloadHandler(buttonId: string, content: string, filename: string, mimeType: string) {
  const btn = document.getElementById(buttonId);
  if (btn) {
    btn.addEventListener('click', () => {
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    });
  }
}

// ============================================
// KEYBOARD SHORTCUTS
// ============================================

/**
 * Setup keyboard shortcuts
 */
/**
 * Setup keyboard shortcuts
 */
function setupKeyboardShortcuts(editor: Editor) {
  editor.on('load', () => {
    const keymaps = editor.Keymaps;
    
    const shortcuts = [
      { id: 'core:save', keys: 'ctrl+s, cmd+s', action: () => { editor.store(); return false; } },
      { id: 'core:preview-toggle', keys: 'ctrl+p, cmd+p', action: () => { editor.runCommand('preview'); return false; } },
      { id: 'core:undo', keys: 'ctrl+z, cmd+z', action: () => { editor.runCommand('core:undo'); return false; } },
      { id: 'core:redo', keys: 'ctrl+shift+z, cmd+shift+z', action: () => { editor.runCommand('core:redo'); return false; } },
      { id: 'core:copy', keys: 'ctrl+c, cmd+c', action: () => { editor.runCommand('core:copy'); return false; } },
      { id: 'core:paste', keys: 'ctrl+v, cmd+v', action: () => { editor.runCommand('core:paste'); return false; } },
      { id: 'core:component-delete', keys: 'delete, backspace', action: () => { 
        const selected = editor.getSelected();
        if (selected) selected.remove();
        return false;
      }},
      { id: 'core:component-duplicate', keys: 'ctrl+d, cmd+d', action: () => {
        const selected = editor.getSelected();
        if (selected) {
          const cloned = selected.clone();
          const parent = selected.parent();
          if (parent) {
            parent.append(cloned);
            editor.select(cloned);
          }
        }
        return false;
      }},
      { id: 'core:component-select-parent', keys: 'escape', action: () => {
        const selected = editor.getSelected();
        if (selected) {
          const parent = selected.parent();
          if (parent && parent.get('type') !== 'wrapper') {
            editor.select(parent);
          }
        }
        return false;
      }},
      { id: 'core:export', keys: 'ctrl+e, cmd+e', action: () => { editor.runCommand('export-template'); return false; } },
      { id: 'core:show-json', keys: 'ctrl+j, cmd+j', action: () => { editor.runCommand('show-json'); return false; } },
    ];
    
    shortcuts.forEach(({ id, keys, action }) => {
      keymaps.add(id, keys, action);
    });
    
    // console.log('[Keyboard] Shortcuts registered');
  });
}

// ============================================
// PAGE ROUTING
// ============================================

/**
 * Add Pages button to the toolbar and remove preview button
 */
function addPagesButton(editor: Editor) {
  editor.on('load', () => {
    const panelManager = editor.Panels;
    
    // Remove preview button (eye icon)
    try {
      const previewBtn = document.querySelector('[title="Preview"]');
      if (previewBtn) {
        previewBtn.remove();
        // console.log('[Toolbar] Preview button removed');
      }
    } catch (error) {
      console.warn('[Toolbar] Could not remove preview button:', error);
    }
    
    // Add button to open pages panel
    panelManager.addButton('options', {
      id: 'open-pages',
      className: 'fa fa-file-text',
      command: 'show-pages',
      attributes: { title: 'Manage Pages' },
      label: '<svg viewBox="0 0 24 24" style="width: 18px; height: 18px; fill: currentColor;"><path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" /></svg>',
    });
    
    // console.log('[Pages] Button added to toolbar');
  });
}

/**
 * Setup page routing system
 */
/**
 * Setup page routing system
 */
function setupPageRouting(editor: Editor) {
  if (!editor.Pages) return;
  
  editor.on('page:select', (page: any) => {
    if (!page) return;
    const currentRoute = page.get('attributes')?.route || `/${page.getName().toLowerCase().replace(/\s+/g, '-')}`;
    // console.log(`[Page Routing] Selected: ${page.getName()}, route: ${currentRoute}`);
  });
  
  // Add command to edit page route
  editor.Commands.add('edit-page-route', {
    run(editor: Editor) {
      const currentPage = editor.Pages.getSelected();
      if (!currentPage) {
        alert('No page selected');
        return;
      }
      
      const pageName = currentPage.getName();
      const attrs: any = currentPage.get('attributes') || {};
      const currentRoute = attrs.route || `/${pageName.toLowerCase().replace(/\s+/g, '-')}`;
      
      const newRoute = prompt(
        `Edit route path for page "${pageName}":\n\nExamples:\n- /home\n- /users/:id\n- /products`, 
        currentRoute
      );
      
      if (newRoute !== null && newRoute.trim()) {
        let route = newRoute.trim();
        if (!route.startsWith('/')) route = '/' + route;
        
        attrs.route = route;
        attrs['data-route'] = route;
        currentPage.set('attributes', attrs);
        
        // console.log(`[Page Routing] Updated route for "${pageName}" to: ${route}`);
        alert(`Route updated to: ${route}`);
      }
    }
  });
}

// ============================================
// DATA BINDING
// ============================================

/**
 * Setup data binding traits for components
 */
/**
 * Setup data binding traits for components
 */
function setupDataBindingTraits(editor: Editor) {
  const dataBindableTypes = ['text', 'input', 'select', 'textarea', 'default', 'list', 'data-list', 'table'];
  
  // Add data binding traits to components
  editor.on('component:selected', (component: any) => {
    if (!component) return;
    
    const compType = component.get('type');
    if (!dataBindableTypes.includes(compType) && component.get('tagName') !== 'input') return;
    
    const traits = component.get('traits');
    const hasDataSource = traits.where({ name: 'data-source' }).length > 0;
    
    if (!hasDataSource) {
      traits.add([
        {
          type: 'text',
          label: 'Data Source',
          name: 'data-source',
          placeholder: 'e.g., User or User.name',
          changeProp: 1,
        },
        {
          type: 'text',
          label: 'Display Field',
          name: 'label-field',
          placeholder: 'Field to display',
          changeProp: 1,
        },
        {
          type: 'text',
          label: 'Value Field',
          name: 'value-field',
          placeholder: 'Field for value',
          changeProp: 1,
        }
      ]);
      console.log('[Data Binding] Added traits to:', compType);
    }
  });
  
  // Visual indicator for components with data binding
  editor.on('component:update', (component: any) => {
    const attrs = component.getAttributes();
    if (attrs['data-source'] || attrs['data-bind']) {
      component.addClass('has-data-binding');
    } else {
      component.removeClass('has-data-binding');
    }
  });
  
  console.log('[Data Binding] System initialized');
}

// ============================================
// ABSOLUTE POSITIONING
// ============================================

/**
 * Enable absolute positioning with free dragging
 */
/**
 * Enable absolute positioning with free dragging
 */
function enableAbsolutePositioning(editor: Editor) {
  editor.on('load', () => {
    const canvas = editor.Canvas;
    const frame = canvas.getFrameEl();
    
    if (!frame || !frame.contentWindow) return;
    
    const frameDoc = frame.contentWindow.document;
    let isDragging = false;
    let dragTarget: any = null;
    let dragStart = { x: 0, y: 0, left: 0, top: 0 };
    
    frameDoc.addEventListener('mousedown', (e: any) => {
      const el = e.target?.closest('[style*="position: absolute"], [style*="position:absolute"]');
      if (!el) return;
      
      const component = findComponent(editor, el);
      if (!component) return;
      
      const style = component.getStyle();
      const position = Array.isArray(style.position) ? style.position[0] : style.position;
      
      if (position === 'absolute' || position === 'fixed') {
        isDragging = true;
        dragTarget = component;
        dragStart = {
          x: e.clientX,
          y: e.clientY,
          left: parseStyleValue(style.left),
          top: parseStyleValue(style.top)
        };
        
        el.style.cursor = 'move';
        e.preventDefault();
        e.stopPropagation();
      }
    });
    
    frameDoc.addEventListener('mousemove', (e: any) => {
      if (!isDragging || !dragTarget) return;
      
      const deltaX = e.clientX - dragStart.x;
      const deltaY = e.clientY - dragStart.y;
      
      dragTarget.setStyle({
        left: `${dragStart.left + deltaX}px`,
        top: `${dragStart.top + deltaY}px`,
      });
      
      e.preventDefault();
    });
    
    frameDoc.addEventListener('mouseup', () => {
      if (isDragging && dragTarget) {
        const el = dragTarget.getEl();
        if (el) el.style.cursor = '';
      }
      isDragging = false;
      dragTarget = null;
    });
    
    frameDoc.addEventListener('mousemove', (e: any) => {
      if (isDragging) return;
      const el = e.target?.closest('[style*="position: absolute"], [style*="position:absolute"]');
      if (el) el.style.cursor = 'move';
    });
  });
  
  console.log('[Absolute Positioning] Dragging enabled');
}

/**
 * Find GrapesJS component for DOM element
 */
function findComponent(editor: Editor, el: HTMLElement): any {
  const componentId = el.getAttribute('data-gjs-id');
  if (componentId) {
    const wrapper = editor.getWrapper();
    if (wrapper) {
      const found = wrapper.find(`[data-gjs-id="${componentId}"]`);
      if (found && found[0]) return found[0];
    }
  }
  
  let checkEl: any = el;
  while (checkEl) {
    if (checkEl.__gjscomp) return checkEl.__gjscomp;
    if (!checkEl.parentElement || checkEl.parentElement === el.ownerDocument.body) break;
    checkEl = checkEl.parentElement;
  }
  
  return null;
}

/**
 * Parse CSS style value to number
 */
function parseStyleValue(value: any): number {
  if (Array.isArray(value)) value = value[0];
  if (typeof value !== 'string') return 0;
  const parsed = parseInt(value.replace('px', ''), 10);
  return isNaN(parsed) ? 0 : parsed;
}

// ============================================
// PREVIEW FILTERING
// ============================================

/**
 * Filter preview content to show only widgets and base components
 */
/**
 * Filter preview content to show only widgets and base components
 */
function filterPreviewContent(editor: Editor) {
  const frame = editor.Canvas.getFrameEl();
  if (!frame || !frame.contentWindow) return;
  
  const frameDoc = frame.contentWindow.document;
  
  // Remove existing filter if any
  const existingStyle = frameDoc.getElementById('preview-filter-style');
  if (existingStyle) existingStyle.remove();
  
  // Add CSS to hide editor UI
  const style = frameDoc.createElement('style');
  style.id = 'preview-filter-style';
  style.textContent = `
    .gjs-selected, .gjs-hovered, .gjs-highlightable, [data-gjs-highlightable],
    [data-gjs-type="toolbar"], [data-gjs-type="toolbar-item"], .gjs-toolbar,
    .gjs-cv-cover, .gjs-cv-canvas > .gjs-cover, .gjs-resizer, .gjs-ruler,
    .gjs-ruler-v, .gjs-ruler-h, .gjs-offset-v, .gjs-offset-h, .gjs-offset, .gjs-badge {
      display: none !important;
      visibility: hidden !important;
      opacity: 0 !important;
    }
    [data-gjs-type]:not([data-gjs-type="toolbar"]):not([data-gjs-type="toolbar-item"]) {
      visibility: visible !important;
      display: block !important;
    }
  `;
  frameDoc.head.appendChild(style);
  
  // Hide elements programmatically
  const hideSelectors = ['.gjs-selected', '.gjs-hovered', '.gjs-toolbar', '.gjs-resizer', '.gjs-cv-cover', '.gjs-ruler', '.gjs-offset'];
  hideSelectors.forEach(selector => {
    try {
      frameDoc.body.querySelectorAll(selector).forEach((el: any) => {
        if (el && !el.hasAttribute('data-gjs-type')) {
          el.style.display = 'none';
          el.style.visibility = 'hidden';
          el.setAttribute('data-preview-hidden', 'true');
        }
      });
    } catch (e) {
      // Ignore errors
    }
  });
  
  console.log('[Preview] Content filtered');
}

/**
 * Restore preview content
 */
function restorePreviewContent(editor: Editor) {
  const frame = editor.Canvas.getFrameEl();
  if (!frame || !frame.contentWindow) return;
  
  const frameDoc = frame.contentWindow.document;
  
  // Remove filter style
  const filterStyle = frameDoc.getElementById('preview-filter-style');
  if (filterStyle) filterStyle.remove();
  
  // Restore hidden elements
  frameDoc.querySelectorAll('[data-preview-hidden="true"]').forEach((el: any) => {
    el.style.display = '';
    el.style.visibility = '';
    el.removeAttribute('data-preview-hidden');
  });
  
  console.log('[Preview] Content restored');
}
