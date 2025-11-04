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

  // // Grid Item Component
  // editor.Components.addType('grid-item', {
  //   model: {
  //     defaults: {
  //       tagName: 'div',
  //       draggable: true,
  //       droppable: true,
  //       attributes: { 
  //         class: 'grid-item-component',
  //       },
  //       style: {
  //         'grid-column': 'auto',
  //         'grid-row': 'auto',
  //         padding: '8px',
  //         border: '1px solid #ddd',
  //       },
  //       content: 'Grid Item',
  //       'grid-column-start': 'auto',
  //       'grid-column-end': 'auto',
  //       'grid-row-start': 'auto',
  //       'grid-row-end': 'auto',
  //     },
  //     init(this: any) {
  //       const traits = this.get('traits');
        
  //       traits.reset([
  //         {
  //           type: 'text',
  //           label: 'Column Start',
  //           name: 'grid-column-start',
  //           value: 'auto',
  //           changeProp: 1,
  //           placeholder: 'auto, 1, 2',
  //         },
  //         {
  //           type: 'text',
  //           label: 'Column End',
  //           name: 'grid-column-end',
  //           value: 'auto',
  //           changeProp: 1,
  //           placeholder: 'auto, 3, span 2',
  //         },
  //         {
  //           type: 'text',
  //           label: 'Row Start',
  //           name: 'grid-row-start',
  //           value: 'auto',
  //           changeProp: 1,
  //           placeholder: 'auto, 1, 2',
  //         },
  //         {
  //           type: 'text',
  //           label: 'Row End',
  //           name: 'grid-row-end',
  //           value: 'auto',
  //           changeProp: 1,
  //           placeholder: 'auto, 3, span 2',
  //         },
  //       ]);

  //       this.on('change:grid-column-start change:grid-column-end change:grid-row-start change:grid-row-end', 
  //         this.updateItem);
  //     },
  //     updateItem(this: any) {
  //       const colStart = this.get('grid-column-start') || 'auto';
  //       const colEnd = this.get('grid-column-end') || 'auto';
  //       const rowStart = this.get('grid-row-start') || 'auto';
  //       const rowEnd = this.get('grid-row-end') || 'auto';
        
  //       this.setStyle({
  //         'grid-column-start': colStart,
  //         'grid-column-end': colEnd,
  //         'grid-row-start': rowStart,
  //         'grid-row-end': rowEnd,
  //       });
  //     },
  //   },
  //   isComponent: (el: any) => {
  //     if (el.classList && el.classList.contains('grid-item-component')) {
  //       return { type: 'grid-item' };
  //     }
  //   },
  // });

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

  // // Add blocks to Block Manager
  // editor.BlockManager.add('flex-container', {
  //   label: 'Flex Container',
  //   category: 'Layout',
  //   content: { type: 'flex-container' },
  //   media: '<svg viewBox="0 0 24 24" width="100%" height="100%"><path fill="currentColor" d="M2,7H8V13H2V7M16,11H10V13H16V11M2,17H8V15H2V17M10,15H22V17H10V15M22,9V7H10V9H22M22,13H18V11H22V13Z"/></svg>',
  // });

  // editor.BlockManager.add('flex-item', {
  //   label: 'Flex Item',
  //   category: 'Layout',
  //   content: { type: 'flex-item' },
  //   media: '<svg viewBox="0 0 24 24" width="100%" height="100%"><path fill="currentColor" d="M19,3H5A2,2 0 0,0 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5A2,2 0 0,0 19,3M19,19H5V5H19V19Z"/></svg>',
  // });

  // editor.BlockManager.add('grid-container', {
  //   label: 'Grid Container',
  //   category: 'Layout',
  //   content: { type: 'grid-container' },
  //   media: '<svg viewBox="0 0 24 24" width="100%" height="100%"><path fill="currentColor" d="M10,4V8H14V4H10M16,4V8H20V4H16M16,10V14H20V10H16M16,16V20H20V16H16M14,20V16H10V20H14M8,20V16H4V20H8M8,14V10H4V14H8M8,8V4H4V8H8M10,14H14V10H10V14M4,2H20A2,2 0 0,1 22,4V20A2,2 0 0,1 20,22H4C2.92,22 2,21.1 2,20V4A2,2 0 0,1 4,2Z"/></svg>',
  // });

  // editor.BlockManager.add('grid-item', {
  //   label: 'Grid Item',
  //   category: 'Layout',
  //   content: { type: 'grid-item' },
  //   media: '<svg viewBox="0 0 24 24" width="100%" height="100%"><path fill="currentColor" d="M19,3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5A2,2 0 0,0 19,3M19,5V19H5V5H19Z"/></svg>',
  // });

  editor.BlockManager.add('card-component', {
    label: 'Card',
    category: 'Layout',
    content: { type: 'card-component' },
    media: '<svg viewBox="0 0 24 24" width="100%" height="100%"><path fill="currentColor" d="M19,19H5V5H19M19,3H5A2,2 0 0,0 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5C21,3.89 20.1,3 19,3M16.5,16.25C16.5,14.75 13.5,14 12,14C10.5,14 7.5,14.75 7.5,16.25V17H16.5M12,12.25A2.25,2.25 0 0,0 14.25,10A2.25,2.25 0 0,0 12,7.75A2.25,2.25 0 0,0 9.75,10A2.25,2.25 0 0,0 12,12.25Z"/></svg>',
  });
};
