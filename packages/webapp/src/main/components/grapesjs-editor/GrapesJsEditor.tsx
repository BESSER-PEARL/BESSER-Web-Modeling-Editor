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
import { mapConfig } from './configs/mapConfig';
import { registerChartComponent } from './component-registrars/registerChartComponent';
import { registerMapComponent } from './component-registrars/registerMapComponent';
import { registerButtonComponent } from './component-registrars/registerButtonComponent';
import { registerFormComponents } from './component-registrars/registerFormComponents';
import { registerLayoutComponents } from './component-registrars/registerLayoutComponents';
import { setupPageSystem, loadDefaultPages } from './setup/setupPageSystem';
import { setupLayoutBlocks } from './setup/setupLayoutBlocks';
import { ProjectStorageRepository } from '../../services/storage/ProjectStorageRepository';
import { GrapesJSProjectData, isGrapesJSProjectData, normalizeToGrapesJSProjectData } from '../../types/project';

export const GrapesJsEditor: React.FC = () => {
  const editorRef = useRef<Editor | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize GrapesJS editor with project storage integration
    const editor = grapesjs.init({
      container: containerRef.current,
      height: '100vh',
      width: 'auto',
      fromElement: false,
      
      // Storage configuration - integrate with ProjectStorageRepository
      storageManager: {
        type: 'remote',
        autosave: true,
        autoload: true,
        stepsBeforeSave: 1,
      },

      // Plugins - only essential ones for code generation
      plugins: [
        gjsPresetWebpage as any, 
        gjsStyleBg as any,
        gjsBlocksBasic as any,
        gjsPluginForms as any,
      ],
      pluginsOpts: {
        'grapesjs-preset-webpage': {
          modalImportTitle: 'Import Template',
          modalImportLabel: '<div style="margin-bottom: 10px; font-size: 13px;">Paste here your HTML/CSS and click Import</div>',
          modalImportContent: function(editor: Editor) {
            return editor.getHtml() + '<style>' + editor.getCss() + '</style>';
          },
          filestackOpts: null,
          aviaryOpts: false,
          blocksBasicOpts: {
            // Only blocks supported by the generator
            blocks: ['column1', 'column2', 'column3', 'text', 'link', 'image'],
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
        'grapesjs-blocks-basic': {},
        'grapesjs-plugin-forms': {
          // Form plugin options - keep minimal
          blocks: ['form', 'input', 'textarea', 'select', 'button', 'label', 'checkbox'],
        },
      },

      // Show borders by default
      showOffsets: true,
      
      // Enable absolute positioning with free dragging
      canvas: {
        styles: [],
        scripts: [],
      },
    });
    
    // Enable absolute positioning dragging
    enableAbsolutePositioning(editor);

    // Store editor reference
    editorRef.current = editor;
    (window as any).editor = editor;

    // Setup custom storage manager to use ProjectStorageRepository
    setupProjectStorageIntegration(editor, setSaveStatus);

    // Setup custom commands (export, JSON)
    setupCommands(editor);

    // Setup page management system with route editing
    setupPageSystem(editor);
    setupPageRouting(editor);
    
    // Setup data binding UI
    setupDataBindingTraits(editor);
    
    // Setup layout blocks
    setupLayoutBlocks(editor);
    
    // Setup keyboard shortcuts
    setupKeyboardShortcuts(editor);

    // Register custom components
    chartConfigs.forEach((config) => {
      registerChartComponent(editor, config);
    });

    // Register map component
    registerMapComponent(editor, mapConfig);

    // Register button components (action-button and link-button)
    registerButtonComponent(editor);

    // Register enhanced form components
    registerFormComponents(editor);

    // Register layout components (flex, grid, card)
    registerLayoutComponents(editor);

    // Load storage after everything is initialized
    editor.on('load', () => {
      console.log('[GrapesJsEditor] Editor ready, loading stored data');
      editor.StorageManager.load((data: unknown) => {
        if (data && Object.keys(data as Record<string, unknown>).length > 0) {
          console.log('[GrapesJsEditor] Stored data loaded successfully');
        } else {
          console.log('[GrapesJsEditor] No stored data found, using defaults');
        }
      });
    });

    // Cleanup on unmount
    return () => {
      if (editorRef.current) {
        editorRef.current.destroy();
      }
    };
  }, []);

  return (
    <div ref={containerRef} id="gjs"></div>
  );
};

// Helper: Setup ProjectStorageRepository integration
function setupProjectStorageIntegration(
  editor: Editor,
  setSaveStatus: (status: 'saved' | 'saving' | 'error') => void
) {
  const sm = editor.StorageManager;
  
  // Custom storage implementation
  sm.add('remote', {
    async load() {
      try {
        const project = ProjectStorageRepository.getCurrentProject();
        const model = project?.diagrams?.GUINoCodeDiagram?.model;

        if (isGrapesJSProjectData(model)) {
          console.log('[GrapesJsEditor] Loading GrapesJS data from project storage');

          if (Array.isArray(model.pages) && model.pages.length > 0) {
            return model;
          }

          console.log('[GrapesJsEditor] Stored data has no pages, keeping defaults');
          return {};
        }
        console.log('[GrapesJsEditor] No GrapesJS data found, starting fresh');
        return {};
      } catch (error) {
        console.error('Error loading from project storage:', error);
        setSaveStatus('error');
        return {};
      }
    },
    
    async store(data: unknown) {
      try {
        setSaveStatus('saving');
        const project = ProjectStorageRepository.getCurrentProject();

        if (!project) {
          console.warn('No active project found, cannot save GrapesJS data');
          setSaveStatus('error');
          return;
        }

        // Validate that this could be GrapesJS data
        if (!isGrapesJSProjectData(data)) {
          console.warn('[GrapesJsEditor] Received data that doesn\'t look like GrapesJS format, skipping save');
          setSaveStatus('error');
          return;
        }

        // Normalize to proper GrapesJS format
        const grapesData = normalizeToGrapesJSProjectData(data);

        // Update the GUINoCodeDiagram with GrapesJS data
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
          console.log('[GrapesJsEditor] GrapesJS data saved to project storage');
          setSaveStatus('saved');
          // Show saved notification briefly
          setTimeout(() => {
            updateSaveStatusUI(editor, 'saved');
          }, 100);
        } else {
          console.error('Failed to save GrapesJS data');
          setSaveStatus('error');
        }
      } catch (error) {
        console.error('Error saving to project storage:', error);
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
}

// Helper: Update save status UI
function updateSaveStatusUI(editor: Editor, status: 'saved' | 'saving' | 'error') {
  const statusEl = document.getElementById('save-status-indicator');
  if (statusEl) {
    const icons = {
      saved: '✓',
      saving: '⟳',
      error: '⚠'
    };
    const messages = {
      saved: 'Saved',
      saving: 'Saving...',
      error: 'Error saving'
    };
    const colors = {
      saved: '#27ae60',
      saving: '#3498db',
      error: '#e74c3c'
    };
    
    statusEl.innerHTML = `
      <span style="color: ${colors[status]}; display: flex; align-items: center; gap: 6px;">
        <span style="font-size: 16px; ${status === 'saving' ? 'animation: spin 1s linear infinite;' : ''}">${icons[status]}</span>
        <span style="font-size: 12px; font-weight: 500;">${messages[status]}</span>
      </span>
    `;
  }
}

// Helper: Setup custom commands (export and JSON only)
function setupCommands(editor: Editor) {
  // Enhanced Export template command
  editor.Commands.add('export-template', {
    run(editor: Editor) {
      const html = editor.getHtml();
      const css = editor.getCss();
      const js = `<script>
// GrapesJS Generated Code
console.log('Page loaded successfully');
</script>`;
      
      const fullCode = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>BESSER Generated Page</title>
  <style>
${css}
  </style>
</head>
<body>
${html}
${js}
</body>
</html>`;
      
      const downloadBtn = `
        <button id="download-html-btn" style="margin-bottom: 15px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 14px;">
          📥 Download HTML
        </button>
      `;
      
      editor.Modal.setTitle('Export Template')
        .setContent(`
          <div style="padding: 20px;">
            ${downloadBtn}
            <textarea id="export-code-textarea" style="width:100%; height: 450px; font-family: 'Courier New', monospace; font-size: 12px; padding: 15px; border: 2px solid #ddd; border-radius: 8px; background: #f8f9fa;">${fullCode}</textarea>
          </div>
        `)
        .open();
        
      // Add download functionality
      setTimeout(() => {
        const downloadBtn = document.getElementById('download-html-btn');
        if (downloadBtn) {
          downloadBtn.addEventListener('click', () => {
            const blob = new Blob([fullCode], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'index.html';
            a.click();
            URL.revokeObjectURL(url);
          });
        }
      }, 100);
    },
  });

  // Enhanced Show JSON command
  editor.Commands.add('show-json', {
    run(editor: Editor) {
      const projectData = JSON.stringify(editor.getProjectData(), null, 2);
      
      const downloadBtn = `
        <button id="download-json-btn" style="margin-bottom: 15px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 14px;">
          📥 Download JSON
        </button>
      `;
      
      editor.Modal.setTitle('Project JSON')
        .setContent(`
          <div style="padding: 20px;">
            ${downloadBtn}
            <textarea id="json-data-textarea" style="width:100%; height: 450px; font-family: 'Courier New', monospace; font-size: 12px; padding: 15px; border: 2px solid #ddd; border-radius: 8px; background: #f8f9fa;">${projectData}</textarea>
          </div>
        `)
        .open();
        
      // Add download functionality
      setTimeout(() => {
        const downloadBtn = document.getElementById('download-json-btn');
        if (downloadBtn) {
          downloadBtn.addEventListener('click', () => {
            const blob = new Blob([projectData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'project.json';
            a.click();
            URL.revokeObjectURL(url);
          });
        }
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
  
  // Enhanced Preview command with filtering
  editor.Commands.add('preview-mode', {
    run(editor: Editor) {
      // Filter preview to show only widgets and base components
      setTimeout(() => filterPreviewContent(editor), 100);
      editor.runCommand('preview');
    },
    stop(editor: Editor) {
      editor.stopCommand('preview');
      restorePreviewContent(editor);
    },
  });
  
  // Also filter when using default preview command
  editor.on('run:preview', () => {
    setTimeout(() => filterPreviewContent(editor), 100);
  });
  
  editor.on('stop:preview', () => {
    restorePreviewContent(editor);
  });
}



// Helper: Setup Keyboard Shortcuts
function setupKeyboardShortcuts(editor: Editor) {
  // Add keyboard shortcuts
  editor.on('load', () => {
    const keymaps = editor.Keymaps;
    
    // Save - Ctrl+S / Cmd+S
    keymaps.add('core:save', 'ctrl+s, cmd+s', () => {
      editor.store();
      return false; // Prevent default
    });
    
    // Preview - Ctrl+P / Cmd+P
    keymaps.add('core:preview-toggle', 'ctrl+p, cmd+p', () => {
      editor.runCommand('preview');
      return false;
    });
    
    // Undo - Ctrl+Z / Cmd+Z
    keymaps.add('core:undo', 'ctrl+z, cmd+z', () => {
      editor.runCommand('core:undo');
      return false;
    });
    
    // Redo - Ctrl+Shift+Z / Cmd+Shift+Z
    keymaps.add('core:redo', 'ctrl+shift+z, cmd+shift+z', () => {
      editor.runCommand('core:redo');
      return false;
    });
    
    // Copy - Ctrl+C / Cmd+C
    keymaps.add('core:copy', 'ctrl+c, cmd+c', () => {
      editor.runCommand('core:copy');
      return false;
    });
    
    // Paste - Ctrl+V / Cmd+V
    keymaps.add('core:paste', 'ctrl+v, cmd+v', () => {
      editor.runCommand('core:paste');
      return false;
    });
    
    // Delete - Delete / Backspace
    keymaps.add('core:component-delete', 'delete, backspace', () => {
      const selected = editor.getSelected();
      if (selected) {
        selected.remove();
      }
      return false;
    });
    
    // Duplicate - Ctrl+D / Cmd+D
    keymaps.add('core:component-duplicate', 'ctrl+d, cmd+d', () => {
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
    });
    
    // Select Parent - Escape
    keymaps.add('core:component-select-parent', 'escape', () => {
      const selected = editor.getSelected();
      if (selected) {
        const parent = selected.parent();
        if (parent && parent.get('type') !== 'wrapper') {
          editor.select(parent);
        }
      }
      return false;
    });
    
    // Export - Ctrl+E / Cmd+E
    keymaps.add('core:export', 'ctrl+e, cmd+e', () => {
      editor.runCommand('export-template');
      return false;
    });
    
    // Show JSON - Ctrl+J / Cmd+J
    keymaps.add('core:show-json', 'ctrl+j, cmd+j', () => {
      editor.runCommand('show-json');
      return false;
    });
    
    console.log('[GrapesJsEditor] Keyboard shortcuts registered');
  });
}

// Helper: Setup Page Routing (allow setting custom routes for pages)
function setupPageRouting(editor: Editor) {
  if (!editor.Pages) return;
  
  editor.on('page:select', (page: any) => {
    if (!page) return;
    
    // Add route attribute editing to page traits
    const currentRoute = page.get('attributes')?.route || `/${page.getName().toLowerCase().replace(/\s+/g, '-')}`;
    
    console.log(`[Page Routing] Selected page: ${page.getName()}, route: ${currentRoute}`);
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
      
      const newRoute = prompt(`Edit route path for page "${pageName}":\n\n(e.g., /home, /users/:id, /products)`, currentRoute);
      
      if (newRoute !== null && newRoute.trim()) {
        let route = newRoute.trim();
        if (!route.startsWith('/')) {
          route = '/' + route;
        }
        
        // Set the route attribute
        attrs.route = route;
        attrs['data-route'] = route;
        currentPage.set('attributes', attrs);
        
        console.log(`[Page Routing] Updated route for "${pageName}" to: ${route}`);
        
        alert(`Route updated to: ${route}`);
      }
    }
  });
}

// Helper: Setup Data Binding Traits (allow setting data-source, data-bind on components)
function setupDataBindingTraits(editor: Editor) {
  // Add data binding traits to all component types
  editor.on('component:selected', (component: any) => {
    if (!component) return;
    
    const compType = component.get('type');
    
    // Add data binding traits for components that can bind to data
    const dataBindableTypes = [
      'text',
      'input',
      'select',
      'textarea',
      'default',
      'list',
      'data-list',
      'table'
    ];
    
    if (dataBindableTypes.includes(compType) || component.get('tagName') === 'input') {
      const traits = component.get('traits');
      
      // Check if data binding traits already exist
      const hasDataSource = traits.where({ name: 'data-source' }).length > 0;
      
      if (!hasDataSource) {
        // Add data binding traits
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
        
        console.log('[Data Binding] Added data binding traits to:', compType);
      }
    }
  });
  
  // Add a visual indicator for components with data binding
  editor.on('component:update', (component: any) => {
    const attrs = component.getAttributes();
    if (attrs['data-source'] || attrs['data-bind']) {
      // Add a visual class to indicate data binding
      component.addClass('has-data-binding');
    } else {
      component.removeClass('has-data-binding');
    }
  });
  
  // Add CSS for data binding indicator
  const style = document.createElement('style');
  style.textContent = `
    .has-data-binding {
      outline: 2px dashed #0066cc !important;
      outline-offset: 2px;
      position: relative;
    }
    
    .has-data-binding::before {
      content: 'DATA';
      position: absolute;
      top: -8px;
      right: -8px;
      background: #0066cc;
      color: white;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 9px;
      font-weight: 600;
      letter-spacing: 0.5px;
      z-index: 1000;
      box-shadow: 0 2px 4px rgba(0, 102, 204, 0.3);
    }
  `;
  document.head.appendChild(style);
  
  console.log('[Data Binding] Data binding traits system initialized');
}

// Helper: Enable Absolute Positioning with Free Dragging
function enableAbsolutePositioning(editor: Editor) {
  // Enable canvas drag for absolute positioned elements
  editor.on('load', () => {
    const canvas = editor.Canvas;
    const frame = canvas.getFrameEl();
    
    if (!frame || !frame.contentWindow) return;
    
    const frameDoc = frame.contentWindow.document;
    let isDragging = false;
    let dragTarget: any = null;
    let dragStartX = 0;
    let dragStartY = 0;
    let dragStartLeft = 0;
    let dragStartTop = 0;
    
    // Mouse down on absolute positioned elements
    frameDoc.addEventListener('mousedown', (e: any) => {
      const target = e.target;
      if (!target) return;
      
      // Check if element or parent has absolute positioning
      const el = target.closest('[style*="position: absolute"], [style*="position:absolute"]');
      if (!el) return;
      
      // Find the GrapesJS component for this element
      // Try multiple methods to find the component
      let component: any = null;
      
      // Method 1: Check element's data attribute
      const componentId = el.getAttribute('data-gjs-id');
      if (componentId) {
        const wrapper = editor.getWrapper();
        if (wrapper) {
          component = wrapper.find(`[data-gjs-id="${componentId}"]`)[0];
        }
      }
      
      // Method 2: Walk up DOM to find component
      if (!component) {
        let checkEl: any = el;
        while (checkEl && !component) {
          if (checkEl.__gjscomp) {
            component = checkEl.__gjscomp;
            break;
          }
          if (checkEl.parentElement && checkEl.parentElement !== frameDoc.body) {
            checkEl = checkEl.parentElement;
          } else {
            break;
          }
        }
      }
      
      if (!component) return;
      
      const style = component.getStyle();
      const position = Array.isArray(style.position) ? style.position[0] : style.position;
      
      if (position === 'absolute' || position === 'fixed') {
        isDragging = true;
        dragTarget = component;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        
        // Get current position
        const leftValue = Array.isArray(style.left) ? style.left[0] : style.left;
        const topValue = Array.isArray(style.top) ? style.top[0] : style.top;
        const leftStr = typeof leftValue === 'string' ? leftValue : '0';
        const topStr = typeof topValue === 'string' ? topValue : '0';
        
        const currentLeft = parseInt(leftStr.replace('px', ''), 10);
        const currentTop = parseInt(topStr.replace('px', ''), 10);
        dragStartLeft = isNaN(currentLeft) ? 0 : currentLeft;
        dragStartTop = isNaN(currentTop) ? 0 : currentTop;
        
        el.style.cursor = 'move';
        e.preventDefault();
        e.stopPropagation();
      }
    });
    
    // Mouse move - drag absolute positioned elements
    frameDoc.addEventListener('mousemove', (e: any) => {
      if (!isDragging || !dragTarget) return;
      
      const rect = frame.getBoundingClientRect();
      const deltaX = e.clientX - dragStartX;
      const deltaY = e.clientY - dragStartY;
      
      const newLeft = dragStartLeft + deltaX;
      const newTop = dragStartTop + deltaY;
      
      // Update component position
      dragTarget.setStyle({
        left: `${newLeft}px`,
        top: `${newTop}px`,
      });
      
      e.preventDefault();
    });
    
    // Mouse up - stop dragging
    frameDoc.addEventListener('mouseup', () => {
      if (isDragging && dragTarget) {
        const el = dragTarget.getEl();
        if (el) {
          el.style.cursor = '';
        }
      }
      isDragging = false;
      dragTarget = null;
    });
    
    // Set cursor for absolute positioned elements
    frameDoc.addEventListener('mousemove', (e: any) => {
      if (isDragging) return;
      
      const target = e.target;
      if (!target) return;
      
      const el = target.closest('[style*="position: absolute"], [style*="position:absolute"]');
      if (el) {
        el.style.cursor = 'move';
      }
    });
  });
  
  console.log('[Absolute Positioning] Absolute positioning dragging enabled');
}

// Helper: Filter Preview Content (hide editor elements, keep only widgets and base components)
function filterPreviewContent(editor: Editor) {
  const frame = editor.Canvas.getFrameEl();
  if (!frame || !frame.contentWindow) return;
  
  const frameDoc = frame.contentWindow.document;
  const frameBody = frameDoc.body;
  
  // Remove existing filter style if any
  const existingStyle = frameDoc.getElementById('preview-filter-style');
  if (existingStyle) {
    existingStyle.remove();
  }
  
  // Add CSS to hide editor UI elements in preview
  const style = frameDoc.createElement('style');
  style.id = 'preview-filter-style';
  style.textContent = `
    /* Hide GrapesJS editor UI elements */
    .gjs-selected,
    .gjs-hovered,
    .gjs-highlightable,
    [data-gjs-highlightable],
    [data-gjs-type="toolbar"],
    [data-gjs-type="toolbar-item"],
    .gjs-toolbar,
    .gjs-cv-cover,
    .gjs-cv-canvas > .gjs-cover,
    .gjs-resizer,
    .gjs-ruler,
    .gjs-ruler-v,
    .gjs-ruler-h,
    .gjs-offset-v,
    .gjs-offset-h,
    .gjs-offset,
    .gjs-badge {
      display: none !important;
      visibility: hidden !important;
      opacity: 0 !important;
    }
    
    /* Keep only actual content components - widgets and base components */
    [data-gjs-type]:not([data-gjs-type="toolbar"]):not([data-gjs-type="toolbar-item"]) {
      visibility: visible !important;
      display: block !important;
    }
    
    /* Remove editor overlays */
    .gjs-cv-canvas .gjs-cv-cover,
    .gjs-cv-canvas .gjs-selected,
    .gjs-cv-canvas .gjs-hovered {
      display: none !important;
    }
  `;
  frameDoc.head.appendChild(style);
  
  // Also hide elements programmatically
  const hideSelectors = [
    '.gjs-selected',
    '.gjs-hovered',
    '.gjs-toolbar',
    '.gjs-resizer',
    '.gjs-cv-cover',
    '.gjs-ruler',
    '.gjs-offset',
  ];
  
  hideSelectors.forEach(selector => {
    try {
      const elements = frameBody.querySelectorAll(selector);
      elements.forEach((el: any) => {
        if (el && !el.hasAttribute('data-gjs-type')) {
          el.style.display = 'none';
          el.style.visibility = 'hidden';
          el.style.opacity = '0';
          el.setAttribute('data-preview-hidden', 'true');
        }
      });
    } catch (e) {
      // Ignore errors
    }
  });
  
  console.log('[Preview Filter] Preview content filtered - only widgets and base components visible');
}

// Helper: Restore Preview Content
function restorePreviewContent(editor: Editor) {
  const frame = editor.Canvas.getFrameEl();
  if (!frame || !frame.contentWindow) return;
  
  const frameDoc = frame.contentWindow.document;
  
  // Remove preview filter style
  const filterStyle = frameDoc.getElementById('preview-filter-style');
  if (filterStyle) {
    filterStyle.remove();
  }
  
  // Restore all hidden elements
  const hiddenElements = frameDoc.querySelectorAll('[data-preview-hidden="true"]');
  hiddenElements.forEach((el: any) => {
    el.style.display = '';
    el.style.visibility = '';
    el.removeAttribute('data-preview-hidden');
  });
  
  console.log('[Preview Filter] Preview content restored');
}
