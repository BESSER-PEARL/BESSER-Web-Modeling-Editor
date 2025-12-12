import { getPageOptions } from '../utils/pageUtils';
import { getClassOptions, getMethodOptions, getMethodsByClassId, getTableOptions } from '../diagram-helpers';

/**
 * Register enhanced button component with actions (navigation, CRUD operations)
 * @param editor - GrapesJS editor instance
 */
export const registerButtonComponent = (editor: any) => {
  // Enhanced Action Button
  editor.Components.addType('action-button', {
    model: {
      defaults: {
        tagName: 'button',
        draggable: true,
        droppable: false,
        attributes: { 
          class: 'action-button-component',
          type: 'button',
        },
        style: {
          display: 'inline-flex',
          'align-items': 'center',
          padding: '6px 14px',
          background: 'linear-gradient(90deg, #2563eb 0%, #1e40af 100%)',
          color: '#fff',
          'text-decoration': 'none',
          'border-radius': '4px',
          'font-size': '13px',
          'font-weight': '600',
          'letter-spacing': '0.01em',
          cursor: 'pointer',
          border: 'none',
          'box-shadow': '0 1px 4px rgba(37,99,235,0.10)',
          transition: 'background 0.2s',
        },
        content: 'Button',
        'button-label': 'Button',
        'action-type': 'navigate',
        'button-style': 'primary',
        'target-screen': '',
        'target-form': '',
        'crud-entity': '',
        'confirmation-required': false,
        'confirmation-message': 'Are you sure?',
        'on-success-action': 'none',
        'success-message': 'Action completed successfully',
      },
      init(this: any) {
        // Initialize components array with textnode for label extraction
        const label = this.get('button-label') || 'Button';
        const components = this.get('components');
        if (!components || components.length === 0) {
          this.components([{
            type: 'textnode',
            content: label
          }]);
        }
        
        // Dynamic trait visibility
        this.on('change:action-type', this.updateTraitVisibility);
        this.on('change:confirmation-required', this.updateTraitVisibility);
        this.on('change:method-class', this.updateMethodOptions);
        this.on('change:button-label change:button-style change:action-type', this.updateButton);
        
        // Set up traits with proper visibility from the start
        this.updateTraitVisibility();
        this.updateMethodOptions();
        
        // Refresh options when pages change
        editor.on('component:add component:remove', () => {
          setTimeout(() => this.updateTraitVisibility(), 100);
        });
      },
      updateTraitVisibility(this: any) {
        const actionType = this.get('action-type');
        const confirmRequired = this.get('confirmation-required');
        const traits = this.get('traits');
        const pageOptions = getPageOptions(editor);
        const classOptions = getClassOptions();
        
        console.log('[Button] Updating trait visibility for action type:', actionType);
        
        // Base traits that are always visible
        const baseTraits = [
          {
            type: 'text',
            label: 'Button Label',
            name: 'button-label',
            changeProp: 1,
          },
          {
            type: 'select',
            label: 'Button Style',
            name: 'button-style',
            changeProp: 1,
            options: [
              { value: 'primary', label: 'Primary' },
              { value: 'secondary', label: 'Secondary' },
              { value: 'success', label: 'Success' },
              { value: 'danger', label: 'Danger' },
              { value: 'warning', label: 'Warning' },
              { value: 'info', label: 'Info' },
            ],
          },
          {
            type: 'select',
            label: 'Action Type',
            name: 'action-type',
            changeProp: 1,
            options: [
              { value: 'navigate', label: 'Navigate to Screen' },
              { value: 'run-method', label: 'Run Method' },
              { value: 'create', label: 'Create Entity' },
              { value: 'update', label: 'Update Entity' },
              { value: 'delete', label: 'Delete Entity' },
            ],
          },
        ];
        
        // Action-specific traits
        const actionSpecificTraits: any[] = [];
        
        if (actionType === 'navigate') {
          actionSpecificTraits.push(
            {
              type: 'select',
              label: 'Target Screen',
              name: 'target-screen',
              changeProp: 1,
              options: pageOptions,
            },
            {
              type: 'checkbox',
              label: 'Require Confirm',
              name: 'confirmation-required',
              changeProp: 1,
            }
          );
          
          // Add Confirmation Message only if confirmation is required
          if (confirmRequired) {
            actionSpecificTraits.push({
              type: 'text',
              label: 'Confirm Message',
              name: 'confirmation-message',
              changeProp: 1,
            });
          }
        } else if (actionType === 'run-method') {
          actionSpecificTraits.push(
            {
              type: 'select',
              label: 'Method Class',
              name: 'method-class',
              changeProp: 1,
              options: classOptions,
            },
            {
              type: 'select',
              label: 'Method Name',
              name: 'method-name',
              changeProp: 1,
              options: [],
            },
            {
              type: 'select',
              label: 'Instance Source',
              name: 'instance-source',
              changeProp: 1,
              options: getTableOptions(editor),
            },
            {
              type: 'checkbox',
              label: 'Require Confirm',
              name: 'confirmation-required',
              changeProp: 1,
            }
          );
          
          // Add Confirmation Message only if confirmation is required
          if (confirmRequired) {
            actionSpecificTraits.push({
              type: 'text',
              label: 'Confirm Message',
              name: 'confirmation-message',
              changeProp: 1,
            });
          }
        } else if (['create', 'update', 'delete'].includes(actionType)) {
          actionSpecificTraits.push(
            {
              type: 'select',
              label: 'Class',
              name: 'entity-class',
              changeProp: 1,
              options: classOptions,
            },
            {
              type: 'select',
              label: 'Instance Source',
              name: 'instance-source',
              changeProp: 1,
              options: getTableOptions(editor),
            }
          );
        }
        
        // Rebuild traits with current values preserved
        const allTraits = [...baseTraits, ...actionSpecificTraits];
        allTraits.forEach(traitDef => {
          const currentValue = this.get(traitDef.name);
          if (currentValue !== undefined) {
            traitDef.value = currentValue;
          }
        });
        
        traits.reset(allTraits);
        
        // If we're in run-method mode and have a method class selected, populate method options
        if (actionType === 'run-method') {
          const methodClass = this.get('method-class');
          if (methodClass) {
            const methodNameTrait = traits.where({ name: 'method-name' })[0];
            if (methodNameTrait) {
              const methodOptions = getMethodOptions(methodClass);
              methodNameTrait.set('options', methodOptions);
            }
          }
        }
        
        // Force trait panel to re-render
        setTimeout(() => {
          this.trigger('change:traits');
          this.em.trigger('component:toggled');
        }, 0);
      },
      updateMethodOptions(this: any) {
        const methodClass = this.get('method-class');
        const traits = this.get('traits');
        const methodNameTrait = traits.where({ name: 'method-name' })[0];
        
        if (methodNameTrait && methodClass) {
          const methodOptions = getMethodOptions(methodClass);
          methodNameTrait.set('options', methodOptions);
          
          // Clear method name if it's not in the new options
          const currentMethod = this.get('method-name');
          const isValid = methodOptions.some(opt => opt.value === currentMethod);
          if (!isValid) {
            this.set('method-name', '');
          }
        }
      },
      updateButton(this: any) {
        const label = this.get('button-label') || 'Button';
        const buttonStyle = this.get('button-style') || 'primary';
        const actionType = this.get('action-type') || 'navigate';
        const targetScreen = this.get('target-screen') || '';
        const entityClass = this.get('entity-class') || '';
        const methodClass = this.get('method-class') || '';
        const methodName = this.get('method-name') || '';
        const instanceSource = this.get('instance-source') || '';
        const confirmRequired = this.get('confirmation-required') || false;
        const confirmMessage = this.get('confirmation-message') || 'Are you sure?';
        
        // Update content with the label
        this.set('content', label);
        
        // Set components array with textnode for parser extraction
        const components = this.get('components');
        if (!components || components.length === 0) {
          this.components([{
            type: 'textnode',
            content: label
          }]);
        } else {
          // Update existing textnode if present
          const firstComp = components.at(0);
          if (firstComp && firstComp.get('type') === 'textnode') {
            firstComp.set('content', label);
          }
        }
        
        // Update attributes
        const attrs: any = {
          'data-action-type': actionType,
          'data-confirmation': confirmRequired ? 'true' : 'false',
          'data-confirmation-message': confirmMessage,
          'button-label': label, // Store label in attributes
        };
        
        if (actionType === 'navigate' && targetScreen) {
          const pageId = targetScreen.startsWith('page:') ? targetScreen.replace('page:', '') : targetScreen;
          attrs['data-target-screen'] = pageId;
          attrs['target-screen'] = targetScreen; // Keep original format too
        } else if (['create', 'update', 'delete'].includes(actionType) && entityClass) {
          attrs['data-entity-class'] = entityClass;
          if (instanceSource) {
            attrs['data-instance-source'] = instanceSource;
          }
        } else if (actionType === 'run-method' && methodClass && methodName) {
          attrs['data-method-class'] = methodClass;
          attrs['data-method-name'] = methodName;
          if (instanceSource) {
            attrs['data-instance-source'] = instanceSource;
          }
          
          // Get method metadata to determine if it's static
          const methodMetadata = getMethodsByClassId(methodClass).find(m => m.name === methodName);
          if (methodMetadata) {
            attrs['data-method-is-static'] = methodMetadata.isStatic ? 'true' : 'false';
          }
        }
        
        this.addAttributes(attrs);
        
        // Update styling based on button style
        const styleColors: Record<string, {bg: string, text: string, shadow: string}> = {
          primary: { 
            bg: 'linear-gradient(90deg, #2563eb 0%, #1e40af 100%)', 
            text: '#fff',
            shadow: '0 1px 4px rgba(37,99,235,0.10)'
          },
          secondary: { 
            bg: 'linear-gradient(90deg, #6b7280 0%, #4b5563 100%)', 
            text: '#fff',
            shadow: '0 1px 4px rgba(107,114,128,0.10)'
          },
          success: { 
            bg: 'linear-gradient(90deg, #10b981 0%, #059669 100%)', 
            text: '#fff',
            shadow: '0 1px 4px rgba(16,185,129,0.10)'
          },
          danger: { 
            bg: 'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)', 
            text: '#fff',
            shadow: '0 1px 4px rgba(239,68,68,0.10)'
          },
          warning: { 
            bg: 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)', 
            text: '#fff',
            shadow: '0 1px 4px rgba(245,158,11,0.10)'
          },
          info: { 
            bg: 'linear-gradient(90deg, #06b6d4 0%, #0891b2 100%)', 
            text: '#fff',
            shadow: '0 1px 4px rgba(6,182,212,0.10)'
          },
        };
        
        const colors = styleColors[buttonStyle] || styleColors.primary;
        this.addStyle({
          background: colors.bg,
          color: colors.text,
          'box-shadow': colors.shadow,
        });
      },
    },
    view: {
      onRender({ model, el }: any) {
        // Store editor globally
        (window as any).editor = editor;
      },
    },
    isComponent: (el: any) => {
      if (el.classList && el.classList.contains('action-button-component')) {
        return { type: 'action-button' };
      }
    },
  });


  // Add blocks to Block Manager
  editor.BlockManager.add('action-button', {
    label: 'Button',
    category: 'Basic',
    content: { type: 'action-button' },
    media: '<svg viewBox="0 0 24 24" width="24" height="24"><rect x="3" y="8" width="18" height="8" rx="2" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  });
  
};
