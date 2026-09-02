import React from 'react';
import ReactDOM from 'react-dom/client';
import { MapConfig } from '../configs/mapConfig';
import { getAttributeOptionsByClassId, getClassOptions } from '../diagram-helpers';

/**
 * GrapesJS renders its canvas inside an <iframe>, so CSS bundled by Vite for the
 * parent frame is NOT automatically available inside the canvas. Leaflet relies on
 * its CSS for tile / control / marker positioning, so we inject it once into the
 * iframe document via a <link> pointing at the unpkg CDN (same CDN used by the
 * Leaflet icon fix in MapComponent.tsx).  The id guard prevents double-injection.
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
const buildMapProps = (attrs: Record<string, any>, config: MapConfig): any => ({
  title: attrs['map-title'] || config.defaultTitle,
  latitude: parseFloat(attrs['map-latitude']) || config.defaultLatitude,
  longitude: parseFloat(attrs['map-longitude']) || config.defaultLongitude,
  zoom: parseInt(attrs['map-zoom']) || 12,
  'data-source': attrs['data-source'] || undefined,
  'latitude-field': attrs['latitude-field'] || undefined,
  'longitude-field': attrs['longitude-field'] || undefined,
  'marker-label-field': attrs['marker-label-field'] || undefined,
});

/**
 * Register the Map component in the GrapesJS editor.
 *
 * Mirrors the `registerMetricCardComponent` pattern:
 * - all trait values live in the GrapesJS "attributes" bag (HTML attributes)
 * - `change:attributes` listener keeps the React preview in sync
 * - when the user picks a data-source class the three geo-field select traits
 *   are dynamically populated with that class's attribute names
 */
export const registerMapComponent = (editor: any, config: MapConfig) => {
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

        // --- populate data-source select with current class names ---
        const dataSourceTrait = traits.where({ name: 'data-source' })[0];
        if (dataSourceTrait) {
          dataSourceTrait.set('options', getClassOptions());
        }

        /**
         * When a domain class is selected (or pre-loaded from a saved diagram),
         * fill the three geo-field selectors with its attribute names so the
         * user can pick which field is latitude, longitude, and the marker label.
         */
        const updateGeoFieldOptions = (classId: string) => {
          const attrOptions = getAttributeOptionsByClassId(classId);
          const ALL_GEO_FIELD_TRAITS = ['latitude-field', 'longitude-field', 'marker-label-field'];
          ALL_GEO_FIELD_TRAITS.forEach(traitName => {
            const t = traits.where({ name: traitName })[0];
            if (t) t.set('options', attrOptions);
          });
        };

        // On load — hydrate field options if a class is already bound.
        const initialClass = (this.get('attributes') || {})['data-source'];
        if (initialClass) updateGeoFieldOptions(initialClass);

        // On change — refresh whenever the class selection changes.
        this.on('change:attributes', () => {
          const classId = (this.get('attributes') || {})['data-source'];
          if (classId) updateGeoFieldOptions(classId);
        });
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
