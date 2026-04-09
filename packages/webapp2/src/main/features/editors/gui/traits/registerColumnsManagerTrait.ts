import './columnsManagerPanel.css';
import { getClassMetadata, getEndsByClassId, getElementNameById } from '../diagram-helpers';

// Types for GrapesJS editor and component (minimal, for this file)
type GrapesJSEditor = any;
type GrapesJSComponent = {
  getAttributes: () => Record<string, any>;
  addAttributes: (attrs: Record<string, any>) => void;
  set?: (key: string, value: any) => void;
  trigger?: (event: string) => void;
};

interface ColumnItem {
  field: string;
  label: string;
  columnType: 'field' | 'lookup' | 'expression';
  lookupEntity?: string; // For lookup columns
  lookupField?: string; // For lookup columns
  expression?: string; // For expression columns
  _expanded?: boolean;
}

export default function registerColumnsManagerTrait(editor: GrapesJSEditor) {
  editor.TraitManager.addType('columns-manager', {
    noLabel: true,
    createInput({ trait, component }: { trait: any; component: GrapesJSComponent }) {
      const el = document.createElement('div');
      el.className = 'columns-manager-panel';

      // Parse current columns from attributes or default
      let columns: ColumnItem[] = [];
      const attrVal = component.getAttributes()['columns'];
      if (Array.isArray(attrVal)) {
        // Already an array (new format)
        columns = attrVal;
      } else if (typeof attrVal === 'string' && attrVal.trim().startsWith('[')) {
        // String format (legacy - for backward compatibility)
        try {
          columns = JSON.parse(attrVal);
        } catch (e) {
          columns = [];
        }
      } else {
        columns = [];
      }

      // Render the UI
      const render = () => {
        el.innerHTML = '';
        
        // Add a title for the section
        const title = document.createElement('div');
        title.textContent = 'Table Columns';
        title.className = 'columns-title';
        el.appendChild(title);
        
        // Add a horizontal line after the title
        const hr = document.createElement('hr');
        hr.className = 'columns-title-separator';
        el.appendChild(hr);

        columns.forEach((col: ColumnItem, idx: number) => {
          const row = document.createElement('div');
          
          // Collapsible state - default to false (collapsed)
          let expanded = false;
          if (typeof col._expanded === 'boolean') expanded = col._expanded;
          row.className = 'column-row' + (expanded ? '' : ' collapsed');

          // Header bar
          const header = document.createElement('div');
          header.className = 'column-row-header';

          // Drag handle icon (replaces chevron for dual purpose)
          const dragHandle = document.createElement('span');
          dragHandle.innerHTML = '&#8942;&#8942;'; // Double vertical dots
          dragHandle.className = 'drag-handle';
          dragHandle.style.fontSize = '14px';
          dragHandle.style.marginRight = '8px';
          dragHandle.style.cursor = 'grab';
          dragHandle.style.color = '#999';
          dragHandle.style.userSelect = 'none';
          dragHandle.draggable = true;
          
          // Drag and drop functionality
          dragHandle.addEventListener('dragstart', (e: DragEvent) => {
            if (e.dataTransfer) {
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', idx.toString());
              dragHandle.style.cursor = 'grabbing';
            }
            row.style.opacity = '0.5';
          });
          
          dragHandle.addEventListener('dragend', () => {
            dragHandle.style.cursor = 'grab';
            row.style.opacity = '1';
          });
          
          row.addEventListener('dragover', (e: DragEvent) => {
            e.preventDefault();
            if (e.dataTransfer) {
              e.dataTransfer.dropEffect = 'move';
            }
          });
          
          row.addEventListener('drop', (e: DragEvent) => {
            e.preventDefault();
            if (e.dataTransfer) {
              const fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
              const toIdx = idx;
              
              if (fromIdx !== toIdx) {
                // Reorder array
                const [movedItem] = columns.splice(fromIdx, 1);
                columns.splice(toIdx, 0, movedItem);
                update();
              }
            }
          });

          // Column label (inline editable)
          let editingLabel = false;
          const labelSpan = document.createElement('span');
          labelSpan.className = 'column-row-name';
          labelSpan.textContent = col.label || col.field || `Column ${idx + 1}`;
          labelSpan.style.fontWeight = '600';
          labelSpan.style.flex = '1';
          labelSpan.style.overflow = 'hidden';
          labelSpan.style.textOverflow = 'ellipsis';
          labelSpan.style.whiteSpace = 'nowrap';
          labelSpan.style.color = '#2563eb';
          labelSpan.style.cursor = 'text';

          // Inline editing logic
          labelSpan.addEventListener('click', (e) => {
            e.stopPropagation();
            if (editingLabel) return;
            editingLabel = true;
            const input = document.createElement('input');
            input.type = 'text';
            input.value = col.label || '';
            input.style.fontWeight = '600';
            input.style.fontSize = '14px';
            input.style.color = '#2563eb';
            input.style.flex = '1';
            input.style.border = '1.5px solid #3182ce';
            input.style.borderRadius = '4px';
            input.style.padding = '2px 6px';
            input.style.background = '#fff';
            input.style.margin = '0';
            input.style.minWidth = '60px';
            input.addEventListener('input', (e: any) => {
              col.label = e.target.value;
            });
            input.addEventListener('blur', () => {
              editingLabel = false;
              update();
            });
            input.addEventListener('keydown', (e: KeyboardEvent) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                input.blur();
              }
            });
            header.replaceChild(input, labelSpan);
            input.focus();
            input.select();
          });

          // Expand/collapse indicator (small chevron after label)
          const chevronIndicator = document.createElement('span');
          chevronIndicator.innerHTML = expanded ? '&#9660;' : '&#9654;';
          chevronIndicator.className = 'chevron-indicator';
          chevronIndicator.style.fontSize = '10px';
          chevronIndicator.style.marginLeft = '6px';
          chevronIndicator.style.color = '#999';
          chevronIndicator.style.transition = 'transform 0.2s';

          // Move up button
          const moveUpBtn = document.createElement('button');
          moveUpBtn.innerHTML = '&#9650;'; // Up triangle
          moveUpBtn.setAttribute('data-move-up', idx.toString());
          moveUpBtn.type = 'button';
          moveUpBtn.className = 'move-btn move-btn-up';
          moveUpBtn.title = 'Move up';
          moveUpBtn.disabled = idx === 0; // Disable if first item
          
          // Move down button
          const moveDownBtn = document.createElement('button');
          moveDownBtn.innerHTML = '&#9660;'; // Down triangle
          moveDownBtn.setAttribute('data-move-down', idx.toString());
          moveDownBtn.type = 'button';
          moveDownBtn.className = 'move-btn move-btn-down';
          moveDownBtn.title = 'Move down';
          moveDownBtn.disabled = idx === columns.length - 1; // Disable if last item

          // Remove button (in header)
          const removeBtn = document.createElement('button');
          removeBtn.innerHTML = '&times;';
          removeBtn.setAttribute('data-remove', idx.toString());
          removeBtn.type = 'button';
          removeBtn.className = 'remove-btn remove-btn-x';

          header.appendChild(dragHandle);
          header.appendChild(labelSpan);
          header.appendChild(chevronIndicator);
          header.appendChild(removeBtn);
          row.appendChild(header);

          // Details section (collapsible)
          const details = document.createElement('div');
          details.className = 'column-row-details';
          details.style.display = expanded ? 'block' : 'none';

          // Column Type (Field, Lookup, or Formula)
          const columnTypeLabel = document.createElement('label');
          columnTypeLabel.textContent = 'Column Type';
          const columnTypeSelect = document.createElement('select');
          columnTypeSelect.setAttribute('data-columntype-idx', idx.toString());
          const columnTypeOptions = [
            { value: 'field', label: 'Field' },
            { value: 'lookup', label: 'Lookup' },
            { value: 'expression', label: 'Expression' },
          ];
          columnTypeOptions.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.label;
            if (opt.value === (col.columnType || 'field')) option.selected = true;
            columnTypeSelect.appendChild(option);
          });

          // Append base fields
          details.appendChild(columnTypeLabel);
          details.appendChild(columnTypeSelect);

          // Conditional fields based on column type
          const currentColumnType = col.columnType || 'field';

          if (currentColumnType === 'field') {
            // Field Name (select/combobox populated from data source)
            const fieldLabel = document.createElement('label');
            fieldLabel.textContent = 'Field';
            const fieldSelect = document.createElement('select');
            fieldSelect.setAttribute('data-field-idx', idx.toString());
            
            // Get data source to populate field options
            const dataSource = component.getAttributes()['data-source'];
            const classMetadata = dataSource ? getClassMetadata(dataSource) : undefined;
            
            // Add empty option
            const emptyOption = document.createElement('option');
            emptyOption.value = '';
            emptyOption.textContent = '-- Select Field --';
            fieldSelect.appendChild(emptyOption);
            
            // Populate with class attributes if available
            if (classMetadata?.attributes?.length) {
              classMetadata.attributes.forEach(attr => {
                const option = document.createElement('option');
                option.value = attr.name;
                option.textContent = `${attr.name} (${attr.type || 'unknown'})`;
                if (attr.name === col.field) option.selected = true;
                fieldSelect.appendChild(option);
              });
            } else {
              // No data source or no attributes - show message
              const noDataOption = document.createElement('option');
              noDataOption.value = '';
              noDataOption.textContent = '(No data source)';
              noDataOption.disabled = true;
              fieldSelect.appendChild(noDataOption);
            }
            
            details.appendChild(fieldLabel);
            details.appendChild(fieldSelect);
          } else if (currentColumnType === 'lookup') {
            // Lookup Path (select/combobox populated from class ends)
            const lookupPathLabel = document.createElement('label');
            lookupPathLabel.textContent = 'Lookup Path';
            const lookupPathSelect = document.createElement('select');
            lookupPathSelect.setAttribute('data-lookupentity-idx', idx.toString());
            
            // Get data source to populate lookup path options
            const dataSource = component.getAttributes()['data-source'];
            const classEnds = dataSource ? getEndsByClassId(dataSource) : [];
            
            // Add empty option
            const emptyPathOption = document.createElement('option');
            emptyPathOption.value = '';
            emptyPathOption.textContent = '-- Select Path --';
            lookupPathSelect.appendChild(emptyPathOption);
            
            // Populate with class ends if available
            if (classEnds.length > 0) {
              classEnds.forEach(end => {
                const option = document.createElement('option');
                option.value = end.value;
                option.textContent = end.label || end.value;
                if (end.value === col.lookupEntity) option.selected = true;
                lookupPathSelect.appendChild(option);
              });
            } else {
              // No ends available - show message
              const noEndsOption = document.createElement('option');
              noEndsOption.value = '';
              noEndsOption.textContent = '(No relationships)';
              noEndsOption.disabled = true;
              lookupPathSelect.appendChild(noEndsOption);
            }

            // Lookup Field (select/combobox populated from target class attributes)
            const lookupFieldLabel = document.createElement('label');
            lookupFieldLabel.textContent = 'Lookup Field';
            const lookupFieldSelect = document.createElement('select');
            lookupFieldSelect.setAttribute('data-lookupfield-idx', idx.toString());
            
            // Add empty option
            const emptyFieldOption = document.createElement('option');
            emptyFieldOption.value = '';
            emptyFieldOption.textContent = '-- Select Field --';
            lookupFieldSelect.appendChild(emptyFieldOption);
            
            // If a lookup entity is selected, populate with its attributes
            if (col.lookupEntity) {
              const targetClassMetadata = getClassMetadata(col.lookupEntity);
              if (targetClassMetadata?.attributes?.length) {
                targetClassMetadata.attributes.forEach(attr => {
                  const option = document.createElement('option');
                  option.value = attr.name;
                  option.textContent = `${attr.name} (${attr.type || 'unknown'})`;
                  if (attr.name === col.lookupField) option.selected = true;
                  lookupFieldSelect.appendChild(option);
                });
              } else {
                const noAttrsOption = document.createElement('option');
                noAttrsOption.value = '';
                noAttrsOption.textContent = '(No attributes)';
                noAttrsOption.disabled = true;
                lookupFieldSelect.appendChild(noAttrsOption);
              }
            } else {
              // No lookup entity selected yet
              const selectPathFirstOption = document.createElement('option');
              selectPathFirstOption.value = '';
              selectPathFirstOption.textContent = '(Select path first)';
              selectPathFirstOption.disabled = true;
              lookupFieldSelect.appendChild(selectPathFirstOption);
            }

            details.appendChild(lookupPathLabel);
            details.appendChild(lookupPathSelect);
            details.appendChild(lookupFieldLabel);
            details.appendChild(lookupFieldSelect);
          } else if (currentColumnType === 'expression') {
            // Expression
            const expressionLabel = document.createElement('label');
            expressionLabel.textContent = 'Expression';
            const expressionInput = document.createElement('input');
            expressionInput.type = 'text';
            expressionInput.value = col.expression || '';
            expressionInput.placeholder = 'e.g., price * quantity';
            expressionInput.setAttribute('data-expression-idx', idx.toString());

            details.appendChild(expressionLabel);
            details.appendChild(expressionInput);
          }

          row.appendChild(details);

          // Toggle expand/collapse
          header.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            // Only toggle if not clicking the remove button, label span/input, or drag handle
            if (target.classList.contains('remove-btn') || 
                target.classList.contains('drag-handle') ||
                target === labelSpan || 
                target.tagName === 'INPUT') return;
            expanded = !expanded;
            col._expanded = expanded;
            details.style.display = expanded ? 'block' : 'none';
            chevronIndicator.innerHTML = expanded ? '&#9660;' : '&#9654;';
            header.style.marginBottom = expanded ? '10px' : '0';
            if (expanded) {
              row.classList.remove('collapsed');
            } else {
              row.classList.add('collapsed');
            }
          });

          el.appendChild(row);
        });

        // Add button
        const addBtn = document.createElement('button');
        addBtn.innerHTML = '<span class="add-btn-plus">+</span>';
        addBtn.type = 'button';
        addBtn.className = 'add-btn';
        addBtn.title = 'Add Column';
        addBtn.onclick = () => {
          const idx = columns.length;
          columns.push({
            field: '',
            label: `Column ${idx + 1}`,
            columnType: 'field',
            _expanded: true,
          });
          update();
        };
        el.appendChild(addBtn);
      };

      // Update component attribute when changed
      const update = () => {
        // Store columns as a real array (not stringified)
        // Keep the _expanded property for UI state persistence
        component.addAttributes({ columns: columns });
        // Also update the trait value directly for GrapesJS persistence
        if (typeof component.set === 'function') {
          component.set('columns', columns);
        }
        if (typeof component.trigger === 'function') {
          component.trigger('change:columns');
          component.trigger('change:attributes'); // Mark component as changed for autosave
        }
        
        // Trigger editor storage to save changes immediately
        editor.trigger('component:update', component);
        
        render();
      };

      // Listen for remove button clicks
      el.addEventListener('click', (e: Event) => {
        const target = e.target as HTMLElement | null;
        if (target && target instanceof HTMLElement) {
          // Remove column
          if (target.dataset.remove !== undefined) {
            columns.splice(Number(target.dataset.remove), 1);
            update();
          }
        }
      });

      el.addEventListener('input', (e: Event) => {
        const target = e.target as HTMLInputElement | HTMLSelectElement | null;
        if (!target) return;

        // Column Type
        if (target.tagName === 'SELECT' && target.dataset.columntypeIdx !== undefined) {
          const idx = Number(target.dataset.columntypeIdx);
          columns[idx].columnType = target.value as 'field' | 'lookup' | 'expression';
          // Clear type-specific fields when changing column type
          if (columns[idx].columnType === 'field') {
            delete columns[idx].lookupEntity;
            delete columns[idx].lookupField;
            delete columns[idx].expression;
          } else if (columns[idx].columnType === 'lookup') {
            delete columns[idx].expression;
          } else if (columns[idx].columnType === 'expression') {
            delete columns[idx].lookupEntity;
            delete columns[idx].lookupField;
          }
          update();
        }

        // Field Name (select for 'field' type columns)
        if (target.tagName === 'SELECT' && target.dataset.fieldIdx !== undefined) {
          const idx = Number(target.dataset.fieldIdx);
          columns[idx].field = target.value;
          // Auto-update label to match field name
          columns[idx].label = target.value.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          update();
        }

        // Lookup Path (select for 'lookup' type columns)
        if (target.tagName === 'SELECT' && target.dataset.lookupentityIdx !== undefined) {
          const idx = Number(target.dataset.lookupentityIdx);
          columns[idx].lookupEntity = target.value;
          // Clear lookup field when path changes
          columns[idx].lookupField = '';
          update();
        }

        // Lookup Field (select for 'lookup' type columns)
        if (target.tagName === 'SELECT' && target.dataset.lookupfieldIdx !== undefined) {
          const idx = Number(target.dataset.lookupfieldIdx);
          columns[idx].lookupField = target.value;
          update();
        }

        // Expression
        if (target.tagName === 'INPUT' && target.dataset.expressionIdx !== undefined) {
          const idx = Number(target.dataset.expressionIdx);
          columns[idx].expression = target.value;
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
