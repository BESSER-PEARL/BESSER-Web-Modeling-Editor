import React from 'react';
import ReactDOM from 'react-dom/client';
import { MapConfig } from '../configs/mapConfig';

/**
 * Register the map component in the GrapesJS editor
 * @param editor - GrapesJS editor instance
 * @param config - Map configuration
 */
export const registerMapComponent = (editor: any, config: MapConfig) => {
  editor.Components.addType(config.id, {
    model: {
      defaults: {
        tagName: 'div',
        draggable: true,
        droppable: false,
        attributes: { class: `${config.id}-component` },
        style: {
          width: '100%',
          'min-height': '450px',
        },
        'map-title': config.defaultTitle,
        'map-latitude': config.defaultLatitude,
        'map-longitude': config.defaultLongitude,
        'map-zoom': 12,
      },
      init(this: any) {
        const traits = this.get('traits');
        traits.reset(config.traits);
        this.on('change:map-title change:map-latitude change:map-longitude change:map-zoom', this.renderReactMap);
      },
      renderReactMap(this: any) {
        const title = this.get('map-title') || config.defaultTitle;
        const latitude = parseFloat(this.get('map-latitude')) || config.defaultLatitude;
        const longitude = parseFloat(this.get('map-longitude')) || config.defaultLongitude;
        const zoom = parseInt(this.get('map-zoom')) || 12;
        
        const view = this.getView();
        if (view && view.el) {
          const container = view.el;
          container.innerHTML = '';
          
          const root = ReactDOM.createRoot(container);
          root.render(
            React.createElement(config.component, {
              title,
              latitude,
              longitude,
              zoom,
            })
          );
        }
      },
    },
    view: {
      onRender({ el, model }: any) {
        const title = model.get('map-title') || config.defaultTitle;
        const latitude = parseFloat(model.get('map-latitude')) || config.defaultLatitude;
        const longitude = parseFloat(model.get('map-longitude')) || config.defaultLongitude;
        const zoom = parseInt(model.get('map-zoom')) || 12;
        
        const root = ReactDOM.createRoot(el);
        root.render(
          React.createElement(config.component, {
            title,
            latitude,
            longitude,
            zoom,
          })
        );
      },
    },
    isComponent: (el: any) => {
      if (el.classList && el.classList.contains(`${config.id}-component`)) {
        return { type: config.id };
      }
    },
  });

  // Add block to Block Manager
  editor.BlockManager.add(config.id, {
    label: config.label,
    category: 'Charts', // Changed from 'Maps' to 'Charts' for better visibility
    content: { type: config.id },
    media: config.icon,
  });
};
