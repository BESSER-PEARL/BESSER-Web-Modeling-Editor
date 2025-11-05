/**
 * Register layout components (Flexbox, Grid, Card)
 * @param editor - GrapesJS editor instance
 */
export const registerLayoutComponents = (editor: any) => {
  
  // Flex Container Component
  editor.Components.addType('flex-container', {
    model: {
      defaults: {
        tagName: 'div',
        draggable: true,
        droppable: true,
        attributes: { 
          class: 'flex-container-component',
        },
        style: {
          display: 'flex',
          'flex-direction': 'row',
          'justify-content': 'flex-start',
          'align-items': 'stretch',
          'flex-wrap': 'nowrap',
          gap: '16px',
          padding: '16px',
          'min-height': '100px',
          border: '2px dashed #ddd',
        },
        content: '',
        'flex-direction': 'row',
        'justify-content': 'flex-start',
        'align-items': 'stretch',
        'flex-wrap': 'nowrap',
        'gap': '16px',
        'padding': '16px',
      },
      init(this: any) {
        const traits = this.get('traits');
        
        traits.reset([
          {
            type: 'select',
            label: 'Direction',
            name: 'flex-direction',
            value: 'row',
            changeProp: 1,
            options: [
              { value: 'row', label: 'Row (Horizontal)' },
              { value: 'row-reverse', label: 'Row Reverse' },
              { value: 'column', label: 'Column (Vertical)' },
              { value: 'column-reverse', label: 'Column Reverse' },
            ],
          },
          {
            type: 'select',
            label: 'Justify Content',
            name: 'justify-content',
            value: 'flex-start',
            changeProp: 1,
            options: [
              { value: 'flex-start', label: 'Start' },
              { value: 'flex-end', label: 'End' },
              { value: 'center', label: 'Center' },
              { value: 'space-between', label: 'Space Between' },
              { value: 'space-around', label: 'Space Around' },
              { value: 'space-evenly', label: 'Space Evenly' },
            ],
          },
          {
            type: 'select',
            label: 'Align Items',
            name: 'align-items',
            value: 'stretch',
            changeProp: 1,
            options: [
              { value: 'stretch', label: 'Stretch' },
              { value: 'flex-start', label: 'Start' },
              { value: 'flex-end', label: 'End' },
              { value: 'center', label: 'Center' },
              { value: 'baseline', label: 'Baseline' },
            ],
          },
          {
            type: 'select',
            label: 'Wrap',
            name: 'flex-wrap',
            value: 'nowrap',
            changeProp: 1,
            options: [
              { value: 'nowrap', label: 'No Wrap' },
              { value: 'wrap', label: 'Wrap' },
              { value: 'wrap-reverse', label: 'Wrap Reverse' },
            ],
          },
          {
            type: 'text',
            label: 'Gap (px)',
            name: 'gap',
            value: '16px',
            changeProp: 1,
            placeholder: '16px',
          },
          {
            type: 'text',
            label: 'Padding (px)',
            name: 'padding',
            value: '16px',
            changeProp: 1,
            placeholder: '16px',
          },
        ]);

        this.on('change:flex-direction change:justify-content change:align-items change:flex-wrap change:gap change:padding', 
          this.updateContainer);
      },
      updateContainer(this: any) {
        const flexDirection = this.get('flex-direction') || 'row';
        const justifyContent = this.get('justify-content') || 'flex-start';
        const alignItems = this.get('align-items') || 'stretch';
        const flexWrap = this.get('flex-wrap') || 'nowrap';
        const gap = this.get('gap') || '16px';
        const padding = this.get('padding') || '16px';
        
        this.setStyle({
          display: 'flex',
          'flex-direction': flexDirection,
          'justify-content': justifyContent,
          'align-items': alignItems,
          'flex-wrap': flexWrap,
          gap: gap,
          padding: padding,
        });
      },
    },
    isComponent: (el: any) => {
      if (el.classList && el.classList.contains('flex-container-component')) {
        return { type: 'flex-container' };
      }
    },
  });

  // Flex Item Component
  editor.Components.addType('flex-item', {
    model: {
      defaults: {
        tagName: 'div',
        draggable: true,
        droppable: true,
        attributes: { 
          class: 'flex-item-component',
        },
        style: {
          'flex-grow': '0',
          'flex-shrink': '1',
          'flex-basis': 'auto',
          'align-self': 'auto',
          padding: '8px',
          border: '1px solid #ddd',
        },
        content: 'Flex Item',
        'flex-grow': '0',
        'flex-shrink': '1',
        'flex-basis': 'auto',
        'align-self': 'auto',
      },
      init(this: any) {
        const traits = this.get('traits');
        
        traits.reset([
          {
            type: 'text',
            label: 'Flex Grow',
            name: 'flex-grow',
            value: '0',
            changeProp: 1,
            placeholder: '0',
          },
          {
            type: 'text',
            label: 'Flex Shrink',
            name: 'flex-shrink',
            value: '1',
            changeProp: 1,
            placeholder: '1',
          },
          {
            type: 'text',
            label: 'Flex Basis',
            name: 'flex-basis',
            value: 'auto',
            changeProp: 1,
            placeholder: 'auto, 200px, 50%',
          },
          {
            type: 'select',
            label: 'Align Self',
            name: 'align-self',
            value: 'auto',
            changeProp: 1,
            options: [
              { value: 'auto', label: 'Auto' },
              { value: 'flex-start', label: 'Start' },
              { value: 'flex-end', label: 'End' },
              { value: 'center', label: 'Center' },
              { value: 'baseline', label: 'Baseline' },
              { value: 'stretch', label: 'Stretch' },
            ],
          },
        ]);

        this.on('change:flex-grow change:flex-shrink change:flex-basis change:align-self', 
          this.updateItem);
      },
      updateItem(this: any) {
        const flexGrow = this.get('flex-grow') || '0';
        const flexShrink = this.get('flex-shrink') || '1';
        const flexBasis = this.get('flex-basis') || 'auto';
        const alignSelf = this.get('align-self') || 'auto';
        
        this.setStyle({
          'flex-grow': flexGrow,
          'flex-shrink': flexShrink,
          'flex-basis': flexBasis,
          'align-self': alignSelf,
        });
      },
    },
    isComponent: (el: any) => {
      if (el.classList && el.classList.contains('flex-item-component')) {
        return { type: 'flex-item' };
      }
    },
  });

  // Grid Container Component
  editor.Components.addType('grid-container', {
    model: {
      defaults: {
        tagName: 'div',
        draggable: true,
        droppable: true,
        attributes: { 
          class: 'grid-container-component',
        },
        style: {
          display: 'grid',
          'grid-template-columns': 'repeat(3, 1fr)',
          'grid-template-rows': 'auto',
          'grid-gap': '16px',
          padding: '16px',
          'min-height': '100px',
          border: '2px dashed #ddd',
        },
        content: '',
        'grid-template-columns': 'repeat(3, 1fr)',
        'grid-template-rows': 'auto',
        'grid-gap': '16px',
        'padding': '16px',
        'justify-items': 'stretch',
        'align-items': 'stretch',
      },
      init(this: any) {
        const traits = this.get('traits');
        
        traits.reset([
          {
            type: 'text',
            label: 'Columns',
            name: 'grid-template-columns',
            value: 'repeat(3, 1fr)',
            changeProp: 1,
            placeholder: 'repeat(3, 1fr), 200px 1fr 200px',
          },
          {
            type: 'text',
            label: 'Rows',
            name: 'grid-template-rows',
            value: 'auto',
            changeProp: 1,
            placeholder: 'auto, 100px 200px',
          },
          {
            type: 'text',
            label: 'Gap (px)',
            name: 'grid-gap',
            value: '16px',
            changeProp: 1,
            placeholder: '16px',
          },
          {
            type: 'text',
            label: 'Padding (px)',
            name: 'padding',
            value: '16px',
            changeProp: 1,
            placeholder: '16px',
          },
          {
            type: 'select',
            label: 'Justify Items',
            name: 'justify-items',
            value: 'stretch',
            changeProp: 1,
            options: [
              { value: 'stretch', label: 'Stretch' },
              { value: 'start', label: 'Start' },
              { value: 'end', label: 'End' },
              { value: 'center', label: 'Center' },
            ],
          },
          {
            type: 'select',
            label: 'Align Items',
            name: 'align-items',
            value: 'stretch',
            changeProp: 1,
            options: [
              { value: 'stretch', label: 'Stretch' },
              { value: 'start', label: 'Start' },
              { value: 'end', label: 'End' },
              { value: 'center', label: 'Center' },
            ],
          },
        ]);

        this.on('change:grid-template-columns change:grid-template-rows change:grid-gap change:padding change:justify-items change:align-items', 
          this.updateContainer);
      },
      updateContainer(this: any) {
        const columns = this.get('grid-template-columns') || 'repeat(3, 1fr)';
        const rows = this.get('grid-template-rows') || 'auto';
        const gap = this.get('grid-gap') || '16px';
        const padding = this.get('padding') || '16px';
        const justifyItems = this.get('justify-items') || 'stretch';
        const alignItems = this.get('align-items') || 'stretch';
        
        this.setStyle({
          display: 'grid',
          'grid-template-columns': columns,
          'grid-template-rows': rows,
          'grid-gap': gap,
          padding: padding,
          'justify-items': justifyItems,
          'align-items': alignItems,
        });
      },
    },
    isComponent: (el: any) => {
      if (el.classList && el.classList.contains('grid-container-component')) {
        return { type: 'grid-container' };
      }
    },
  });

  // Card Component
  editor.Components.addType('card-component', {
    model: {
      defaults: {
        tagName: 'div',
        draggable: true,
        droppable: true,
        attributes: { 
          class: 'card-component',
        },
        style: {
          display: 'flex',
          'flex-direction': 'column',
          'border-radius': '8px',
          'box-shadow': '0 2px 8px rgba(0,0,0,0.1)',
          overflow: 'hidden',
          background: '#ffffff',
          'min-height': '200px',
        },
        components: [
          {
            tagName: 'div',
            attributes: { class: 'card-header' },
            style: {
              padding: '16px',
              'border-bottom': '1px solid #e0e0e0',
              'font-weight': 'bold',
              'font-size': '18px',
            },
            content: 'Card Header',
          },
          {
            tagName: 'div',
            attributes: { class: 'card-body' },
            style: {
              padding: '16px',
              'flex-grow': '1',
            },
            content: 'Card body content goes here...',
          },
          {
            tagName: 'div',
            attributes: { class: 'card-footer' },
            style: {
              padding: '16px',
              'border-top': '1px solid #e0e0e0',
              'background-color': '#f5f5f5',
            },
            content: 'Card Footer',
          },
        ],
        'card-elevation': 'medium',
        'card-padding': '16px',
      },
      init(this: any) {
        const traits = this.get('traits');
        
        traits.reset([
          {
            type: 'select',
            label: 'Elevation',
            name: 'card-elevation',
            value: 'medium',
            changeProp: 1,
            options: [
              { value: 'none', label: 'None' },
              { value: 'low', label: 'Low' },
              { value: 'medium', label: 'Medium' },
              { value: 'high', label: 'High' },
            ],
          },
          {
            type: 'text',
            label: 'Padding (px)',
            name: 'card-padding',
            value: '16px',
            changeProp: 1,
            placeholder: '16px',
          },
        ]);

        this.on('change:card-elevation change:card-padding', this.updateCard);
      },
      updateCard(this: any) {
        const elevation = this.get('card-elevation') || 'medium';
        const padding = this.get('card-padding') || '16px';
        
        const shadows: Record<string, string> = {
          none: 'none',
          low: '0 1px 3px rgba(0,0,0,0.12)',
          medium: '0 2px 8px rgba(0,0,0,0.15)',
          high: '0 4px 16px rgba(0,0,0,0.2)',
        };
        
        this.setStyle({
          'box-shadow': shadows[elevation] || shadows.medium,
        });
        
        // Update padding for child elements
        const components = this.components();
        components.forEach((comp: any, index: number) => {
          if (index === 0 || index === 1 || index === 2) {
            comp.setStyle({ padding });
          }
        });
      },
    },
    isComponent: (el: any) => {
      if (el.classList && el.classList.contains('card-component')) {
        return { type: 'card-component' };
      }
    },
  });

  editor.BlockManager.add('card-component', {
    label: 'Card',
    category: 'Layout',
    content: { type: 'card-component' },
    media: '<svg viewBox="0 0 24 24" width="24" height="24"><rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><line x1="3" y1="9" x2="21" y2="9" stroke="currentColor" stroke-width="2"/></svg>',
  });
};
