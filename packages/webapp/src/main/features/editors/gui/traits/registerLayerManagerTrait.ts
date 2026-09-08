
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

/** Layer types offered in the per-row type selector, with their i18n label keys. */
const LAYER_TYPES = [
  { value: 'points', labelKey: 'editors.gui.layerManager.typePoints' },
  { value: 'geojson', labelKey: 'editors.gui.layerManager.typeGeojson' },
  { value: 'choropleth', labelKey: 'editors.gui.layerManager.typeChoropleth' },
  { value: 'heatmap', labelKey: 'editors.gui.layerManager.typeHeatmap' },
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

/** i18n keys for the label shown beside each field selector. */
const FIELD_LABEL_KEYS: Record<string, string> = {
  latitudeField:  'editors.gui.traits.latitudeField',
  longitudeField: 'editors.gui.traits.longitudeField',
  labelField:     'editors.gui.traits.markerLabelField',
  weightField:    'editors.gui.layerManager.weightField',
  geojsonField:   'editors.gui.layerManager.geometryField',
  valueField:     'editors.gui.layerManager.valueField',
};

/**
 * Parse the serialised `map-layers` attribute into a layer list.
 *
 * The attribute holds a JSON array string; anything else — unset, malformed, or
 * a non-array payload — yields an empty list so every caller can just iterate.
 * Shared with `registerMapComponent`'s `buildMapProps` so the editor preview and
 * the trait panel always read the attribute the same way.
 */
export function parseLayers(raw: unknown): LayerItem[] {
  if (typeof raw !== 'string' || !raw.trim().startsWith('[')) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Resolve a stored layer reference against a list of `{ value, label }` options.
 *
 * Edits made in this panel store option *values* (diagram element ids), but a
 * model imported from BUML carries plain *names* — the backend's
 * `_parse_map_layer` accepts both. So when the stored string matches no option
 * value, fall back to matching an option label, and return that option's id so
 * the select shows the right entry.  Returns '' when nothing matches (the
 * "— none —" entry), which is also the case while no class diagram is loaded.
 */
function resolveOptionValue(
  options: Array<{ value: string; label: string }>,
  stored: string | undefined,
): string {
  if (!stored) return '';
  if (options.some(opt => opt.value === stored)) return stored;
  return options.find(opt => opt.label === stored)?.value ?? '';
}

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
      const layers: LayerItem[] = parseLayers(component.getAttributes()['map-layers']);

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

        // Class list backing every data-source select — one lookup per render.
        let classOptions: Array<{ value: string; label: string }> = [];
        try {
          classOptions = getClassOptions();
        } catch (_) {
          // diagram-helpers warns on its own when no class diagram is loaded
        }

        // Section title
        const title = document.createElement('div');
        title.textContent = i18n.t('editors.gui.layerManager.title');
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
          nameInput.placeholder = i18n.t('editors.gui.layerManager.defaultLayerName', { index: idx + 1 });
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
            opt.textContent = i18n.t(lt.labelKey);
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
          removeBtn.title = i18n.t('editors.gui.layerManager.removeLayer');
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
          dsLabel.textContent = i18n.t('editors.gui.seriesManager.dataSource');
          dsLabel.style.cssText = 'display:block;font-size:12px;margin-top:4px;';

          const dsSelect = document.createElement('select');
          dsSelect.style.cssText = 'width:100%;margin:2px 0 6px;font-size:12px;';

          const dsBlank = document.createElement('option');
          dsBlank.value = '';
          dsBlank.textContent = i18n.t('editors.gui.layerManager.none');
          dsSelect.appendChild(dsBlank);

          // An imported model stores the class NAME, the editor stores its id.
          const selectedClassId = resolveOptionValue(classOptions, layer.dataSource);
          classOptions.forEach(opt => {
            const o = document.createElement('option');
            o.value = opt.value;
            o.textContent = opt.label || opt.value;
            if (opt.value === selectedClassId) o.selected = true;
            dsSelect.appendChild(o);
          });

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
          if (selectedClassId) {
            try {
              attrOptions = getAttributeOptionsByClassId(selectedClassId);
            } catch (_) { /* no class loaded */ }
          }

          activeFields.forEach(fieldKey => {
            const fLabel = document.createElement('label');
            const labelKey = FIELD_LABEL_KEYS[fieldKey];
            fLabel.textContent = labelKey ? i18n.t(labelKey) : fieldKey;
            fLabel.style.cssText = 'display:block;font-size:12px;margin-top:4px;';

            const fSelect = document.createElement('select');
            fSelect.style.cssText = 'width:100%;margin:2px 0 6px;font-size:12px;';

            const blankOpt = document.createElement('option');
            blankOpt.value = '';
            blankOpt.textContent = i18n.t('editors.gui.layerManager.none');
            fSelect.appendChild(blankOpt);

            // Same id-or-name resolution as the data source above.
            const selectedFieldId = resolveOptionValue(attrOptions, (layer as any)[fieldKey]);
            attrOptions.forEach(opt => {
              const o = document.createElement('option');
              o.value = opt.value;
              o.textContent = opt.label;
              if (opt.value === selectedFieldId) o.selected = true;
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
        addBtn.title = i18n.t('editors.gui.layerManager.addLayer');
        addBtn.addEventListener('click', () => {
          layers.push({
            name: i18n.t('editors.gui.layerManager.defaultLayerName', { index: layers.length + 1 }),
            type: 'points',
          });
          update();
        });
        el.appendChild(addBtn);
      };

      render();
      return el;
    },
  });
}
