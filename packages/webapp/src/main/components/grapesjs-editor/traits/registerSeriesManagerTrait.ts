
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
  'data-source'?: string;
  'label-field'?: string;
  'data-field'?: string;
  filter?: string;
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
          series = JSON.parse(attrVal).map((s: any) => {
            // Convert kebab-case keys to camelCase if present (for backward compatibility)
            const out: any = { ...s };
            if ('data-source' in out) {
              out.dataSource = out['data-source'];
              delete out['data-source'];
            }
            if ('label-field' in out) {
              out.labelField = out['label-field'];
              delete out['label-field'];
            }
            if ('data-field' in out) {
              out.dataField = out['data-field'];
              delete out['data-field'];
            }
            return out;
          });
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
  // Add a horizontal line after the title
  const hr = document.createElement('hr');
  hr.className = 'series-title-separator';
  el.appendChild(hr);

  // Detect chart type from component class (for single-series restriction)
  const chartClass = (component.getAttributes()?.class || '').toLowerCase();
  const isPieOrRadial = chartClass.includes('pie-chart') || chartClass.includes('radial-bar-chart');


        series.forEach((s: SeriesItem, idx: number) => {
          const row = document.createElement('div');
          // Collapsible state
          let expanded = true;
          if (typeof s["_expanded"] === "boolean") expanded = s["_expanded"];
          row.className = 'series-row' + (expanded ? '' : ' collapsed');

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
          nameSpan.className = 'series-row-name';
          nameSpan.textContent = s.name || `Series ${idx + 1}`;
          nameSpan.style.fontWeight = '600';
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
            if (opt.value === s['data-source']) option.selected = true;
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
          if (s['data-source']) {
            labelFieldOptions = getFieldOptions(s['data-source']);
          }
          labelFieldOptions.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.label;
            if (opt.value === s['label-field']) option.selected = true;
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
          if (typeof s['data-source'] === 'string' && s['data-source']) {
            dataFieldOptions = getFieldOptions(s['data-source']);
          }
          dataFieldOptions.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.label;
            if (opt.value === s['data-field']) option.selected = true;
            dataFieldSelect.appendChild(option);
          });

          // Filter (text input)
          const filterLabel = document.createElement('label');
          filterLabel.textContent = 'Filter';
          const filterInput = document.createElement('input');
          filterInput.type = 'text';
          filterInput.value = s.filter || '';
          filterInput.placeholder = 'Filter expression';
          filterInput.setAttribute('data-filter-idx', idx.toString());
          filterInput.style.width = '100%';
          filterInput.style.margin = '4px 0 8px 0';

          // Color (GrapesJS-style: text + preview + popover picker, no alpha)

          const colorLabel = document.createElement('label');
          colorLabel.textContent = 'Color';
          let colorInputContainer: HTMLElement;
          // Predefined palette
          const palette = [
            '#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#A569BD', '#F39C12', '#4CAF50', '#8884d8', '#3498db'
          ];
          if (isPieOrRadial) {
            // Dropdown for palette sets (list of lists)
            colorInputContainer = document.createElement('div');
            colorInputContainer.className = 'color-picker-container';
            // Define palette sets (7+ options: grays, elegant, pastel, vibrant, earth, blue/green, default)
            const paletteSets = [
              ['#00C49F', '#0088FE', '#FFBB28', '#FF8042', '#A569BD'],
              ['#2D3142', '#4F5D75', '#BFC0C0', '#EF8354', '#1B263B'],
              ['#A3C4BC', '#E6B89C', '#ED6A5A', '#F6DFEB', '#C9BBCF'],
              ['#22223B', '#4A4E69', '#9A8C98', '#C9ADA7', '#F2E9E4'],
              ['#A98467', '#6F432A', '#C6AC8F', '#99775C', '#432818'],
              ['#264653', '#2A9D8F', '#E9C46A', '#F4A261', '#E76F51'],
              ['#F72585', '#B5179E', '#7209B7', '#3A0CA3', '#4361EE'],
            ];
            // Find which palette matches current data colors (using .fill for RadialBarChart, .color for PieChart)
            let selectedPaletteIdx = 0;
            if (s.data && s.data.length > 0) {
              paletteSets.forEach((palette, pIdx) => {
                if ('fill' in s.data[0]) {
                  if (s.data.every((d, i) => (d as any).fill === palette[i % palette.length])) {
                    selectedPaletteIdx = pIdx;
                  }
                } else {
                  if (s.data.every((d, i) => (d as any).color === palette[i % palette.length])) {
                    selectedPaletteIdx = pIdx;
                  }
                }
              });
            }
            // Mount React PaletteDropdown
            import('./mountPaletteDropdown').then(({ mountPaletteDropdown }) => {
              mountPaletteDropdown({
                container: colorInputContainer,
                palettes: paletteSets,
                value: selectedPaletteIdx,
                onChange: (idx: number) => {
                  const palette = paletteSets[idx];
                  if (s.data && Array.isArray(s.data)) {
                    if ('fill' in s.data[0]) {
                      s.data.forEach((d, i) => { (d as any).fill = palette[i % palette.length]; });
                    } else {
                      s.data.forEach((d, i) => { (d as any).color = palette[i % palette.length]; });
                    }
                  }
                  s.color = palette[0];
                  update();
                },
              });
            });
          } else {
            // Improved stylish hex input + color preview + popover color picker
            colorInputContainer = document.createElement('div');
            colorInputContainer.className = 'color-picker-container';
            colorInputContainer.style.position = 'relative';
            const hexInput = document.createElement('input');
            hexInput.type = 'text';
            hexInput.value = s.color || '#4CAF50';
            hexInput.placeholder = '#4CAF50';
            hexInput.setAttribute('data-color-idx', idx.toString());
            hexInput.style.width = '80px';
            hexInput.style.marginRight = '8px';
            // Color preview box
            const colorBox = document.createElement('div');
            colorBox.className = 'color-box';
            colorBox.style.background = s.color || '#4CAF50';
            colorBox.title = 'Pick color';
            colorBox.style.display = 'inline-block';
            colorBox.style.width = '28px';
            colorBox.style.height = '28px';
            colorBox.style.border = '1.5px solid #3182ce';
            colorBox.style.borderRadius = '4px';
            colorBox.style.cursor = 'pointer';
            colorBox.style.verticalAlign = 'middle';
            colorBox.style.marginLeft = '2px';
            colorBox.style.position = 'relative';

            let popover: HTMLElement | null = null;
            function closePopover() {
              if (popover) {
                popover.remove();
                popover = null;
                document.removeEventListener('mousedown', handleDocumentMouseDown, true);
              }
            }
            function handleDocumentMouseDown(ev: MouseEvent) {
              if (!popover) return;
              const target = ev.target as Node;
              if (popover.contains(target) || target === colorBox) return;
              closePopover();
            }
            colorBox.addEventListener('click', (e) => {
              // Only one popover at a time
              closePopover();
              popover = document.createElement('div');
              popover.style.position = 'absolute';
              popover.style.zIndex = '1000';
              popover.style.bottom = '38px';
              popover.style.background = '#fff';
              popover.style.border = '1.5px solid #3182ce';
              popover.style.borderRadius = '8px';
              popover.style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)';
              popover.style.padding = '8px';
              popover.style.display = 'flex';
              popover.style.justifyContent = 'center';
              popover.style.alignItems = 'center';
              popover.style.minWidth = '140px';
              popover.style.maxWidth = '180px';
              popover.style.minHeight = '60px';
              popover.style.transform = 'translateY(-8px)';
              // Auto-position left or right based on available space
              const boxRect = colorBox.getBoundingClientRect();
              const parentRect = colorInputContainer.getBoundingClientRect();
              const popoverWidth = 160; // reduced estimate
              const spaceRight = window.innerWidth - boxRect.right;
              const spaceLeft = boxRect.left;
              if (spaceRight > popoverWidth || spaceRight > spaceLeft) {
                popover.style.left = '0';
              } else {
                popover.style.right = '0';
              }
              const picker = document.createElement('hex-color-picker');
              picker.setAttribute('color', s.color || '#4CAF50');
              picker.addEventListener('color-changed', (ev: any) => {
                const val = ev.detail.value;
                hexInput.value = val;
                colorBox.style.background = val;
                s.color = val;
                update();
              });
              popover.appendChild(picker);
              colorInputContainer.appendChild(popover);
              setTimeout(() => {
                document.addEventListener('mousedown', handleDocumentMouseDown, true);
              }, 0);
            });
            hexInput.addEventListener('input', (e: any) => {
              let val = e.target.value.trim();
              if (/^#[0-9a-fA-F]{3,8}$/.test(val)) {
                colorBox.style.background = val;
                s.color = val;
                update();
              }
            });
            colorInputContainer.appendChild(hexInput);
            colorInputContainer.appendChild(colorBox);
          }

          // Append all fields to details
          details.appendChild(dsLabel);
          details.appendChild(dsSelect);
          details.appendChild(labelFieldLabel);
          details.appendChild(labelFieldSelect);
          details.appendChild(dataFieldLabel);
          details.appendChild(dataFieldSelect);
          details.appendChild(filterLabel);
          details.appendChild(filterInput);
          details.appendChild(colorLabel);
          details.appendChild(colorInputContainer);

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
            if (expanded) {
              row.classList.remove('collapsed');
            } else {
              row.classList.add('collapsed');
            }
          });

          el.appendChild(row);
        });

        // Add button (disabled/hidden for PieChart and RadialBarChart if already one series)
    if (!(isPieOrRadial && series.length >= 1)) {
      const addBtn = document.createElement('button');
      addBtn.innerHTML = '<span class="add-btn-plus">&#43;</span>';
      addBtn.type = 'button';
      addBtn.className = 'add-btn add-btn-circle';
      addBtn.title = 'Add Series';
      addBtn.onclick = () => {
        // Generate random but close values for each new series
        const defaultNames = ['A', 'B', 'C', 'D', 'E'];
        const idx = series.length;
        function randNear(base: number, spread: number): number {
          return Math.round(base + (Math.random() - 0.5) * spread);
        }
        const barBase = 50 + idx * 10;
        const barData = defaultNames.map((n) => ({ name: `Category ${n}`, value: randNear(barBase, 40) }));
        const radarBase = 75 + idx * 6;
        const radarData = defaultNames.map((n) => ({ subject: `Category ${n}`, value: randNear(radarBase, 30), fullMark: 100 }));
        // PieChart and RadialBarChart: 5 categories, use color/fill keys
        if (isPieOrRadial) {
          // Use palette 0 as default
          const palette = ['#00C49F', '#0088FE', '#FFBB28', '#FF8042', '#A569BD'];
          if (chartClass.includes('pie-chart')) {
            const pieData = defaultNames.map((n, i) => ({ name: `Category ${n}`, value: randNear(barBase, 40), color: palette[i] }));
            series.push({ name: `Series ${idx + 1}`, color: palette[0], data: pieData });
          } else {
            // RadialBarChart
            const radialData = defaultNames.map((n, i) => ({ name: `Category ${n}`, value: randNear(barBase, 40), fill: palette[i] }));
            series.push({ name: `Series ${idx + 1}`, color: palette[0], data: radialData });
          }
        } else if (chartClass.includes('radar-chart') || chartClass.includes('line-chart') || chartClass.includes('bar-chart')) {
          // Assign a random color from the palette for radar, line, and bar charts
          const palette = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#A569BD', '#F39C12', '#4CAF50', '#8884d8', '#3498db'];
          const randomColor = palette[Math.floor(Math.random() * palette.length)];
          let data;
          if (chartClass.includes('radar-chart')) {
            // Map radarData to use 'name' instead of 'subject' for type compatibility
            data = radarData.map((d) => ({ name: d.subject, value: d.value, fullMark: d.fullMark }));
          } else {
            data = barData;
          }
          series.push({ name: `Series ${idx + 1}`, 'data-source': '', 'label-field': '', 'data-field': '', color: randomColor, data });
        } else {
          // Default fallback
          series.push({ name: `Series ${idx + 1}`, 'data-source': '', 'label-field': '', 'data-field': '', color: '#4CAF50', data: barData });
        }
        update();
      };
      el.appendChild(addBtn);
    }
      };

      // Update component attribute when changed
      const update = () => {
        // Output kebab-case keys for data binding, and keep 'data' property for chart rendering
        const cleanSeries = series.map((s: any) => ({ ...s }));
        const seriesStr = JSON.stringify(cleanSeries);
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
          series[idx]['data-source'] = target.value;
          // Reset label-field and data-field when data-source changes
          series[idx]['label-field'] = '';
          series[idx]['data-field'] = '';
          update(); // This will re-render and update the dropdowns
        }
        // Label Field
        if (target.tagName === 'SELECT' && target.dataset.labelIdx !== undefined) {
          const idx = Number(target.dataset.labelIdx);
          series[idx]['label-field'] = target.value;
          update();
        }
        // Data Field
        if (target.tagName === 'SELECT' && target.dataset.datafieldIdx !== undefined) {
          const idx = Number(target.dataset.datafieldIdx);
          series[idx]['data-field'] = target.value;
          update();
        }
        // Filter
        if (target.tagName === 'INPUT' && target.dataset.filterIdx !== undefined) {
          const idx = Number(target.dataset.filterIdx);
          series[idx].filter = target.value;
          // Do not call update() here to avoid chart refresh
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

