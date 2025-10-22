import { getPageOptions } from '../utils/pageUtils';
import { getClassOptions } from '../diagram-helpers';

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
          display: 'inline-block',
          padding: '12px 24px',
          background: '#3498db',
          color: '#ffffff',
          'text-decoration': 'none',
          'border-radius': '6px',
          'font-size': '16px',
          'font-weight': 'bold',
          cursor: 'pointer',
          border: 'none',
          transition: 'all 0.3s ease',
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
        this.refreshTraits();
        
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
        this.on('change:button-label change:button-style change:action-type', this.updateButton);
        this.updateTraitVisibility();
      },
      refreshTraits(this: any) {
        const traits = this.get('traits');
        const pageOptions = getPageOptions(editor);
        const classOptions = getClassOptions();
        
        traits.reset([
          {
            type: 'text',
            label: 'Button Label',
            name: 'button-label',
            value: 'Button',
            changeProp: 1,
          },
          {
            type: 'select',
            label: 'Action Type',
            name: 'action-type',
            value: 'navigate',
            changeProp: 1,
            options: [
              { value: 'navigate', label: 'Navigate to Screen' },
              { value: 'submit-form', label: 'Submit Form' },
              { value: 'create', label: 'Create Entity' },
              { value: 'update', label: 'Update Entity' },
              { value: 'delete', label: 'Delete Entity' },
              { value: 'custom', label: 'Custom Action' },
            ],
          },
          {
            type: 'select',
            label: 'Button Style',
            name: 'button-style',
            value: 'primary',
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
            label: 'Target Screen',
            name: 'target-screen',
            value: '',
            changeProp: 1,
            options: pageOptions,
          },
          {
            type: 'text',
            label: 'Target Form ID',
            name: 'target-form',
            value: '',
            changeProp: 1,
            placeholder: 'Form element ID',
          },
          {
            type: 'select',
            label: 'CRUD Entity',
            name: 'crud-entity',
            value: '',
            changeProp: 1,
            options: classOptions,
          },
          {
            type: 'checkbox',
            label: 'Require Confirmation',
            name: 'confirmation-required',
            value: false,
            changeProp: 1,
          },
          {
            type: 'text',
            label: 'Confirmation Message',
            name: 'confirmation-message',
            value: 'Are you sure?',
            changeProp: 1,
          },
          {
            type: 'select',
            label: 'On Success Action',
            name: 'on-success-action',
            value: 'none',
            changeProp: 1,
            options: [
              { value: 'none', label: 'None' },
              { value: 'navigate', label: 'Navigate' },
              { value: 'show-message', label: 'Show Message' },
              { value: 'refresh', label: 'Refresh Page' },
            ],
          },
          {
            type: 'text',
            label: 'Success Message',
            name: 'success-message',
            value: 'Action completed successfully',
            changeProp: 1,
          },
        ]);

        // Refresh options when pages change
        editor.on('component:add component:remove', () => {
          setTimeout(() => this.refreshTraits(), 100);
        });
      },
      updateTraitVisibility(this: any) {
        const actionType = this.get('action-type');
        const traits = this.get('traits');
        
        const targetScreenTrait = traits.where({ name: 'target-screen' })[0];
        const targetFormTrait = traits.where({ name: 'target-form' })[0];
        const crudEntityTrait = traits.where({ name: 'crud-entity' })[0];
        
        // Show/hide traits based on action type
        if (targetScreenTrait) {
          targetScreenTrait.set('visible', actionType === 'navigate');
        }
        if (targetFormTrait) {
          targetFormTrait.set('visible', actionType === 'submit-form');
        }
        if (crudEntityTrait) {
          crudEntityTrait.set('visible', ['create', 'update', 'delete'].includes(actionType));
        }
      },
      updateButton(this: any) {
        const label = this.get('button-label') || 'Button';
        const buttonStyle = this.get('button-style') || 'primary';
        const actionType = this.get('action-type') || 'navigate';
        const targetScreen = this.get('target-screen') || '';
        const targetForm = this.get('target-form') || '';
        const crudEntity = this.get('crud-entity') || '';
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
        } else if (actionType === 'submit-form' && targetForm) {
          attrs['data-target-form'] = targetForm;
        } else if (['create', 'update', 'delete'].includes(actionType) && crudEntity) {
          attrs['data-crud-entity'] = crudEntity;
        }
        
        this.addAttributes(attrs);
        
        // Update styling based on button style
        const styleColors: Record<string, {bg: string, text: string}> = {
          primary: { bg: '#3498db', text: '#ffffff' },
          secondary: { bg: '#95a5a6', text: '#ffffff' },
          success: { bg: '#27ae60', text: '#ffffff' },
          danger: { bg: '#e74c3c', text: '#ffffff' },
          warning: { bg: '#f39c12', text: '#ffffff' },
          info: { bg: '#3498db', text: '#ffffff' },
        };
        
        const colors = styleColors[buttonStyle] || styleColors.primary;
        this.setStyle({
          background: colors.bg,
          color: colors.text,
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

  // Link Button (original)
  editor.Components.addType('link-button', {
    model: {
      defaults: {
        tagName: 'a',
        draggable: true,
        droppable: false,
        attributes: { 
          class: 'link-button-component',
          href: '#',
        },
        style: {
          display: 'inline-block',
          padding: '12px 24px',
          background: '#3498db',
          color: '#ffffff',
          'text-decoration': 'none',
          'border-radius': '6px',
          'font-size': '16px',
          'font-weight': 'bold',
          cursor: 'pointer',
          border: 'none',
          transition: 'all 0.3s ease',
        },
        content: 'Link',
      },
    },
  });

  // Add blocks to Block Manager
  editor.BlockManager.add('action-button', {
    label: '⚡ Action Button',
    category: 'Basic',
    content: { type: 'action-button' },
    media: '<svg viewBox="0 0 24 24" width="100%" height="100%"><path fill="currentColor" d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4M11,16.5L6.5,12L7.91,10.59L11,13.67L16.59,8.09L18,9.5L11,16.5Z"/></svg>',
  });
  
  editor.BlockManager.add('link-button', {
    label: '🔗 Link',
    category: 'Basic',
    content: { type: 'link-button' },
    media: '<svg viewBox="0 0 24 24" width="100%" height="100%"><path fill="currentColor" d="M3.9,12C3.9,10.29 5.29,8.9 7,8.9H11V7H7A5,5 0 0,0 2,12A5,5 0 0,0 7,17H11V15.1H7C5.29,15.1 3.9,13.71 3.9,12M8,13H16V11H8V13M17,7H13V8.9H17C18.71,8.9 20.1,10.29 20.1,12C20.1,13.71 18.71,15.1 17,15.1H13V17H17A5,5 0 0,0 22,12A5,5 0 0,0 17,7Z"/></svg>',
  });
};
