
import './seriesManagerPanel.css';
import { getAttributeOptionsByClassId, getEndsByClassId, getInheritedAttributeOptionsByClassId, getInheritedEndsByClassId } from '../diagram-helpers';
import 'vanilla-colorful/hex-color-picker.js';

// Types for GrapesJS editor and component (minimal, for this file)
type GrapesJSEditor = any;
type GrapesJSComponent = {
  getAttributes: () => Record<string, any>;
  addAttributes: (attrs: Record<string, any>) => void;
};

interface SeriesItem {
  name: string;
  dataSource?: string;
  labelField?: string;
  dataField?: string;
  color?: string;
  data: Array<{ name: string; value: number }>;
  _expanded?: boolean;
}

export default function registerSeriesManagerTrait(editor: GrapesJSEditor) {
  editor.TraitManager.addType('series-manager', {
    createInput({ trait, component }: { trait: any; component: GrapesJSComponent }) {
      const el = document.createElement('div');
  el.className = 'series-manager-panel';

      // Helper to get dropdown options for a classId
      function getFieldOptions(classId: string) {
        const attrOptions = getAttributeOptionsByClassId(classId);
        const inheritedAttrOptions = getInheritedAttributeOptionsByClassId(classId);
        const relOptions = getEndsByClassId(classId);
        const inheritedRelOptions = getInheritedEndsByClassId(classId);
        return [...attrOptions, ...inheritedAttrOptions, ...relOptions, ...inheritedRelOptions];
      }

      // Parse current series from attributes or default, with robust check
      let series: SeriesItem[] = [];
      const attrVal = component.getAttributes()['series'];
      if (typeof attrVal === 'string' && attrVal.trim().startsWith('[')) {
        try {
          series = JSON.parse(attrVal);
        } catch (e) {
          series = [];
        }
      } else {
        series = [];
      }

      // Render the UI
      const render = () => {
        el.innerHTML = '';
  // Add a title for the section
  const title = document.createElement('div');
  title.textContent = 'Chart Series';
  title.className = 'series-title';
  el.appendChild(title);

        series.forEach((s: SeriesItem, idx: number) => {
          const row = document.createElement('div');
          row.className = 'series-row';

          // Collapsible state
          let expanded = true;
          if (typeof s["_expanded"] === "boolean") expanded = s["_expanded"];

          // Header bar
          const header = document.createElement('div');
          header.className = 'series-row-header';
          header.style.display = 'flex';
          header.style.alignItems = 'center';
          header.style.justifyContent = 'space-between';
          header.style.cursor = 'pointer';
          header.style.userSelect = 'none';
          header.style.marginBottom = expanded ? '10px' : '0';

          // Chevron icon
          const chevron = document.createElement('span');
          chevron.innerHTML = expanded ? '&#9660;' : '&#9654;';
          chevron.style.fontSize = '16px';
          chevron.style.marginRight = '8px';
          chevron.style.transition = 'transform 0.2s';

          // Series name (inline editable)
          let editingName = false;
          const nameSpan = document.createElement('span');
          nameSpan.textContent = s.name || `Series ${idx + 1}`;
          nameSpan.style.fontWeight = '600';
          nameSpan.style.fontSize = '15px';
          nameSpan.style.flex = '1';
          nameSpan.style.overflow = 'hidden';
          nameSpan.style.textOverflow = 'ellipsis';
          nameSpan.style.whiteSpace = 'nowrap';
          nameSpan.style.color = s.color || '#4CAF50';
          nameSpan.style.cursor = 'text';

          // Inline editing logic
          nameSpan.addEventListener('click', (e) => {
            if (editingName) return;
            editingName = true;
            const input = document.createElement('input');
            input.type = 'text';
            input.value = s.name || '';
            input.style.fontWeight = '600';
            input.style.fontSize = '15px';
            input.style.color = s.color || '#4CAF50';
            input.style.flex = '1';
            input.style.overflow = 'hidden';
            input.style.textOverflow = 'ellipsis';
            input.style.whiteSpace = 'nowrap';
            input.style.border = '1.5px solid #3182ce';
            input.style.borderRadius = '4px';
            input.style.padding = '2px 6px';
            input.style.background = '#fff';
            input.style.margin = '0';
            input.style.minWidth = '60px';
            input.style.maxWidth = '100%';
            input.addEventListener('input', (e: any) => {
              s.name = e.target.value;
            });
            input.addEventListener('blur', () => {
              editingName = false;
              update();
            });
            input.addEventListener('keydown', (e: KeyboardEvent) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                input.blur();
              }
            });
            header.replaceChild(input, nameSpan);
            input.focus();
            input.select();
          });

          // Remove button (in header)
          const removeBtn = document.createElement('button');
          removeBtn.innerHTML = '&times;';
          removeBtn.setAttribute('data-remove', idx.toString());
          removeBtn.type = 'button';
          removeBtn.className = 'remove-btn remove-btn-x';

          header.appendChild(chevron);
          header.appendChild(nameSpan);
          header.appendChild(removeBtn);
          row.appendChild(header);

          // Details section (collapsible)
          const details = document.createElement('div');
          details.className = 'series-row-details';
          details.style.display = expanded ? 'block' : 'none';

          // (Name label and input removed; now handled inline in header)

          // Data Source (dropdown only)
          const dsLabel = document.createElement('label');
          dsLabel.textContent = 'Data Source';
          const dsSelect = document.createElement('select');
          dsSelect.setAttribute('data-ds-idx', idx.toString());
          const dsBlank = document.createElement('option');
          dsBlank.value = '';
          dsBlank.textContent = '';
          dsSelect.appendChild(dsBlank);
          // Always use getClassOptions for Data Source
          let dataSourceOptions: Array<{ value: string; name: string }> = [];
          try {
            const classOptions = require('../diagram-helpers').getClassOptions();
            dataSourceOptions = classOptions.map((opt: any) => ({ value: opt.value, name: opt.label || opt.value }));
          } catch (e) {}
          dataSourceOptions.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.name;
            if (opt.value === s.dataSource) option.selected = true;
            dsSelect.appendChild(option);
          });

          // Label Field (dropdown only)
          const labelFieldLabel = document.createElement('label');
          labelFieldLabel.textContent = 'Label Field';
          const labelFieldSelect = document.createElement('select');
          labelFieldSelect.setAttribute('data-label-idx', idx.toString());
          const labelBlank = document.createElement('option');
          labelBlank.value = '';
          labelBlank.textContent = '';
          labelFieldSelect.appendChild(labelBlank);
          // Get label/data field options for the selected data source
          let labelFieldOptions: Array<{ value: string; label: string }> = [];
          if (s.dataSource) {
            labelFieldOptions = getFieldOptions(s.dataSource);
          }
          labelFieldOptions.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.label;
            if (opt.value === s.labelField) option.selected = true;
            labelFieldSelect.appendChild(option);
          });

          // Data Field (dropdown only)
          const dataFieldLabel = document.createElement('label');
          dataFieldLabel.textContent = 'Data Field';
          const dataFieldSelect = document.createElement('select');
          dataFieldSelect.setAttribute('data-datafield-idx', idx.toString());
          const dataBlank = document.createElement('option');
          dataBlank.value = '';
          dataBlank.textContent = '';
          dataFieldSelect.appendChild(dataBlank);
          let dataFieldOptions: Array<{ value: string; label: string }> = [];
          if (s.dataSource) {
            dataFieldOptions = getFieldOptions(s.dataSource);
          }
          dataFieldOptions.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.label;
            if (opt.value === s.dataField) option.selected = true;
            dataFieldSelect.appendChild(option);
          });

          // Color (GrapesJS-style: text + preview + popover picker, no alpha)
          const colorLabel = document.createElement('label');
          colorLabel.textContent = 'Color';
          const colorPickerContainer = document.createElement('div');
          colorPickerContainer.className = 'color-picker-container';

          // Hex input field
          const hexInput = document.createElement('input');
          hexInput.type = 'text';
          hexInput.value = s.color || '#4CAF50';
          hexInput.placeholder = '#4CAF50';
          hexInput.setAttribute('data-color-idx', idx.toString());
          hexInput.style.width = '80px';

          // Color preview box
          const colorBox = document.createElement('div');
          colorBox.className = 'color-box';
          colorBox.style.background = s.color || '#4CAF50';
          colorBox.title = 'Pick color';

          // Popover for color picker
          let pickerPopover: HTMLDivElement | null = null;
          let colorPicker: HTMLElement | null = null;

          function closePopover() {
            if (pickerPopover) {
              document.body.removeChild(pickerPopover);
              pickerPopover = null;
              colorPicker = null;
              document.removeEventListener('mousedown', handleClickOutside);
            }
          }
          function handleClickOutside(e: MouseEvent) {
            if (pickerPopover && !pickerPopover.contains(e.target as Node) && e.target !== colorBox) {
              closePopover();
            }
          }

          colorBox.addEventListener('click', () => {
            if (pickerPopover) {
              closePopover();
              return;
            }
            pickerPopover = document.createElement('div');
            pickerPopover.style.position = 'absolute';
            pickerPopover.style.zIndex = '9999';
            pickerPopover.style.background = '#fff';
            pickerPopover.style.border = '1px solid #ccc';
            pickerPopover.style.borderRadius = '8px';
            pickerPopover.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
            pickerPopover.style.padding = '10px';
            pickerPopover.style.display = 'flex';
            pickerPopover.style.justifyContent = 'center';
            pickerPopover.style.alignItems = 'center';

            colorPicker = document.createElement('hex-color-picker');
            colorPicker.setAttribute('color', hexInput.value);
            colorPicker.style.width = '180px';
            colorPicker.style.height = '180px';
            pickerPopover.appendChild(colorPicker);

            // Position popover: try right, if not enough space, open to the left
            const rect = colorBox.getBoundingClientRect();
            const popoverWidth = 200; // width + padding
            const spaceRight = window.innerWidth - rect.right;
            let left;
            if (spaceRight < popoverWidth && rect.left > popoverWidth) {
              // Open to the left
              left = rect.left + window.scrollX - popoverWidth;
            } else {
              // Open to the right (default)
              left = rect.right + window.scrollX;
            }
            pickerPopover.style.left = left + 'px';
            pickerPopover.style.top = rect.top + window.scrollY + 'px';

            document.body.appendChild(pickerPopover);
            setTimeout(() => {
              document.addEventListener('mousedown', handleClickOutside);
            }, 0);

            colorPicker.addEventListener('color-changed', (e: any) => {
              const hex = e.detail.value;
              hexInput.value = hex;
              colorBox.style.background = hex;
              series[idx].color = hex;
              update();
            });
          });

          // Sync input and preview
          hexInput.addEventListener('input', (e: any) => {
            let val = e.target.value.trim();
            if (/^#[0-9a-fA-F]{3,8}$/.test(val)) {
              colorBox.style.background = val;
              if (colorPicker) colorPicker.setAttribute('color', val);
              series[idx].color = val;
              update();
            }
          });

          colorPickerContainer.appendChild(hexInput);
          colorPickerContainer.appendChild(colorBox);

          // Append all fields to details
          // (Name label and input removed; now handled inline in header)
          details.appendChild(dsLabel);
          details.appendChild(dsSelect);
          details.appendChild(labelFieldLabel);
          details.appendChild(labelFieldSelect);
          details.appendChild(dataFieldLabel);
          details.appendChild(dataFieldSelect);
          details.appendChild(colorLabel);
          details.appendChild(colorPickerContainer);

          row.appendChild(details);

          // Toggle expand/collapse
          header.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            // Only toggle if not clicking the remove button or the name span/input
            if (target.classList.contains('remove-btn') || target === nameSpan || target.tagName === 'INPUT') return;
            expanded = !expanded;
            s["_expanded"] = expanded;
            details.style.display = expanded ? 'block' : 'none';
            chevron.innerHTML = expanded ? '&#9660;' : '&#9654;';
            header.style.marginBottom = expanded ? '10px' : '0';
          });

          el.appendChild(row);
        });

        // Add button
        const addBtn = document.createElement('button');
  addBtn.textContent = 'Add Series';
  addBtn.type = 'button';
  addBtn.className = 'add-btn';
  addBtn.onclick = () => {
          // Generate random but close values for each new series
          const defaultNames = ['A', 'B', 'C', 'D', 'E', 'F'];
          const idx = series.length;
          // Helper for random value in a range
          function randNear(base: number, spread: number) {
            return Math.round(base + (Math.random() - 0.5) * spread);
          }
          // For BarChart: use { name, value }
          const barBase = 50 + idx * 10;
          const barData = defaultNames.map((n) => ({ name: `Category ${n}`, value: randNear(barBase, 40) }));
          // For RadarChart: use { subject, value, fullMark }
          const radarBase = 75 + idx * 6;
          const radarData = defaultNames.map((n) => ({ subject: `Metric ${n}`, value: randNear(radarBase, 30), fullMark: 100 }));
          // Default to barData, user can edit for radar
          series.push({ name: `Series ${idx + 1}`, dataSource: '', labelField: '', dataField: '', color: '#4CAF50', data: barData });
          update();
        };
        el.appendChild(addBtn);
      };

      // Update component attribute when changed
      const update = () => {
        const seriesStr = JSON.stringify(series);
        component.addAttributes({ series: seriesStr });
        // Also update the trait value directly for GrapesJS persistence
        if (typeof (component as any).set === 'function') {
          (component as any).set('series', seriesStr);
        }
        if (typeof (component as any).trigger === 'function') {
          (component as any).trigger('change:series');
        }
        render();
      };

      // Listen for remove and input changes
      el.addEventListener('click', (e: Event) => {
        const target = e.target as HTMLElement | null;
        if (target && target instanceof HTMLElement && target.dataset.remove !== undefined) {
          series.splice(Number(target.dataset.remove), 1);
          update();
        }
      });
      el.addEventListener('input', (e: Event) => {
        const target = e.target as HTMLInputElement | HTMLSelectElement | null;
        if (!target) return;
        // Data Source
        if (target.tagName === 'SELECT' && target.dataset.dsIdx !== undefined) {
          const idx = Number(target.dataset.dsIdx);
          series[idx].dataSource = target.value;
          // Reset labelField and dataField when dataSource changes
          series[idx].labelField = '';
          series[idx].dataField = '';
          update(); // This will re-render and update the dropdowns
        }
        // Label Field
        if (target.tagName === 'SELECT' && target.dataset.labelIdx !== undefined) {
          const idx = Number(target.dataset.labelIdx);
          series[idx].labelField = target.value;
          update();
        }
        // Data Field
        if (target.tagName === 'SELECT' && target.dataset.datafieldIdx !== undefined) {
          const idx = Number(target.dataset.datafieldIdx);
          series[idx].dataField = target.value;
          update();
        }
        // Color
        if (target.type === 'color' && target.dataset.colorIdx !== undefined) {
          const idx = Number(target.dataset.colorIdx);
          series[idx].color = target.value;
          update();
        }
      });

      render();
      return el;
    },
    onEvent({ elInput, component }: { elInput: HTMLElement; component: GrapesJSComponent }) {
      // No-op: handled in createInput
    }
  });
}

