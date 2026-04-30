import { getClassOptions, getAttributeOptionsByClassId } from '../diagram-helpers';

/**
 * Register enhanced form components in the GrapesJS editor
 * @param editor - GrapesJS editor instance
 */
export const registerFormComponents = (editor: any) => {
  // Enhanced Form Container
  editor.Components.addType('enhanced-form', {
    model: {
      defaults: {
        tagName: 'form',
        draggable: true,
        droppable: true,
        attributes: {
          class: 'enhanced-form',
          method: 'POST',
        },
        traits: [
          {
            type: 'text',
            label: 'Action URL',
            name: 'form-action',
            placeholder: '/api/submit',
          },
          {
            type: 'select',
            label: 'Method',
            name: 'form-method',
            options: [
              { value: 'GET', label: 'GET' },
              { value: 'POST', label: 'POST' },
              { value: 'PUT', label: 'PUT' },
              { value: 'DELETE', label: 'DELETE' },
            ],
            value: 'POST',
            changeProp: 1,
          },
          {
            type: 'select',
            label: 'Target Entity',
            name: 'target-entity',
            options: [],
            changeProp: 1,
          },
          {
            type: 'select',
            label: 'On Submit Action',
            name: 'on-submit-action',
            options: [
              { value: 'create', label: 'Create' },
              { value: 'update', label: 'Update' },
              { value: 'custom', label: 'Custom' },
            ],
            value: 'create',
            changeProp: 1,
          },
          {
            type: 'select',
            label: 'Validation Mode',
            name: 'validation-mode',
            options: [
              { value: 'onSubmit', label: 'On Submit' },
              { value: 'onChange', label: 'On Change' },
              { value: 'onBlur', label: 'On Blur' },
            ],
            value: 'onSubmit',
            changeProp: 1,
          },
        ],
        components: [],
        style: {
          padding: '20px',
          border: '1px solid #ddd',
          borderRadius: '8px',
        },
      },
      init(this: any) {
        const traits = this.get('traits');
        
        // Update target entity options
        const targetEntityTrait = traits.where({ name: 'target-entity' })[0];
        if (targetEntityTrait) {
          const classOptions = getClassOptions();
          targetEntityTrait.set('options', classOptions);
        }
        
        // Update form method in attributes when trait changes
        this.on('change:form-method', () => {
          const attrs = { ...(this.get('attributes') || {}) };
          attrs.method = this.get('form-method');
          this.set('attributes', attrs);
        });
        
        // Update action in attributes
        this.on('change:form-action', () => {
          const attrs = { ...(this.get('attributes') || {}) };
          attrs.action = this.get('form-action');
          this.set('attributes', attrs);
        });
      },
    },
    view: {
      onRender({ el }: any) {
        el.style.minHeight = '100px';
      },
    },
  });

  // Enhanced Input Field
  editor.Components.addType('enhanced-input', {
    model: {
      defaults: {
        tagName: 'input',
        draggable: true,
        droppable: false,
        attributes: {
          class: 'enhanced-input',
          type: 'text',
        },
        traits: [
          {
            type: 'text',
            label: 'Field Name',
            name: 'field-name',
            placeholder: 'e.g., email',
            changeProp: 1,
          },
          {
            type: 'select',
            label: 'Field Type',
            name: 'field-type',
            options: [
              { value: 'text', label: 'Text' },
              { value: 'email', label: 'Email' },
              { value: 'password', label: 'Password' },
              { value: 'number', label: 'Number' },
              { value: 'date', label: 'Date' },
              { value: 'time', label: 'Time' },
              { value: 'tel', label: 'Telephone' },
              { value: 'url', label: 'URL' },
              { value: 'color', label: 'Color' },
              { value: 'range', label: 'Range' },
              { value: 'search', label: 'Search' },
            ],
            value: 'text',
            changeProp: 1,
          },
          {
            type: 'text',
            label: 'Placeholder',
            name: 'placeholder',
            changeProp: 1,
          },
          {
            type: 'checkbox',
            label: 'Required',
            name: 'required',
            value: false,
            changeProp: 1,
          },
          {
            type: 'text',
            label: 'Validation Pattern',
            name: 'validation-pattern',
            placeholder: 'Regular expression',
            changeProp: 1,
          },
          {
            type: 'text',
            label: 'Error Message',
            name: 'validation-message',
            placeholder: 'Custom error message',
            changeProp: 1,
          },
          {
            type: 'select',
            label: 'Bind to Property',
            name: 'bind-to-property',
            options: [],
            changeProp: 1,
          },
          {
            type: 'number',
            label: 'Min Length',
            name: 'min-length',
            placeholder: '0',
            changeProp: 1,
          },
          {
            type: 'number',
            label: 'Max Length',
            name: 'max-length',
            placeholder: '100',
            changeProp: 1,
          },
        ],
        style: {
          padding: '10px',
          border: '1px solid #ccc',
          borderRadius: '4px',
          width: '100%',
          marginBottom: '10px',
        },
      },
      init(this: any) {
        // Update input type when field-type changes
        this.on('change:field-type', () => {
          const attrs = { ...(this.get('attributes') || {}) };
          attrs.type = this.get('field-type');
          this.set('attributes', attrs);
        });
        
        // Update name attribute when field-name changes
        this.on('change:field-name', () => {
          const attrs = { ...(this.get('attributes') || {}) };
          attrs.name = this.get('field-name');
          this.set('attributes', attrs);
        });
        
        // Update required attribute
        this.on('change:required', () => {
          const attrs = { ...(this.get('attributes') || {}) };
          const required = this.get('required');
          if (required) {
            attrs.required = 'required';
          } else {
            delete attrs.required;
          }
          this.set('attributes', attrs);
        });
        
        // Update pattern attribute
        this.on('change:validation-pattern', () => {
          const attrs = { ...(this.get('attributes') || {}) };
          const pattern = this.get('validation-pattern');
          if (pattern) {
            attrs.pattern = pattern;
          } else {
            delete attrs.pattern;
          }
          this.set('attributes', attrs);
        });
      },
    },
  });

  // Enhanced Select/Dropdown
  editor.Components.addType('enhanced-select', {
    model: {
      defaults: {
        tagName: 'select',
        draggable: true,
        droppable: false,
        attributes: {
          class: 'enhanced-select',
        },
        traits: [
          {
            type: 'text',
            label: 'Field Name',
            name: 'field-name',
            placeholder: 'e.g., category',
            changeProp: 1,
          },
          {
            type: 'checkbox',
            label: 'Multiple',
            name: 'multiple',
            value: false,
            changeProp: 1,
          },
          {
            type: 'checkbox',
            label: 'Required',
            name: 'required',
            value: false,
            changeProp: 1,
          },
          {
            type: 'select',
            label: 'Bind to Property',
            name: 'bind-to-property',
            options: [],
            changeProp: 1,
          },
        ],
        components: [
          {
            tagName: 'option',
            attributes: { value: '' },
            content: 'Select an option',
          },
          {
            tagName: 'option',
            attributes: { value: 'option1' },
            content: 'Option 1',
          },
          {
            tagName: 'option',
            attributes: { value: 'option2' },
            content: 'Option 2',
          },
        ],
        style: {
          padding: '10px',
          border: '1px solid #ccc',
          borderRadius: '4px',
          width: '100%',
          marginBottom: '10px',
        },
      },
      init(this: any) {
        this.on('change:field-name', () => {
          const attrs = { ...(this.get('attributes') || {}) };
          attrs.name = this.get('field-name');
          this.set('attributes', attrs);
        });
        
        this.on('change:multiple', () => {
          const attrs = { ...(this.get('attributes') || {}) };
          const multiple = this.get('multiple');
          if (multiple) {
            attrs.multiple = 'multiple';
          } else {
            delete attrs.multiple;
          }
          this.set('attributes', attrs);
        });
        
        this.on('change:required', () => {
          const attrs = { ...(this.get('attributes') || {}) };
          const required = this.get('required');
          if (required) {
            attrs.required = 'required';
          } else {
            delete attrs.required;
          }
          this.set('attributes', attrs);
        });
      },
    },
  });

  // Textarea
  editor.Components.addType('enhanced-textarea', {
    model: {
      defaults: {
        tagName: 'textarea',
        draggable: true,
        droppable: false,
        attributes: {
          class: 'enhanced-textarea',
        },
        traits: [
          {
            type: 'text',
            label: 'Field Name',
            name: 'field-name',
            placeholder: 'e.g., description',
            changeProp: 1,
          },
          {
            type: 'text',
            label: 'Placeholder',
            name: 'placeholder',
            changeProp: 1,
          },
          {
            type: 'number',
            label: 'Rows',
            name: 'rows',
            value: 4,
            changeProp: 1,
          },
          {
            type: 'number',
            label: 'Cols',
            name: 'cols',
            value: 50,
            changeProp: 1,
          },
          {
            type: 'checkbox',
            label: 'Required',
            name: 'required',
            value: false,
            changeProp: 1,
          },
          {
            type: 'number',
            label: 'Max Length',
            name: 'maxlength',
            changeProp: 1,
          },
        ],
        style: {
          padding: '10px',
          border: '1px solid #ccc',
          borderRadius: '4px',
          width: '100%',
          marginBottom: '10px',
          resize: 'vertical',
        },
      },
      init(this: any) {
        this.on('change:field-name', () => {
          const attrs = { ...(this.get('attributes') || {}) };
          attrs.name = this.get('field-name');
          this.set('attributes', attrs);
        });
      },
    },
  });

  // Add blocks to Block Manager
  editor.BlockManager.add('enhanced-form', {
    label: 'Form',
    category: 'Forms',
    content: { type: 'enhanced-form' },
    media: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/></svg>',
  });

  editor.BlockManager.add('enhanced-input', {
    label: 'Input Field',
    category: 'Forms',
    content: { type: 'enhanced-input' },
    media: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M5,3H19A2,2 0 0,1 21,5V19A2,2 0 0,1 19,21H5A2,2 0 0,1 3,19V5A2,2 0 0,1 5,3M5,5V7H19V5H5M5,11V13H19V11H5M5,17V19H19V17H5Z"/></svg>',
  });

  editor.BlockManager.add('enhanced-select', {
    label: 'Dropdown',
    category: 'Forms',
    content: { type: 'enhanced-select' },
    media: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M3,5H21A2,2 0 0,1 23,7V17A2,2 0 0,1 21,19H3A2,2 0 0,1 1,17V7A2,2 0 0,1 3,5M3,7V17H21V7H3M7,9H17V11H7V9M7,13H14V15H7V13Z"/></svg>',
  });

  editor.BlockManager.add('enhanced-textarea', {
    label: 'Text Area',
    category: 'Forms',
    content: { type: 'enhanced-textarea' },
    media: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M3,3H21A2,2 0 0,1 23,5V19A2,2 0 0,1 21,21H3A2,2 0 0,1 1,19V5A2,2 0 0,1 3,3M3,5V19H21V5H3M5,7H19V9H5V7M5,11H19V13H5V11M5,15H19V17H5V15Z"/></svg>',
  });
};
