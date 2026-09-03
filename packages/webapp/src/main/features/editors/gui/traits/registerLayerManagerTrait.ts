
import { getAttributeOptionsByClassId, getClassOptions } from '../diagram-helpers';
import i18n from '@/main/shared/i18n';

// Types for GrapesJS editor and component (minimal, for this file)
type GrapesJSEditor = any;
type GrapesJSComponent = {
  getAttributes: () => Record<string, any>;
  addAttributes: (attrs: Record<string, any>) => void;
};

export interface LayerItem {
  name: string;
  type: 'points' | 'geojson' | 'choropleth' | 'heatmap';
  dataSource?: string;
  latitudeField?: string;
  longitudeField?: string;
  labelField?: string;
  weightField?: string;
  geojsonField?: string;
  valueField?: string;
}

const LAYER_TYPES = [
  { value: 'points', label: 'Points (lat/lng markers)' },
  { value: 'geojson', label: 'GeoJSON polygons/lines' },
  { value: 'choropleth', label: 'Choropleth (colored regions)' },
  { value: 'heatmap', label: 'Heat map' },
] as const;

/**
 * Return the field-key names that are relevant for a given layer type.
 * Field selects rendered in the UI are limited to this set.
 */
function getFieldsForType(type: string): string[] {
  switch (type) {
    case 'points':     return ['latitudeField', 'longitudeField', 'labelField'];
    case 'geojson':    return ['geojsonField', 'labelField'];
    case 'choropleth': return ['geojsonField', 'valueField', 'labelField'];
    case 'heatmap':    return ['latitudeField', 'longitudeField', 'weightField'];
    default:           return ['latitudeField', 'longitudeField'];
  }
}

/** Human-readable labels shown beside each field selector. */
const FIELD_LABELS: Record<string, string> = {
  latitudeField:  'Latitude field',
  longitudeField: 'Longitude field',
  labelField:     'Label field (optional)',
  weightField:    'Weight field (optional)',
  geojsonField:   'Geometry field (GeoJSON string)',
  valueField:     'Value field (for fill colour)',
};

/**
 * Register a custom GrapesJS trait type `layer-manager`.
 *
 * Used by `mapConfig.ts` via `{ type: 'layer-manager', name: 'map-layers' }`.
 * The trait renders a repeatable panel — one collapsible row per layer — and
 * serialises the whole list to the `map-layers` component attribute as a JSON
 * string.  The format mirrors the `series` attribute of the series-manager so
 * the converters can apply the same parse-then-iterate pattern.
 *
 * Each row contains:
 *  - A name text input
 *  - A type <select> (points / geojson / choropleth / heatmap)
 *  - A data-source <select> populated from the current class diagram
 *  - Conditional field <select>s driven by the chosen type
 *
 * Modelled after `registerSeriesManagerTrait.ts` — reuses the same CSS classes.
 */
export default function registerLayerManagerTrait(editor: GrapesJSEditor) {
  editor.TraitManager.addType('layer-manager', {
    createInput({ trait, component }: { trait: any; component: GrapesJSComponent }) {
      const el = document.createElement('div');
      el.className = 'series-manager-panel'; // reuse existing panel CSS

      // ── Parse current layers from the component attribute ──
      let layers: LayerItem[] = [];
      const attrVal = component.getAttributes()['map-layers'];
      if (typeof attrVal === 'string' && attrVal.trim().startsWith('[')) {
        try {
          layers = JSON.parse(attrVal);
        } catch {
          layers = [];
        }
      }

      // ── Write the serialised layer list back to the component ──
      const persist = (silent = false) => {
        const str = JSON.stringify(layers);
        component.addAttributes({ 'map-layers': str });
        if (typeof (component as any).set === 'function') {
          if (silent) {
            (component as any).set('map-layers', str, { silent: true });
          } else {
            (component as any).set('map-layers', str);
          }
        }
        if (!silent && typeof (component as any).trigger === 'function') {
          (component as any).trigger('change:map-layers');
        }
      };

      const update = () => {
        persist(false);
        render();
      };

      // ── Main render ──
      const render = () => {
        el.innerHTML = '';

        // Section title
        const title = document.createElement('div');
        title.textContent = i18n.t('editors.gui.layerManager.title', { defaultValue: 'Map Layers' });
        title.className = 'series-title';
        el.appendChild(title);

        const hr = document.createElement('hr');
        hr.className = 'series-title-separator';
        el.appendChild(hr);

        // One row per layer
        layers.forEach((layer, idx) => {
          const row = document.createElement('div');
          row.className = 'series-row';
          row.style.cssText = 'padding:8px 0 4px;border-bottom:1px solid #e9ecef;';

          // ── Row header: name input + type select + remove button ──
          const header = document.createElement('div');
          header.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:6px;';

          const nameInput = document.createElement('input');
          nameInput.type = 'text';
          nameInput.placeholder = `Layer ${idx + 1}`;
          nameInput.value = layer.name || '';
          nameInput.style.cssText =
            'flex:1;min-width:0;font-weight:600;font-size:13px;' +
            'border:1px solid #ccc;border-radius:4px;padding:3px 6px;';
          nameInput.addEventListener('input', () => {
            layer.name = nameInput.value;
            persist(true); // persist without re-render to avoid losing focus
          });

          const typeSelect = document.createElement('select');
          typeSelect.style.cssText =
            'flex:0 0 auto;font-size:12px;border:1px solid #ccc;border-radius:4px;padding:3px 4px;';
          LAYER_TYPES.forEach(lt => {
            const opt = document.createElement('option');
            opt.value = lt.value;
            opt.textContent = lt.label;
            if (lt.value === (layer.type || 'points')) opt.selected = true;
            typeSelect.appendChild(opt);
          });
          typeSelect.addEventListener('change', () => {
            layer.type = typeSelect.value as LayerItem['type'];
            // Clear field refs that may not apply to the new type
            layer.latitudeField  = undefined;
            layer.longitudeField = undefined;
            layer.labelField     = undefined;
            layer.weightField    = undefined;
            layer.geojsonField   = undefined;
            layer.valueField     = undefined;
            update();
          });

          const removeBtn = document.createElement('button');
          removeBtn.innerHTML = '&times;';
          removeBtn.type = 'button';
          removeBtn.className = 'remove-btn remove-btn-x';
          removeBtn.title = 'Remove layer';
          removeBtn.addEventListener('click', () => {
            layers.splice(idx, 1);
            update();
          });

          header.appendChild(nameInput);
          header.appendChild(typeSelect);
          header.appendChild(removeBtn);
          row.appendChild(header);

          // ── Data source select ──
          const dsLabel = document.createElement('label');
          dsLabel.textContent = i18n.t('editors.gui.seriesManager.dataSource', { defaultValue: 'Data Source' });
          dsLabel.style.cssText = 'display:block;font-size:12px;margin-top:4px;';

          const dsSelect = document.createElement('select');
          dsSelect.style.cssText = 'width:100%;margin:2px 0 6px;font-size:12px;';

          const dsBlank = document.createElement('option');
          dsBlank.value = '';
          dsBlank.textContent = '— none —';
          dsSelect.appendChild(dsBlank);

          try {
            const classOptions = getClassOptions();
            classOptions.forEach((opt: any) => {
              const o = document.createElement('option');
              o.value = opt.value;
              o.textContent = opt.label || opt.value;
              if (opt.value === (layer.dataSource ?? '')) o.selected = true;
              dsSelect.appendChild(o);
            });
          } catch (_) {
            // diagram-helpers may throw if no diagram is loaded yet
          }

          dsSelect.addEventListener('change', () => {
            layer.dataSource = dsSelect.value || undefined;
            // Reset all field refs when the class changes
            layer.latitudeField  = undefined;
            layer.longitudeField = undefined;
            layer.labelField     = undefined;
            layer.weightField    = undefined;
            layer.geojsonField   = undefined;
            layer.valueField     = undefined;
            update();
          });

          row.appendChild(dsLabel);
          row.appendChild(dsSelect);

          // ── Conditional field selects (determined by layer type) ──
          const activeFields = getFieldsForType(layer.type || 'points');

          let attrOptions: Array<{ value: string; label: string }> = [];
          if (layer.dataSource) {
            try {
              attrOptions = getAttributeOptionsByClassId(layer.dataSource);
            } catch (_) { /* no class loaded */ }
          }

          activeFields.forEach(fieldKey => {
            const fLabel = document.createElement('label');
            fLabel.textContent = FIELD_LABELS[fieldKey] ?? fieldKey;
            fLabel.style.cssText = 'display:block;font-size:12px;margin-top:4px;';

            const fSelect = document.createElement('select');
            fSelect.style.cssText = 'width:100%;margin:2px 0 6px;font-size:12px;';

            const blankOpt = document.createElement('option');
            blankOpt.value = '';
            blankOpt.textContent = '— none —';
            fSelect.appendChild(blankOpt);

            attrOptions.forEach(opt => {
              const o = document.createElement('option');
              o.value = opt.value;
              o.textContent = opt.label;
              const current = (layer as any)[fieldKey];
              if (opt.value === (current ?? '')) o.selected = true;
              fSelect.appendChild(o);
            });

            fSelect.addEventListener('change', () => {
              (layer as any)[fieldKey] = fSelect.value || undefined;
              persist(true);
            });

            row.appendChild(fLabel);
            row.appendChild(fSelect);
          });

          el.appendChild(row);
        });

        // ── Add-layer button ──
        const addBtn = document.createElement('button');
        addBtn.innerHTML = '<span class="add-btn-plus">&#43;</span>';
        addBtn.type = 'button';
        addBtn.className = 'add-btn add-btn-circle';
        addBtn.title = i18n.t('editors.gui.layerManager.addLayer', { defaultValue: 'Add Layer' });
        addBtn.addEventListener('click', () => {
          layers.push({ name: `Layer ${layers.length + 1}`, type: 'points' });
          update();
        });
        el.appendChild(addBtn);
      };

      render();
      return el;
    },

    onEvent({ elInput, component }: { elInput: HTMLElement; component: GrapesJSComponent }) {
      // All changes are handled inside createInput; this hook is intentionally empty.
    },
  });
}
