import type { Editor } from 'grapesjs';

/**
 * Available languages for the Language Switcher component
 */
const AVAILABLE_LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'nl', name: 'Nederlands', flag: '🇳🇱' },
  { code: 'pl', name: 'Polski', flag: '🇵🇱' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
];

/**
 * Generate preview HTML for the language switcher
 */
function generatePreviewHtml(
  variant: string,
  showFlags: boolean,
  showLabels: boolean,
  languageCodes: string[]
): string {
  const selectedLanguages = AVAILABLE_LANGUAGES.filter(lang => 
    languageCodes.includes(lang.code)
  );

  if (variant === 'dropdown') {
    const options = selectedLanguages.map(lang => {
      const label = showFlags && showLabels 
        ? `${lang.flag} ${lang.name}`
        : showFlags ? lang.flag : lang.name;
      return `<option value="${lang.code}">${label}</option>`;
    }).join('');
    
    return `
      <div style="display: inline-flex; align-items: center; gap: 8px; padding: 8px 12px; background: #f5f5f5; border-radius: 8px; border: 1px solid #ddd;">
        <span style="font-size: 14px;">🌐</span>
        <select style="padding: 4px 8px; border: 1px solid #ccc; border-radius: 4px; background: white; cursor: pointer;">
          ${options}
        </select>
      </div>
    `;
  } else if (variant === 'inline') {
    const buttons = selectedLanguages.map(lang => {
      const label = showFlags && showLabels 
        ? `${lang.flag} ${lang.name}`
        : showFlags ? lang.flag : lang.name;
      return `<button style="padding: 6px 12px; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer; margin: 2px;">${label}</button>`;
    }).join('');
    
    return `
      <div style="display: inline-flex; flex-wrap: wrap; gap: 4px; padding: 8px;">
        ${buttons}
      </div>
    `;
  } else {
    // Minimal variant
    const options = selectedLanguages.map(lang => {
      const label = showFlags ? lang.flag : lang.code.toUpperCase();
      return `<option value="${lang.code}">${label}</option>`;
    }).join('');
    
    return `
      <select style="padding: 4px 8px; border: none; background: transparent; cursor: pointer; font-size: 16px;">
        ${options}
      </select>
    `;
  }
}

/**
 * Register the Language Switcher component for GrapesJS
 * Allows users to add a language selector to their UI with configurable languages
 */
export function registerLanguageSwitcherComponent(editor: Editor): void {
  const componentType = 'language-switcher';

  // Default attributes
  const defaultAttributes = {
    'data-gjs-type': componentType,
    class: 'language-switcher-component',
    'variant': 'dropdown',
    'showFlags': 'true',
    'showLabels': 'true',
    'languages': 'en,fr,de,es',
    'defaultLanguage': 'en',
  };

  // Register component type
  editor.DomComponents.addType(componentType, {
    // Ensure the component itself is selected, not its children
    isComponent: (el: HTMLElement) => {
      if (el.getAttribute && el.getAttribute('data-gjs-type') === componentType) {
        return { type: componentType };
      }
      return false;
    },

    model: {
      defaults: {
        tagName: 'div',
        draggable: true,
        droppable: false,
        // Prevent children from being selectable
        propagate: ['selectable', 'hoverable', 'draggable', 'droppable'],
        attributes: { ...defaultAttributes },
        style: {
          display: 'inline-block',
          'min-width': '100px',
        },
      },

      init(this: any) {
        const traits = this.get('traits');
        
        // Build language checkbox traits dynamically
        const languageTraits = AVAILABLE_LANGUAGES.map(lang => ({
          type: 'checkbox',
          label: `${lang.flag} ${lang.name}`,
          name: `lang-${lang.code}`,
          changeProp: 1,
          valueTrue: 'true',
          valueFalse: 'false',
        }));

        // Reset traits with our custom configuration
        traits.reset([
          {
            type: 'select',
            label: 'Style Variant',
            name: 'variant',
            changeProp: 1,
            options: [
              { id: 'dropdown', name: 'Dropdown' },
              { id: 'inline', name: 'Inline Buttons' },
              { id: 'minimal', name: 'Minimal' },
            ],
          },
          {
            type: 'checkbox',
            label: 'Show Flags',
            name: 'showFlags',
            changeProp: 1,
            valueTrue: 'true',
            valueFalse: 'false',
          },
          {
            type: 'checkbox',
            label: 'Show Labels',
            name: 'showLabels',
            changeProp: 1,
            valueTrue: 'true',
            valueFalse: 'false',
          },
          {
            type: 'select',
            label: 'Default Language',
            name: 'defaultLanguage',
            changeProp: 1,
            options: AVAILABLE_LANGUAGES.map(lang => ({
              id: lang.code,
              name: `${lang.flag} ${lang.name}`,
            })),
          },
          // Separator-like label for languages section
          {
            type: 'text',
            label: '── Languages ──',
            name: '_languages_header',
            changeProp: 0,
            attributes: { readonly: true, style: 'display:none' },
          },
          ...languageTraits,
        ]);

        // Initialize trait values from attributes
        const attrs = this.get('attributes') || {};
        
        // Parse the languages string and set individual checkboxes
        const languagesStr = attrs['languages'] || 'en,fr,de,es';
        const enabledLanguages = languagesStr.split(',').map((c: string) => c.trim());
        
        AVAILABLE_LANGUAGES.forEach(lang => {
          const isEnabled = enabledLanguages.includes(lang.code);
          this.set(`lang-${lang.code}`, isEnabled ? 'true' : 'false');
        });

        // Set other traits from attributes
        traits.each((trait: any) => {
          const name = trait.get('name');
          if (attrs[name] !== undefined && !name.startsWith('lang-') && !name.startsWith('_')) {
            this.set(name, attrs[name]);
          }
        });

        // Listen for trait changes and update preview
        this.on('change:variant change:showFlags change:showLabels change:defaultLanguage', this.updatePreview);
        
        // Listen to all language checkbox changes
        AVAILABLE_LANGUAGES.forEach(lang => {
          this.on(`change:lang-${lang.code}`, this.updateLanguagesAndPreview);
        });
        
        // Initial preview
        this.updatePreview();
      },

      // Update the languages attribute from checkboxes and refresh preview
      updateLanguagesAndPreview(this: any) {
        const enabledLanguages = AVAILABLE_LANGUAGES
          .filter(lang => this.get(`lang-${lang.code}`) === 'true')
          .map(lang => lang.code);
        
        // Ensure at least one language is selected
        if (enabledLanguages.length === 0) {
          enabledLanguages.push('en');
          this.set('lang-en', 'true');
        }
        
        // Update the languages attribute
        const attrs = { ...this.get('attributes') };
        attrs['languages'] = enabledLanguages.join(',');
        this.set('attributes', attrs);
        
        this.updatePreview();
      },

      updatePreview(this: any) {
        const attrs = this.get('attributes') || {};
        const variant = attrs['variant'] || this.get('variant') || 'dropdown';
        const showFlags = (attrs['showFlags'] || this.get('showFlags') || 'true') === 'true';
        const showLabels = (attrs['showLabels'] || this.get('showLabels') || 'true') === 'true';
        
        // Get languages from individual checkboxes
        const languageCodes = AVAILABLE_LANGUAGES
          .filter(lang => this.get(`lang-${lang.code}`) === 'true')
          .map(lang => lang.code);
        
        // Fallback to default if none selected
        const finalLanguageCodes = languageCodes.length > 0 ? languageCodes : ['en'];

        const previewHtml = generatePreviewHtml(variant, showFlags, showLabels, finalLanguageCodes);
        
        // Clear existing components and add new ones with non-selectable settings
        this.components().reset();
        this.components().add({
          tagName: 'div',
          selectable: false,
          hoverable: false,
          draggable: false,
          droppable: false,
          copyable: false,
          removable: false,
          highlightable: false,
          content: previewHtml,
          layerable: false,
        });
      },
    },

    view: {
      onRender(this: any) {
        // Ensure the model updates preview on render
        this.model.updatePreview();
      },
    },
  });

  // Add block to the blocks manager
  editor.BlockManager.add(componentType, {
    label: 'Language Switcher',
    category: 'Interactive',
    media: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"/>
      <path d="M2 12h20"/>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>`,
    content: {
      type: componentType,
    },
    attributes: {
      title: 'Drag to add a language switcher for multilingual support',
    },
  });

  console.log('[GrapesJS] Language Switcher component registered');
}

export default registerLanguageSwitcherComponent;
