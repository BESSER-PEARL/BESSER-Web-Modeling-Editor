import React from 'react';
import ReactDOM from 'react-dom/client';
import { MapConfig } from '../configs/mapConfig';
import registerLayerManagerTrait from '../traits/registerLayerManagerTrait';

/**
 * GrapesJS renders its canvas inside an <iframe>, so CSS bundled by Vite for the
 * parent frame is NOT automatically available inside the canvas. Leaflet relies on
 * its CSS for tile / control / marker positioning, so we inject it once into the
 * iframe document via a <link> pointing at the unpkg CDN.  The id guard prevents
 * double-injection.
 */
function ensureLeafletCssInFrame(el: HTMLElement): void {
  const frameDoc = el.ownerDocument;
  if (!frameDoc || frameDoc.getElementById('leaflet-css-injected')) return;
  const link = frameDoc.createElement('link');
  link.id = 'leaflet-css-injected';
  link.rel = 'stylesheet';
  link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  (frameDoc.head || frameDoc.body || frameDoc.documentElement)?.appendChild(link);
}

/** Pull all props for MapComponent out of the GrapesJS attribute bag. */
const buildMapProps = (attrs: Record<string, any>, config: MapConfig): any => {
  // Parse the layer list from the serialised JSON string stored in map-layers.
  let layers: any[] = [];
  const rawLayers = attrs['map-layers'];
  if (typeof rawLayers === 'string' && rawLayers.trim().startsWith('[')) {
    try {
      layers = JSON.parse(rawLayers);
    } catch {
      layers = [];
    }
  }
  return {
    title: attrs['map-title'] || config.defaultTitle,
    latitude: parseFloat(attrs['map-latitude']) || config.defaultLatitude,
    longitude: parseFloat(attrs['map-longitude']) || config.defaultLongitude,
    zoom: parseInt(attrs['map-zoom']) || 12,
    layers,
  };
};

/**
 * Register the Map component in the GrapesJS editor.
 *
 * Mirrors the `registerMetricCardComponent` pattern:
 * - all trait values live in the GrapesJS "attributes" bag (HTML attributes)
 * - `change:attributes` / `change:map-layers` listeners keep the React preview in sync
 * - the `layer-manager` custom trait handles add/remove layers + per-layer field selects
 */
export const registerMapComponent = (editor: any, config: MapConfig) => {
  // Register the custom layer-manager trait type once (idempotent after first call).
  registerLayerManagerTrait(editor);

  // Pre-populate HTML attributes from trait defaults so the component renders
  // correctly on first drop even before the user opens the sidebar.
  const traitAttributes: Record<string, any> = { class: `${config.id}-component` };
  if (Array.isArray(config.traits)) {
    config.traits.forEach(trait => {
      traitAttributes[trait.name] = trait.value !== undefined && trait.value !== null ? trait.value : '';
    });
  }

  editor.Components.addType(config.id, {
    model: {
      defaults: {
        tagName: 'div',
        draggable: true,
        droppable: false,
        attributes: traitAttributes,
        style: {
          width: '100%',
          'min-height': '350px',
        },
      },

      init(this: any) {
        const traits = this.get('traits');
        traits.reset(config.traits);

        // --- ensure all trait defaults exist in attributes ---
        if (Array.isArray(config.traits)) {
          const attrs = this.get('attributes') || {};
          let changed = false;
          config.traits.forEach(trait => {
            if (attrs[trait.name] === undefined || attrs[trait.name] === null) {
              attrs[trait.name] = trait.value !== undefined && trait.value !== null ? trait.value : '';
              changed = true;
            }
          });
          if (changed) this.set('attributes', attrs);
        }

        // --- mirror attribute bag → top-level model props (sidebar picks these up) ---
        if (Array.isArray(config.traits)) {
          const attrs = this.get('attributes') || {};
          config.traits.forEach(trait => {
            if (attrs[trait.name] !== undefined) this.set(trait.name, attrs[trait.name]);
          });
        }

        // --- sync every trait change → attributes → re-render ---
        if (Array.isArray(config.traits)) {
          config.traits.forEach(trait => {
            this.on(`change:${trait.name}`, () => {
              const attrs = { ...(this.get('attributes') || {}) };
              attrs[trait.name] = this.get(trait.name);
              this.set('attributes', attrs);
              this.renderMap();
            });
          });
        }

        // Also re-render when the layer-manager trait fires its change event directly
        // (the custom trait type writes to component.addAttributes, which updates
        // the attribute bag but may not always trigger change:<traitName>).
        this.on('change:attributes', () => { this.renderMap(); });
      },

      renderMap(this: any) {
        const attrs = this.get('attributes') || {};
        const view = this.getView();
        if (view && view.el) {
          const container = view.el;
          ensureLeafletCssInFrame(container);
          if (!view.__reactRoot) {
            container.innerHTML = '';
            view.__reactRoot = ReactDOM.createRoot(container);
          }
          view.__reactRoot.render(
            React.createElement(config.component, buildMapProps(attrs, config))
          );
        }
      },
    },

    view: {
      onRender({ el, model }: any) {
        ensureLeafletCssInFrame(el);
        const attrs = model.get('attributes') || {};
        if (!(this as any).__reactRoot) {
          (this as any).__reactRoot = ReactDOM.createRoot(el);
        }
        (this as any).__reactRoot.render(
          React.createElement(config.component, buildMapProps(attrs, config))
        );
      },
      removed() {
        if ((this as any).__reactRoot) {
          (this as any).__reactRoot.unmount();
          (this as any).__reactRoot = null;
        }
      },
    },

    isComponent: (el: any) => {
      if (el.classList && el.classList.contains(`${config.id}-component`)) {
        return { type: config.id };
      }
    },
  });

  // Add block to Block Manager (keep "Charts" category so it groups with Chart/MetricCard).
  editor.BlockManager.add(config.id, {
    label: config.label,
    category: `Charts`,
    content: { type: config.id },
    media: config.icon,
  });
};
