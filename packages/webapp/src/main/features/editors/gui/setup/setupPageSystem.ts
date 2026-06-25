import type { Editor } from 'grapesjs';
import { globalConfirm } from '../../../../shared/services/confirm/globalConfirm';
import { LocalStorageRepository } from '../../../../shared/services/storage/local-storage-repository';
import { ProjectStorageRepository } from '../../../../shared/services/storage/ProjectStorageRepository';
import type { UMLModel } from '@besser/wme';

// Track initialization per editor instance
let pagesListRaf: number | null = null;

type PageVariant = {
  id: string;
  profileId: string;
  profileName: string;
  // Serialized GrapesJS page content
  content: string;
  // Serialized styles and CSS
  styles: string;
};

const VARIANT_STORAGE_FIELD = 'besserPageVariants';
const ACTIVE_VARIANT_FIELD = 'besserActiveVariantId';

const getPageVariants = (page: any): PageVariant[] => {
  const raw = page?.get?.(VARIANT_STORAGE_FIELD);
  if (!raw || typeof raw !== 'string') return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
};

const setPageVariants = (page: any, variants: PageVariant[]) => {
  if (!page?.set) return;
  page.set(VARIANT_STORAGE_FIELD, JSON.stringify(variants));
};

const getActiveVariantId = (page: any): string | null => {
  return page?.get?.(ACTIVE_VARIANT_FIELD) || null;
};

const setActiveVariantId = (page: any, variantId: string | null) => {
  if (!page?.set) return;
  page.set(ACTIVE_VARIANT_FIELD, variantId);
};

const getPageRoute = (page: any): string => {
  const name = page?.getName?.() || 'page';
  return page?.get?.('route_path') || '/' + slugify(name);
};

const buildPersonalizedPageName = (baseName: string, profileName: string): string =>
  `${baseName} (${profileName})`;

const buildPersonalizedRoute = (baseRoute: string, profileName: string): string => {
  const routeBase = baseRoute && baseRoute !== '/' ? baseRoute.replace(/\/+$/g, '') : '/page';
  const suffix = slugify(profileName);
  return `${routeBase}-${suffix}`;
};

const createUniquePageId = (baseName: string): string => `${slugify(baseName)}-${Date.now()}`;

const duplicatePageContent = (editor: Editor, sourcePage: any, targetPage: any) => {
  const originalComponents = sourcePage.getMainComponent()?.components();

  const removeComponentIds = (componentArray: any[]): any[] =>
    componentArray.map((comp: any) => {
      const newComp = { ...comp };
      delete newComp.id;
      if (newComp.attributes && newComp.attributes.id) {
        delete newComp.attributes.id;
      }
      if (newComp.components && Array.isArray(newComp.components)) {
        newComp.components = removeComponentIds(newComp.components);
      }
      return newComp;
    });

  const updateCssSelectors = (oldId: string, newId: string) => {
    const cssRules = editor.Css.getAll();
    cssRules.forEach((rule: any) => {
      const ruleJSON = rule.toJSON();
      if (ruleJSON.pageId === targetPage.getId() && ruleJSON.selectors) {
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

  const oldToNewIdMap = new Map<string, string>();

  if (originalComponents) {
    const componentsJSON = JSON.parse(JSON.stringify(originalComponents.toJSON()));

    const storeOldIds = (compArray: any[]) => {
      compArray.forEach((comp: any) => {
        if (comp.attributes?.id) {
          oldToNewIdMap.set(comp.attributes.id, '');
        }
        if (comp.components && Array.isArray(comp.components)) {
          storeOldIds(comp.components);
        }
      });
    };
    storeOldIds(componentsJSON);

    const cleanedComponents = removeComponentIds(componentsJSON);

    const mainComponent = targetPage.getMainComponent();
    if (mainComponent) {
      mainComponent.components().reset();
      const addedComponents = mainComponent.components().add(cleanedComponents);

      const mapNewIds = (oldComps: any[], newComps: any) => {
        const newCompsArray = Array.isArray(newComps) ? newComps : [newComps];
        oldComps.forEach((oldComp, index) => {
          const newComp = newCompsArray[index];
          if (newComp && oldComp.attributes?.id) {
            const oldAttrId = oldComp.attributes.id;
            const newCompId = newComp.getId();
            newComp.addAttributes({ id: newCompId });
            oldToNewIdMap.set(oldAttrId, newCompId);
            updateCssSelectors(oldAttrId, newCompId);
          }
          if (oldComp.components && newComp?.components) {
            mapNewIds(oldComp.components, newComp.components().models);
          }
        });
      };

      mapNewIds(componentsJSON, Array.isArray(addedComponents) ? addedComponents : [addedComponents]);
    }
  }

  const copyComponentStyles = (oldComp: any, newComp: any) => {
    const oldStyle = oldComp.getStyle();
    if (oldStyle && Object.keys(oldStyle).length > 0) {
      newComp.setStyle(oldStyle);
    }

    const oldClasses = oldComp.getClasses();
    if (oldClasses && oldClasses.length > 0) {
      newComp.setClass(oldClasses);
    }

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

  const originalMainComp = sourcePage.getMainComponent();
  const newMainComp = targetPage.getMainComponent();
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
};

const createPageCopy = (
  editor: Editor,
  sourcePage: any,
  newName: string,
  routePath?: string,
  personalizationMeta?: PagePersonalizationMeta | null,
) => {
  const newPage = editor.Pages?.add({ id: createUniquePageId(newName), name: newName.trim() });
  if (!newPage) return null;

  duplicatePageContent(editor, sourcePage, newPage);

  const originalRoute = routePath || getPageRoute(sourcePage);
  if (originalRoute) {
    newPage.set('route_path', originalRoute);
  }

  setPagePersonalizationMeta(newPage, personalizationMeta || null);
  return newPage;
};

const getAvailableProfiles = (): Array<{ id: string; name: string }> => {
  try {
    const project = ProjectStorageRepository.getCurrentProject();
    if (!project) {
      console.log('[Personalization] No project loaded');
      return [];
    }

    // Extract all User Diagram tabs as profiles (same approach as AgentConfigurationPanel)
    const userDiagrams = project.diagrams?.UserDiagram || [];
    const profiles = userDiagrams.map((diagram: any) => ({
      id: diagram.id,
      name: diagram.title || 'Unnamed Profile'
    }));

    console.log('[Personalization] Found profiles from User Diagrams:', profiles);
    return profiles;
  } catch (err) {
    console.warn('[Personalization] Error fetching profiles:', err);
    return [];
  }
};

const openProfilePickerModal = async (
  editor: Editor,
  options: {
    title: string;
    description: string;
    confirmLabel: string;
    onConfirm: (profile: { id: string; name: string }) => void | Promise<void>;
  },
) => {
  const profiles = getAvailableProfiles();
  if (profiles.length === 0) {
    await globalConfirm({
      title: options.title,
      description: 'No user profiles are available. Create a user profile in the User Diagram first, then try again.',
      confirmLabel: 'OK',
      cancelLabel: 'OK',
    });
    return;
  }

  const modal = editor.Modal;
  const selectId = 'gjs-personalization-profile-select';
  const content = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; min-width: 320px;">
      <p style="margin: 0 0 12px; color: #444; line-height: 1.5;">${options.description}</p>
      <label for="${selectId}" style="display:block; margin-bottom:8px; font-size:12px; font-weight:600; color:#333; text-transform:uppercase; letter-spacing:0.04em;">User profile</label>
      <select id="${selectId}" style="width:100%; padding:8px 10px; border:1px solid #ccc; border-radius:6px; font-size:14px; background:white;">
        ${profiles.map((profile) => `<option value="${profile.id}">${profile.name}</option>`).join('')}
      </select>
      <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:16px;">
        <button type="button" id="gjs-personalization-cancel-btn" style="padding:8px 12px; border:1px solid #ccc; border-radius:6px; background:#fff; cursor:pointer;">Cancel</button>
        <button type="button" id="gjs-personalization-confirm-btn" style="padding:8px 12px; border:none; border-radius:6px; background:#2563eb; color:#fff; cursor:pointer;">${options.confirmLabel}</button>
      </div>
    </div>
  `;

  modal.setTitle(options.title);
  modal.setContent(content);
  modal.open();

  setTimeout(() => {
    const cancelBtn = document.getElementById('gjs-personalization-cancel-btn');
    const confirmBtn = document.getElementById('gjs-personalization-confirm-btn');
    const select = document.getElementById(selectId) as HTMLSelectElement | null;

    cancelBtn?.addEventListener('click', () => modal.close());
    confirmBtn?.addEventListener('click', async () => {
      const selectedProfile = profiles.find((profile) => profile.id === select?.value) || profiles[0];
      modal.close();
      await options.onConfirm({ id: selectedProfile.id, name: selectedProfile.name });
    });
  }, 50);
};

export function setupPageSystem(editor: Editor) {
  // Check if this specific editor already has the page system initialized
  if ((editor as any).__pageSystemInitialized) return;
  (editor as any).__pageSystemInitialized = true;
  
  console.log('[Page System] Initializing');
  addPagesPanelCSS();
  setupPagesTabInSidebar(editor);
  setupPageCommands(editor);
  setupPageListeners(editor);
  
  // Suppress harmless ResizeObserver warning in development
  if (import.meta.env.DEV) {
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

/**
 * Setup Pages as a proper tab in the GrapesJS right sidebar
 */
function setupPagesTabInSidebar(editor: Editor) {
  const panelManager = editor.Panels;
  
  // Add the Pages button to the views panel (alongside Blocks, Styles, Layers, etc.)
  editor.on('load', () => {
    // Create and append the pages panel to views-container
    createAndAppendPagesPanel(editor);
    
    panelManager.addButton('views', {
      id: 'open-pages-tab',
      className: 'fa fa-file-alt gjs-pn-btn',
      command: 'open-pages-tab',
      togglable: true,
      attributes: { title: 'Pages' },
      label: `<svg viewBox="0 0 24 24" style="width: 18px; height: 18px; fill: currentColor;">
        <path d="M19,5V19H5V5H19M19,3H5A2,2 0 0,0 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5A2,2 0 0,0 19,3M7,7H9V9H7V7M7,11H9V13H7V11M7,15H9V17H7V15M11,7H17V9H11V7M11,11H17V13H11V11M11,15H17V17H11V15Z" />
      </svg>`,
    });
    
    // Also remove the old floating panel button if exists
    try {
      panelManager.removeButton('options', 'open-pages');
    } catch {
      // Ignore if button doesn't exist
    }
    
    // Initialize the pages list after editor is loaded
    setTimeout(() => updatePagesList(editor), 100);
    
    // Listen for other panel buttons to restore their panels when clicked
    setupPanelSwitchListeners(editor);
  });

  // Add command to toggle pages panel
  editor.Commands.add('open-pages-tab', {
    run(editor: Editor, sender: any) {
      const pagesPanel = document.getElementById('gjs-pages-panel');
      if (pagesPanel) {
        pagesPanel.style.display = 'flex';
        updatePagesList(editor);
      }
      // Hide other panels (blocks, styles, layers, traits)
      hideOtherPanels();
      sender?.set?.('active', true);
    },
    stop(editor: Editor, sender: any) {
      const pagesPanel = document.getElementById('gjs-pages-panel');
      if (pagesPanel) {
        pagesPanel.style.display = 'none';
      }
      // Restore other panels visibility
      restoreOtherPanels();
      sender?.set?.('active', false);
    }
  });
}

/**
 * Setup listeners for other panel buttons to properly restore panels
 */
function setupPanelSwitchListeners(editor: Editor) {
  const panelManager = editor.Panels;
  
  // Get the views panel buttons (Blocks, Styles, Layers, etc.)
  const viewsPanel = panelManager.getPanel('views');
  if (!viewsPanel) return;
  
  const buttons = viewsPanel.get('buttons');
  if (!buttons) return;
  
  // Listen to each button's active state change
  buttons.forEach((btn: any) => {
    const btnId = btn.get('id');
    // Skip our pages tab button
    if (btnId === 'open-pages-tab') return;
    
    // When another button becomes active, hide pages panel and restore other panels
    btn.on('change:active', (model: any, active: boolean) => {
      if (active) {
        const pagesPanel = document.getElementById('gjs-pages-panel');
        if (pagesPanel) {
          pagesPanel.style.display = 'none';
        }
        restoreOtherPanels();
        
        // Deactivate pages button
        const pagesBtn = panelManager.getButton('views', 'open-pages-tab');
        if (pagesBtn) {
          pagesBtn.set('active', false);
        }
      }
    });
  });
}

/**
 * Create and append the Pages panel to views-container
 */
function createAndAppendPagesPanel(editor: Editor) {
  // Check if panel already exists
  if (document.getElementById('gjs-pages-panel')) return;
  
  const viewsContainer = document.querySelector('.gjs-pn-views-container');
  if (!viewsContainer) {
    console.warn('[Pages] views-container not found');
    return;
  }
  
  const container = document.createElement('div');
  container.id = 'gjs-pages-panel';
  container.className = 'gjs-pages-panel';
  container.style.display = 'none';
  
  container.innerHTML = `
    <div class="gjs-pages-header">
      <span class="gjs-pages-title">Pages</span>
    </div>
    <div class="gjs-pages-search-container">
      <input type="text" id="gjs-page-search" class="gjs-pages-search" placeholder="Search pages..." />
    </div>
    <div class="gjs-pages-actions">
      <button id="gjs-add-page-btn" class="gjs-pages-add-btn" title="Add new page" aria-label="Add new page">
        <svg viewBox="0 0 24 24" style="width: 16px; height: 16px; fill: currentColor;">
          <path d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z" />
        </svg>
        <span>Add Page</span>
      </button>
    </div>
    <div id="gjs-pages-list" class="gjs-pages-list"></div>
  `;
  
  viewsContainer.appendChild(container);
  
  // Setup event listeners
  document.getElementById('gjs-add-page-btn')?.addEventListener('click', () => {
    editor.runCommand('add-page');
  });
  
  document.getElementById('gjs-page-search')?.addEventListener('input', (e) => {
    const term = (e.target as HTMLInputElement).value.toLowerCase();
    document.querySelectorAll('.gjs-page-item').forEach((item: any) => {
      const nameEl = item.querySelector('.gjs-page-name');
      const name = nameEl?.textContent?.toLowerCase() || '';
      item.style.display = name.includes(term) ? 'flex' : 'none';
    });
  });
}

/**
 * Hide other GrapesJS panels when Pages tab is active
 */
function hideOtherPanels() {
  // GrapesJS default panels
  const panelSelectors = [
    '.gjs-block-categories',
    '.gjs-blocks-c', 
    '.gjs-sm-sectors',
    '.gjs-layer-items',
    '.gjs-clm-tags',
    '.gjs-trt-traits',
  ];
  
  panelSelectors.forEach(selector => {
    const panel = document.querySelector(selector) as HTMLElement;
    if (panel) {
      panel.style.display = 'none';
    }
  });
}

/**
 * Restore other GrapesJS panels when switching away from Pages tab
 */
function restoreOtherPanels() {
  // Restore GrapesJS default panels
  const panelSelectors = [
    '.gjs-block-categories',
    '.gjs-blocks-c', 
    '.gjs-sm-sectors',
    '.gjs-layer-items',
    '.gjs-clm-tags',
    '.gjs-trt-traits',
  ];
  
  panelSelectors.forEach(selector => {
    const panel = document.querySelector(selector) as HTMLElement;
    if (panel) {
      panel.style.display = '';
    }
  });
}

function updatePagesList(editor: Editor) {
  const list = document.getElementById('gjs-pages-list');
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
      const pageRoute = getPageRoute(page);
      const variants = getPageVariants(page);
      const activeVariantId = getActiveVariantId(page);
      const item = document.createElement('div');
      item.className = 'gjs-page-item' + (selected?.getId() === page.getId() ? ' selected' : '');
      
      let variantLabel = 'Base';
      if (activeVariantId && variants.length > 0) {
        const activeVariant = variants.find(v => v.id === activeVariantId);
        variantLabel = activeVariant?.profileName || 'Base';
      }
      
      item.innerHTML = `
        <div class="gjs-page-info">
          <span class="gjs-page-name">${page.getName()}</span>
          ${variants.length > 0 ? `<span class="gjs-page-profile">${variantLabel}${variants.length > 1 ? ` (+${variants.length - 1} more)` : ''}</span>` : ''}
          <span class="gjs-page-route">${pageRoute}</span>
        </div>
        <div class="gjs-page-actions">
          <button class="gjs-page-btn route-page-btn" title="Edit URL route" aria-label="Edit URL route">
            <svg viewBox="0 0 24 24" style="width: 14px; height: 14px; fill: currentColor;">
              <path d="M10.59,13.41C11,13.8 11,14.44 10.59,14.83C10.2,15.22 9.56,15.22 9.17,14.83C6.22,11.88 6.22,7.12 9.17,4.17C12.12,1.22 16.88,1.22 19.83,4.17C22.78,7.12 22.78,11.88 19.83,14.83C19.44,15.22 18.8,15.22 18.41,14.83C18,14.44 18,13.8 18.41,13.41C20.59,11.23 20.59,7.77 18.41,5.59C16.23,3.41 12.77,3.41 10.59,5.59C8.41,7.77 8.41,11.23 10.59,13.41M13.41,9.17C13.8,8.78 14.44,8.78 14.83,9.17C17.78,12.12 17.78,16.88 14.83,19.83C11.88,22.78 7.12,22.78 4.17,19.83C1.22,16.88 1.22,12.12 4.17,9.17C4.56,8.78 5.2,8.78 5.59,9.17C6,9.56 6,10.2 5.59,10.59C3.41,12.77 3.41,16.23 5.59,18.41C7.77,20.59 11.23,20.59 13.41,18.41C15.59,16.23 15.59,12.77 13.41,10.59C13,10.2 13,9.56 13.41,9.17Z" />
            </svg>
          </button>
          <button class="gjs-page-btn rename-page-btn" title="Rename page" aria-label="Rename page">
            <svg viewBox="0 0 24 24" style="width: 14px; height: 14px; fill: currentColor;">
              <path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z" />
            </svg>
          </button>
          <button class="gjs-page-btn duplicate-page-btn" title="Duplicate page" aria-label="Duplicate page">
            <svg viewBox="0 0 24 24" style="width: 14px; height: 14px; fill: currentColor;">
              <path d="M19,21H8V7H19M19,5H8A2,2 0 0,0 6,7V21A2,2 0 0,0 8,23H19A2,2 0 0,0 21,21V7A2,2 0 0,0 19,5M16,1H4A2,2 0 0,0 2,3V17H4V3H16V1Z" />
            </svg>
          </button>
          <button class="gjs-page-btn add-variant-btn" title="Add personalized variant" aria-label="Add personalized variant">
            <svg viewBox="0 0 24 24" style="width: 14px; height: 14px; fill: currentColor;">
              <path d="M12,12A4,4 0 1,0 8,8A4,4 0 0,0 12,12M12,14C9.33,14 4,15.33 4,18V20H20V18C20,15.33 14.67,14 12,14M19,8V5H17V8H14V10H17V13H19V10H22V8Z" />
            </svg>
          </button>
          ${variants.length > 0 ? `
          <select class="gjs-page-variants-select" title="Switch variant" aria-label="Switch variant" style="padding: 4px; border-radius: 4px; border: 1px solid #ccc; font-size: 12px;">
            <option value="">Base</option>
            ${variants.map(v => `<option value="${v.id}" ${activeVariantId === v.id ? 'selected' : ''}>${v.profileName}</option>`).join('')}
          </select>
          ` : ''}
          <button class="gjs-page-btn delete-page-btn" title="Delete page" aria-label="Delete page">
            <svg viewBox="0 0 24 24" style="width: 14px; height: 14px; fill: currentColor;">
              <path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z" />
            </svg>
          </button>
        </div>
      `;
      
      item.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.tagName !== 'BUTTON' && !target.closest('button') && target.tagName !== 'SELECT' && target.tagName.toLowerCase() !== 'option') {
          editor.Pages.select(page);
        }
      });
      
      // Route edit button
      item.querySelector('.route-page-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const currentRoute = page.get('route_path') || '/' + page.getName().toLowerCase().replace(/\s+/g, '-');
        const newRoute = prompt('Enter URL route for this page (e.g., /about-us):', currentRoute);
        if (newRoute !== null) {
          // Ensure route starts with /
          let cleanRoute = newRoute.trim();
          if (cleanRoute && !cleanRoute.startsWith('/')) {
            cleanRoute = '/' + cleanRoute;
          }
          // Clean the route - only allow alphanumeric, hyphens, underscores, and slashes
          cleanRoute = cleanRoute.replace(/[^a-zA-Z0-9\-_\/]/g, '');
          page.set('route_path', cleanRoute || '/');
          updatePagesList(editor);
        }
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
        const newName = prompt('Enter name for duplicated page:', originalName + ' Copy');
        if (!newName?.trim()) return;
        const newPage = editor.Pages?.add({ id: createUniquePageId(newName), name: newName.trim() });
        if (newPage) {
          editor.Pages.select(newPage);
        }
        updatePagesList(editor);
      });

      // Variant dropdown: switch between personalization variants
      (item.querySelector('.gjs-page-variants-select') as HTMLSelectElement)?.addEventListener('change', (e) => {
        e.stopPropagation();
        const select = e.target as HTMLSelectElement;
        const selectedVariantId = select.value;
        
        if (!selectedVariantId) {
          // Switch back to base (empty activeVariantId)
          setActiveVariantId(page, null);
        } else {
          const variants = getPageVariants(page);
          const variant = variants.find(v => v.id === selectedVariantId);
          if (variant) {
            setActiveVariantId(page, variant.id);
            // Load variant content into the page
            try {
              const content = JSON.parse(variant.content);
              page.frames().forEach((frame: any) => frame.remove());
              const styles = JSON.parse(variant.styles);
              page.setStyle(styles);
              const html = content.html || '';
              const components = content.components || [];
              components.forEach((comp: any) => {
                page.addComponent(comp);
              });
            } catch (err) {
              console.warn('[Personalization] Error loading variant content:', err);
            }
          }
        }
        updatePagesList(editor);
      });

      // Add variant button
      item.querySelector('.add-variant-btn')?.addEventListener('click', async (e) => {
        e.stopPropagation();

        await openProfilePickerModal(editor, {
          title: 'Create page variant',
          description: `Choose a user profile to create a personalized variant of "${page.getName()}".`,
          confirmLabel: 'Create variant',
          onConfirm: async (profile) => {
            // Check if variant already exists for this profile
            const variants = getPageVariants(page);
            if (variants.some(v => v.profileId === profile.id)) {
              // Switch to existing variant
              setActiveVariantId(page, variants.find(v => v.profileId === profile.id)!.id);
              updatePagesList(editor);
              return;
            }

            // Capture current page content as a variant
            const currentContent = {
              html: page.getHtml?.() || '',
              components: page.getComponents?.() || []
            };
            const currentStyles = page.getStyle?.() || {};
            
            const newVariant: PageVariant = {
              id: `variant-${profile.id}-${Date.now()}`,
              profileId: profile.id,
              profileName: profile.name,
              content: JSON.stringify(currentContent),
              styles: JSON.stringify(currentStyles),
            };

            const updatedVariants = [...variants, newVariant];
            setPageVariants(page, updatedVariants);
            setActiveVariantId(page, newVariant.id);
            updatePagesList(editor);
          },
        });
      });
      
      item.querySelector('.delete-page-btn')?.addEventListener('click', async (e) => {
        e.stopPropagation();

        // Prevent deleting the last page
        const totalPages = editor.Pages.getAll().length;
        if (totalPages <= 1) {
          await globalConfirm({
            title: 'Cannot Delete Page',
            description: 'Cannot delete the last page. At least one page is required.',
            confirmLabel: 'OK',
            cancelLabel: 'OK',
          });
          return;
        }

        const confirmed = await globalConfirm({
          title: 'Delete Page',
          description: 'Delete page "' + page.getName() + '"?',
          confirmLabel: 'Delete',
          variant: 'danger',
        });
        if (confirmed) {
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
  // Legacy command for backwards compatibility - now redirects to the new tab command
  editor.Commands.add('show-pages', {
    run() {
      editor.runCommand('open-pages-tab');
    },
    stop() {
      editor.stopCommand('open-pages-tab');
    }
  });
  
  editor.Commands.add('add-page', {
    run() {
      const name = prompt('Enter page name:');
      if (!name?.trim() || !editor.Pages) return;
      
      const id = name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now();
      const page = editor.Pages.add({ id, name: name.trim() });
      if (page) {
        editor.Pages.select(page);
        updatePagesList(editor);
      }
    }
  });

  editor.Commands.add('personalize-page', {
    async run() {
      const selectedPage = editor.Pages?.getSelected();
      if (!selectedPage) {
        return;
      }

      const meta = getPagePersonalizationMeta(selectedPage);
      const basePage = meta ? findPageById(editor, meta.basePageId) : selectedPage;
      if (!basePage) {
        return;
      }

      await openProfilePickerModal(editor, {
        title: 'Create personalized page',
        description: `Choose a saved user profile. A personalized copy of "${basePage.getName()}" will be created for that profile.`,
        confirmLabel: 'Create copy',
        onConfirm: async (profile) => {
          const existing = findPersonalizedPageForProfile(editor, basePage.getId(), profile.id);
          if (existing) {
            editor.Pages.select(existing);
            updatePagesList(editor);
            return;
          }

          const personalizedName = buildPersonalizedPageName(basePage.getName(), profile.name);
          const personalizedRoute = buildPersonalizedRoute(getPageRoute(basePage), profile.name);
          const newPage = createPageCopy(editor, basePage, personalizedName, personalizedRoute, {
            basePageId: basePage.getId(),
            basePageName: basePage.getName(),
            profileId: profile.id,
            profileName: profile.name,
          });

          if (newPage) {
            editor.Pages.select(newPage);
            updatePagesList(editor);
          }
        },
      });
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
  // Check if CSS is already added
  if (document.getElementById('gjs-pages-panel-css')) return;
  
  const style = document.createElement('style');
  style.id = 'gjs-pages-panel-css';
  style.textContent = `
    /* Pages Panel - Integrated into GrapesJS sidebar */
    .gjs-pages-panel {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: #ffffff;
      display: flex;
      flex-direction: column;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    
    .gjs-pages-header {
      display: flex;
      justify-content: flex-start;
      align-items: center;
      padding: 10px 12px;
      background: #f5f5f5;
      border-bottom: 1px solid #ddd;
    }
    
    .gjs-pages-title {
      font-size: 12px;
      font-weight: 600;
      color: #333;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .gjs-pages-actions {
      padding: 8px 12px;
      border-bottom: 1px solid #eee;
    }
    
    .gjs-pages-add-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      width: 100%;
      height: 34px;
      background: #0066cc;
      border: none;
      border-radius: 4px;
      color: white;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .gjs-pages-add-btn:hover {
      background: #0052a3;
    }
    
    .gjs-pages-add-btn svg {
      flex-shrink: 0;
    }
    
    .gjs-pages-search-container {
      padding: 8px 12px;
    }
    
    .gjs-pages-search {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 13px;
      background: #fff;
      color: #333;
      box-sizing: border-box;
    }
    
    .gjs-pages-search:focus {
      outline: none;
      border-color: #0066cc;
      box-shadow: 0 0 0 2px rgba(0, 102, 204, 0.1);
    }
    
    .gjs-pages-search::placeholder {
      color: #999;
    }
    
    .gjs-pages-list {
      flex: 1;
      overflow-y: auto;
      padding: 8px;
    }
    
    .gjs-page-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 12px;
      margin-bottom: 4px;
      background: #f9f9f9;
      border: 1px solid #eee;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .gjs-page-item:hover {
      background: #f0f0f0;
      border-color: #0066cc;
    }
    
    .gjs-page-item.selected {
      background: #0066cc;
      border-color: #0066cc;
    }
    
    .gjs-page-info {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-width: 0;
      gap: 2px;
    }

    .gjs-page-profile {
      display: inline-flex;
      align-self: flex-start;
      padding: 1px 6px;
      border-radius: 999px;
      background: rgba(37, 99, 235, 0.12);
      color: #1d4ed8;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.02em;
      text-transform: uppercase;
    }
    
    .gjs-page-name {
      font-size: 13px;
      font-weight: 500;
      color: #333;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .gjs-page-route {
      font-size: 11px;
      color: #888;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-family: monospace;
    }
    
    .gjs-page-item.selected .gjs-page-name {
      color: #fff;
    }
    
    .gjs-page-item.selected .gjs-page-route {
      color: rgba(255, 255, 255, 0.7);
    }
    
    .gjs-page-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      opacity: 0;
      transition: opacity 0.2s;
      justify-content: flex-end;
    }
    
    .gjs-page-item:hover .gjs-page-actions,
    .gjs-page-item.selected .gjs-page-actions {
      opacity: 1;
    }
    
    .gjs-page-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 26px;
      height: 26px;
      background: transparent;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      color: #666;
      transition: all 0.2s;
    }
    
    .gjs-page-btn:hover {
      background: rgba(0, 0, 0, 0.1);
      color: #333;
    }
    
    .gjs-page-item.selected .gjs-page-btn {
      color: rgba(255, 255, 255, 0.8);
    }
    
    .gjs-page-item.selected .gjs-page-btn:hover {
      background: rgba(255, 255, 255, 0.2);
      color: #fff;
    }
    
    .gjs-page-btn.delete-page-btn:hover {
      background: #e74c3c;
      color: white;
    }
    
    .gjs-page-item.selected .gjs-page-btn.delete-page-btn:hover {
      background: #c0392b;
    }
    
    /* Scrollbar styling */
    .gjs-pages-list::-webkit-scrollbar {
      width: 6px;
    }
    
    .gjs-pages-list::-webkit-scrollbar-track {
      background: #f5f5f5;
    }
    
    .gjs-pages-list::-webkit-scrollbar-thumb {
      background: #ccc;
      border-radius: 3px;
    }
    
    .gjs-pages-list::-webkit-scrollbar-thumb:hover {
      background: #999;
    }
    
    /* Hide the old floating panel if it exists */
    .pages-panel-container {
      display: none !important;
    }
  `;
  document.head.appendChild(style);
}

