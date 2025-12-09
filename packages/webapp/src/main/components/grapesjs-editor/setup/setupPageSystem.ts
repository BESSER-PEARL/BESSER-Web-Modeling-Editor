import { Editor } from 'grapesjs';

// Guard to prevent duplicate initialization
let pageSystemInitialized = false;
let pagesListRaf: number | null = null;

export function setupPageSystem(editor: Editor) {
  if (pageSystemInitialized) return;
  pageSystemInitialized = true;
  
  console.log('[Page System] Initializing');
  initializePagesPanel(editor);
  setupPageCommands(editor);
  setupPageListeners(editor);
  addPagesPanelCSS();
  
  // Suppress harmless ResizeObserver warning in development
  if (process.env.NODE_ENV === 'development') {
    window.addEventListener('error', e => {
      if (e.message === 'ResizeObserver loop completed with undelivered notifications.') {
        e.stopImmediatePropagation();
      }
    }, true);
  }
}

export function loadDefaultPages(editor: Editor) {
  const pages = editor.Pages;
  if (!pages || pages.getAll().length > 0) return;
  
  const defaults = [
    { id: 'home', name: 'Home' },
    { id: 'about', name: 'About' },
    { id: 'contact', name: 'Contact' }
  ];
  
  defaults.forEach(p => pages.add(p));
  const homePage = pages.get('home');
  if (homePage) pages.select(homePage);
}

function initializePagesPanel(editor: Editor) {
  const container = document.createElement('div');
  container.className = 'pages-panel-container';
  container.style.display = 'none'; // Hidden by default
  container.innerHTML = '<div class="pages-panel-header"><h3>Pages</h3><div class="pages-panel-controls"><button id=\"add-page-btn\" title="Add new page">+</button><button id=\"close-pages-btn\" title="Close panel">×</button></div></div><input type=\"text\" id=\"page-search\" placeholder=\"Search pages...\" /><div id=\"pages-list\"></div>';
  editor.getContainer()?.appendChild(container);
  
  setTimeout(() => {
    document.getElementById('add-page-btn')?.addEventListener('click', () => editor.runCommand('add-page'));
    document.getElementById('close-pages-btn')?.addEventListener('click', () => {
      const panel = document.querySelector('.pages-panel-container') as HTMLElement;
      if (panel) panel.style.display = 'none';
    });
    document.getElementById('page-search')?.addEventListener('input', (e) => {
      const term = (e.target as HTMLInputElement).value.toLowerCase();
      document.querySelectorAll('.page-item').forEach((item: any) => {
        item.style.display = item.textContent?.toLowerCase().includes(term) ? 'flex' : 'none';
      });
    });
  }, 100);
  
  updatePagesList(editor);
}

function updatePagesList(editor: Editor) {
  const list = document.getElementById('pages-list');
  if (!list || !editor.Pages) return;
  
  // Cancel any pending animation frame to prevent multiple updates
  if (pagesListRaf !== null) {
    cancelAnimationFrame(pagesListRaf);
  }
  
  // Defer DOM-heavy operations using requestAnimationFrame
  pagesListRaf = requestAnimationFrame(() => {
    pagesListRaf = null;
    
    const selected = editor.Pages.getSelected();
    list.innerHTML = '';
    
    editor.Pages.getAll().forEach((page: any) => {
      const item = document.createElement('div');
      item.className = 'page-item' + (selected?.getId() === page.getId() ? ' selected' : '');
      item.innerHTML = '<span class="page-name">' + page.getName() + '</span><div class="page-actions"><button class="rename-page-btn" title="Rename page"></button><button class="duplicate-page-btn" title="Duplicate page"></button><button class="delete-page-btn" title="Delete page"></button></div>';
      
      item.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).tagName !== 'BUTTON') editor.Pages.select(page);
      });
      
      item.querySelector('.rename-page-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const newName = prompt('Enter new page name:', page.getName());
        if (newName?.trim()) {
          page.set('name', newName.trim());
          updatePagesList(editor);
        }
      });
      
      item.querySelector('.duplicate-page-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        
        const originalName = page.getName();
        const originalId = page.getId();
        const newName = prompt('Enter name for duplicated page:', originalName + ' Copy');
        if (!newName?.trim()) return;
        
        // Create new page with unique ID
        const newId = newName.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now();
        const newPage = editor.Pages.add({ id: newId, name: newName.trim() });
        
        if (!newPage) {
          return;
        }
        
        // Helper function to recursively remove IDs from components
        const removeComponentIds = (componentArray: any[]): any[] => {
          return componentArray.map((comp: any) => {
            const newComp = { ...comp };
            // Remove the component ID so GrapesJS generates new ones
            delete newComp.id;
            // Also remove ID from attributes if present
            if (newComp.attributes && newComp.attributes.id) {
              delete newComp.attributes.id;
            }
            // Recursively process children
            if (newComp.components && Array.isArray(newComp.components)) {
              newComp.components = removeComponentIds(newComp.components);
            }
            return newComp;
          });
        };
        
        // Helper function to update CSS selectors from old IDs to new IDs
        const updateCssSelectors = (oldId: string, newId: string) => {
          const cssRules = editor.Css.getAll();
          cssRules.forEach((rule: any) => {
            const ruleJSON = rule.toJSON();
            // Check if this rule belongs to the new page and references the old component ID
            if (ruleJSON.pageId === newPage.getId() && ruleJSON.selectors) {
              const updated = ruleJSON.selectors.map((sel: any) => {
                if (typeof sel === 'string' && sel === `#${oldId}`) {
                  return `#${newId}`;
                } else if (sel.name === oldId) {
                  return { ...sel, name: newId };
                }
                return sel;
              });
              if (JSON.stringify(updated) !== JSON.stringify(ruleJSON.selectors)) {
                rule.set('selectors', updated);
              }
            }
          });
        };
        
        // Deep copy components from original page, preserving IDs temporarily for CSS mapping
        const originalComponents = page.getMainComponent()?.components();
        const oldToNewIdMap = new Map<string, string>();
        
        if (originalComponents) {
          const componentsJSON = JSON.parse(JSON.stringify(originalComponents.toJSON()));
          
          // Store old attribute IDs before removing them (these are used in CSS selectors)
          const storeOldIds = (compArray: any[]) => {
            compArray.forEach((comp: any) => {
              if (comp.attributes?.id) {
                oldToNewIdMap.set(comp.attributes.id, ''); // Will fill in new ID later
              }
              if (comp.components && Array.isArray(comp.components)) {
                storeOldIds(comp.components);
              }
            });
          };
          storeOldIds(componentsJSON);
          
          const cleanedComponents = removeComponentIds(componentsJSON);
          
          // Clear any existing components and add fresh ones
          const mainComponent = newPage.getMainComponent();
          if (mainComponent) {
            mainComponent.components().reset();
            const addedComponents = mainComponent.components().add(cleanedComponents);
            
            // Map old attribute IDs to new component IDs by walking the component tree
            const mapNewIds = (oldComps: any[], newComps: any) => {
              const newCompsArray = Array.isArray(newComps) ? newComps : [newComps];
              oldComps.forEach((oldComp, index) => {
                const newComp = newCompsArray[index];
                if (newComp && oldComp.attributes?.id) {
                  const oldAttrId = oldComp.attributes.id;
                  const newCompId = newComp.getId();
                  // Set the new component's attribute ID to match its component ID
                  newComp.addAttributes({ id: newCompId });
                  oldToNewIdMap.set(oldAttrId, newCompId);
                }
                if (oldComp.components && newComp?.components) {
                  mapNewIds(oldComp.components, newComp.components().models);
                }
              });
            };
            mapNewIds(componentsJSON, Array.isArray(addedComponents) ? addedComponents : [addedComponents]);
          }
        }
        
        // Copy styles by getting the CSS string from the original page and applying it to components on the new page
        // This is simpler and more reliable than trying to copy CSS rules
        const copyComponentStyles = (oldComp: any, newComp: any) => {
          // Copy inline styles
          const oldStyle = oldComp.getStyle();
          if (oldStyle && Object.keys(oldStyle).length > 0) {
            newComp.setStyle(oldStyle);
          }
          
          // Copy classes
          const oldClasses = oldComp.getClasses();
          if (oldClasses && oldClasses.length > 0) {
            newComp.setClass(oldClasses);
          }
          
          // Recursively copy styles for children
          const oldChildren = oldComp.components();
          const newChildren = newComp.components();
          if (oldChildren && newChildren && oldChildren.length === newChildren.length) {
            oldChildren.forEach((oldChild: any, index: number) => {
              const newChild = newChildren.at(index);
              if (newChild) {
                copyComponentStyles(oldChild, newChild);
              }
            });
          }
        };
        
        // Copy styles from original page components to new page components
        const originalMainComp = page.getMainComponent();
        const newMainComp = newPage.getMainComponent();
        if (originalMainComp && newMainComp) {
          const originalChildren = originalMainComp.components();
          const newChildren = newMainComp.components();
          
          originalChildren.forEach((oldComp: any, index: number) => {
            const newComp = newChildren.at(index);
            if (newComp) {
              copyComponentStyles(oldComp, newComp);
            }
          });
        }
        
        // Only copy specific page attributes, not all
        // Only copy route_path if it exists
        const originalRoute = page.get('route_path');
        if (originalRoute) {
          newPage.set('route_path', originalRoute + '-copy');
        }
        
        // Select the new page and update the list
        editor.Pages.select(newPage);
        updatePagesList(editor);
      });
      
      item.querySelector('.delete-page-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        
        // Prevent deleting the last page
        const totalPages = editor.Pages.getAll().length;
        if (totalPages <= 1) {
          alert('Cannot delete the last page. At least one page is required.');
          return;
        }
        
        if (confirm('Delete page "' + page.getName() + '"?')) {
          // If deleting the selected page, select another one first
          const isSelected = editor.Pages.getSelected()?.getId() === page.getId();
          
          if (isSelected) {
            const allPages = editor.Pages.getAll();
            const currentIndex = allPages.findIndex((p: any) => p.getId() === page.getId());
            const nextPage = allPages[currentIndex + 1] || allPages[currentIndex - 1];
            if (nextPage) {
              editor.Pages.select(nextPage);
            }
          }
          
          editor.Pages.remove(page);
          updatePagesList(editor);
          console.log(`[Pages] Deleted page: ${page.getName()}`);
        }
      });
      
      list.appendChild(item);
    });
  });
}

function setupPageCommands(editor: Editor) {
  editor.Commands.add('show-pages', {
    run() {
      const panel = document.querySelector('.pages-panel-container') as HTMLElement;
      if (panel) {
        panel.style.display = 'flex';
        updatePagesList(editor);
      }
    },
    stop() {
      const panel = document.querySelector('.pages-panel-container') as HTMLElement;
      if (panel) panel.style.display = 'none';
    }
  });
  
  editor.Commands.add('add-page', {
    run() {
      const name = prompt('Enter page name:');
      if (!name?.trim() || !editor.Pages) return;
      
      const id = name.toLowerCase().replace(/\s+/g, '-');
      const page = editor.Pages.add({ id, name: name.trim() });
      if (page) {
        editor.Pages.select(page);
        updatePagesList(editor);
      }
    }
  });
}

function setupPageListeners(editor: Editor) {
  // Ensure listeners aren't added multiple times
  if ((editor as any).__pagesListenersAttached) return;
  (editor as any).__pagesListenersAttached = true;
  
  const events = ['page:add', 'page:remove', 'page:select', 'page:update'];
  events.forEach(event => editor.on(event, () => updatePagesList(editor)));
  
  editor.on('load', () => {
    setTimeout(() => {
      loadDefaultPages(editor);
      updatePagesList(editor);
    }, 500);
  });
}

function addPagesPanelCSS() {
  const style = document.createElement('style');
  style.textContent = `
    .pages-panel-container {
      position: fixed;
      right: 20px;
      top: 60px;
      width: 280px;
      background: #3b3d46;
      border: 1px solid #2a2b30;
      border-radius: 4px;
      box-shadow: 0 3px 10px rgba(0, 0, 0, 0.3);
      z-index: 1000;
      max-height: 80vh;
      overflow: hidden;
      display: none;
      flex-direction: column;
      font-family: Arial, Helvetica, sans-serif;
    }
    .pages-panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 12px;
      background: #2a2b30;
      color: #ddd;
      border-bottom: 1px solid #1a1b1f;
    }
    .pages-panel-header h3 {
      margin: 0;
      font-size: 13px;
      font-weight: 400;
      flex: 1;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .pages-panel-controls {
      display: flex;
      gap: 6px;
    }
    #add-page-btn, #close-pages-btn {
      background: transparent;
      border: none;
      color: #ddd;
      width: 24px;
      height: 24px;
      cursor: pointer;
      font-size: 18px;
      line-height: 1;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 2px;
    }
    #add-page-btn:hover, #close-pages-btn:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #fff;
    }
    #close-pages-btn {
      font-size: 22px;
    }
    #page-search {
      margin: 10px;
      padding: 6px 10px;
      border: 1px solid #2a2b30;
      background: #2a2b30;
      color: #ddd;
      border-radius: 2px;
      font-size: 12px;
      width: calc(100% - 20px);
      box-sizing: border-box;
    }
    #page-search:focus {
      outline: none;
      border-color: #4e9ffc;
      background: #323439;
    }
    #page-search::placeholder {
      color: #888;
    }
    #pages-list {
      flex: 1;
      overflow-y: auto;
      padding: 8px;
    }
    .page-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 10px;
      margin-bottom: 4px;
      background: #2a2b30;
      border: 1px solid transparent;
      cursor: pointer;
      transition: all 0.2s;
      border-radius: 2px;
    }
    .page-item:hover {
      background: #323439;
      border-color: #4e9ffc;
    }
    .page-item.selected {
      background: #4e9ffc;
      color: #fff;
      border-color: #4e9ffc;
    }
    .page-name {
      font-size: 13px;
      font-weight: 400;
      flex: 1;
      color: #ddd;
    }
    .page-item.selected .page-name {
      color: #fff;
    }
    .page-actions {
      display: flex;
      gap: 2px;
      opacity: 0;
      transition: opacity 0.2s;
    }
    .page-item:hover .page-actions,
    .page-item.selected .page-actions {
      opacity: 1;
    }
    .page-actions button {
      background: transparent;
      border: none;
      padding: 4px 6px;
      cursor: pointer;
      font-size: 14px;
      border-radius: 2px;
      transition: all 0.2s;
      color: #ddd;
    }
    .page-actions button:hover {
      background: rgba(0, 0, 0, 0.2);
    }
    .page-item.selected .page-actions button {
      color: #fff;
    }
    .page-item.selected .page-actions button:hover {
      background: rgba(255, 255, 255, 0.2);
    }
    .rename-page-btn::before {
      content: '✏️';
    }
    .duplicate-page-btn::before {
      content: '📄';
    }
    .delete-page-btn::before {
      content: '🗑️';
    }
    #pages-list::-webkit-scrollbar {
      width: 8px;
    }
    #pages-list::-webkit-scrollbar-track {
      background: #2a2b30;
    }
    #pages-list::-webkit-scrollbar-thumb {
      background: #4e9ffc;
      border-radius: 4px;
    }
    #pages-list::-webkit-scrollbar-thumb:hover {
      background: #5fa9ff;
    }
  `;
  document.head.appendChild(style);
}
