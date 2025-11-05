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
          padding: '10px 20px',
          background: '#007bff',
          color: '#ffffff',
          'text-decoration': 'none',
          'border-radius': '4px',
          'font-size': '14px',
          'font-weight': 'normal',
          cursor: 'pointer',
          border: 'none',
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
          primary: { bg: '#007bff', text: '#ffffff' },
          secondary: { bg: '#6c757d', text: '#ffffff' },
          success: { bg: '#28a745', text: '#ffffff' },
          danger: { bg: '#dc3545', text: '#ffffff' },
          warning: { bg: '#ffc107', text: '#212529' },
          info: { bg: '#17a2b8', text: '#ffffff' },
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


  // Add blocks to Block Manager
  editor.BlockManager.add('action-button', {
    label: 'Button',
    category: 'Basic',
    content: { type: 'action-button' },
    media: '<svg viewBox="0 0 24 24" width="24" height="24"><rect x="3" y="8" width="18" height="8" rx="2" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  });
  
};
