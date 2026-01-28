import React from 'react';
import ReactDOM from 'react-dom/client';
import { TableConfig } from '../configs/tableConfig';
import { getAttributeOptionsByClassId, getEndsByClassId, getClassOptions, getClassMetadata, getInheritedAttributeOptionsByClassId, getInheritedEndsByClassId } from '../diagram-helpers';

/**
 * Build table props from attributes
 */
const buildTableProps = (attrs: Record<string, any>, config: TableConfig): any => {
  const toBool = (value: any, defaultValue: boolean) => {
    if (value === undefined || value === null || value === '') return defaultValue;
    return value === true || value === 'true' || value === 1 || value === '1';
  };

  const props: any = {
    title: attrs['chart-title'] || config.defaultTitle,
    color: attrs['chart-color'] || config.defaultColor,
    showHeader: toBool(attrs['show-header'], true),
    striped: toBool(attrs['striped-rows'], false),
    showPagination: toBool(attrs['show-pagination'], true),
    actionButtons: toBool(attrs['action-buttons'], true),
    filter: typeof attrs['filter'] === 'string' ? attrs['filter'] : '',
  };

  if (attrs['rows-per-page'] !== undefined) {
    const parsed = Number(attrs['rows-per-page']);
    props.rowsPerPage = Number.isFinite(parsed) && parsed > 0 ? parsed : 5;
  } else {
    props.rowsPerPage = 5;
  }

  const classId = attrs['data-source'];
  const classMetadata = typeof classId === 'string' && classId ? getClassMetadata(classId) : undefined;
  
  // Priority 1: Use columns from the columns trait if available
  let columns: Array<{ field: string; label: string; type?: string }> = [];
  const columnsAttr = attrs['columns'];
  
  // Handle both array (new format) and string (legacy format)
  if (Array.isArray(columnsAttr)) {
    // Create a deep copy to ensure React detects the change
    columns = JSON.parse(JSON.stringify(columnsAttr));
  } else if (typeof columnsAttr === 'string' && columnsAttr.trim().startsWith('[')) {
    try {
      columns = JSON.parse(columnsAttr);
    } catch (e) {
      console.error('Failed to parse columns:', e);
    }
  }
  
  // Priority 2: If no columns defined in trait, auto-generate from class metadata
  if (columns.length === 0 && classMetadata?.attributes?.length) {
    columns = classMetadata.attributes.map(attr => ({
      field: attr.name,
      label: attr.name.replace(/_/g, ' ') || attr.name,
      type: attr.type || 'string',
    }));
  }
  
  if (columns.length > 0) {
    props.columns = columns;
  }
  
  props.dataBinding = {
    entity: classMetadata?.name || attrs['data-source'] || '',
  };

  return props;
};

/**
 * Register a table component in the GrapesJS editor
 * @param editor - GrapesJS editor instance
 * @param config - Table configuration
 */
export const registerTableComponent = (editor: any, config: TableConfig) => {
  // Build trait values inside the attributes object
  const traitAttributes: Record<string, any> = { class: `${config.id}-component` };
  let traitsList = Array.isArray(config.traits) ? [...config.traits] : [];
  
  // Add the trait for action buttons
  traitsList.push({
    type: 'checkbox',
    name: 'action-buttons',
    label: 'Action buttons',
    value: true,
    changeProp: 1,
  });
  
  // Add the trait for filter
  //traitsList.push({
  //  type: 'text',
  //  name: 'filter',
  //  label: 'Filter',
  //  value: '',
  //  changeProp: 1,
  //});
  
  // Add the columns-manager trait at the end
  traitsList.push({
    type: 'columns-manager',
    name: 'columns',
    value: [],
    changeProp: 1,
  });

  traitsList.forEach(trait => {
    traitAttributes[trait.name] = trait.value !== undefined && trait.value !== null ? trait.value : '';
  });

  const baseDefaults = {
    tagName: 'div',
    draggable: true,
    droppable: false,
    attributes: traitAttributes,
    style: {
      width: '100%',
      'min-height': '400px',
    },
  };

  editor.Components.addType(config.id, {
    model: {
      defaults: baseDefaults,
      init(this: any) {
        const traits = this.get('traits');
        traits.reset(traitsList);
        
        // Ensure all trait values are set in attributes if not already present
        const attrs = this.get('attributes') || {};
        let changed = false;
        traitsList.forEach(trait => {
          if (attrs[trait.name] === undefined) {
            attrs[trait.name] = trait.value !== undefined && trait.value !== null ? trait.value : '';
            changed = true;
          }
        });
        if (changed) this.set('attributes', attrs);

        // On init, copy all values from attributes to top-level for traits (so sidebar shows correct values)
        traitsList.forEach(trait => {
          if (attrs[trait.name] !== undefined) {
            this.set(trait.name, attrs[trait.name]);
          }
        });

        // Synchronize trait property changes to attributes (do not remove top-level property)
        traitsList.forEach(trait => {
          this.on(`change:${trait.name}`, () => {
            const attrs = { ...(this.get('attributes') || {}) };
            attrs[trait.name] = this.get(trait.name);
            this.set('attributes', attrs);
            // Re-render table for any trait change
            this.renderReactTable();
          });
        });

        // Listen for columns changes (from columns-manager trait)
        this.on('change:columns', () => {
          const newColumns = this.get('columns');
          const attrs = { ...(this.get('attributes') || {}) };
          attrs['columns'] = newColumns;
          this.set('attributes', attrs, { silent: true });
          this.renderReactTable();
        });

        // Listen for attribute changes (catch-all for when attributes object is updated)
        this.on('change:attributes', () => {
          this.renderReactTable();
        });

        // Update data-source trait with fresh class options (called dynamically when component is initialized)
        const dataSourceTrait = traits.where({ name: 'data-source' })[0];
        if (dataSourceTrait) {
          const classOptions = getClassOptions();
          dataSourceTrait.set('options', classOptions);
        }

        // Listen for changes to data-source (class selection) to auto-generate columns
        this.on('change:data-source', () => {
          const newClassId = this.get('data-source');
          if (!newClassId) return;
          
          const classMetadata = getClassMetadata(newClassId);
          const classEnds = getEndsByClassId(newClassId);
          
          const autoColumns: any[] = [];
          
          // Add Field columns from class attributes
          if (classMetadata?.attributes?.length) {
            classMetadata.attributes.forEach(attr => {
              autoColumns.push({
                field: attr.name,
                label: attr.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                columnType: 'field',
                _expanded: false,
              });
            });
          }
          
          // Add Lookup columns from class relationship ends
          if (classEnds?.length) {
            classEnds.forEach(end => {
              // Get the target class metadata to find the first attribute
              const targetClassMetadata = getClassMetadata(end.value);
              const firstAttribute = targetClassMetadata?.attributes?.[0];
              
              autoColumns.push({
                field: end.label || end.value,
                label: (end.label || end.value).replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                columnType: 'lookup',
                lookupEntity: end.value,
                lookupField: firstAttribute?.name || '',
                _expanded: false,
              });
            });
          }
          
          // Update the columns attribute (store as array, not string)
          this.addAttributes({ columns: autoColumns });
          this.set('columns', autoColumns);
          
          // Force the trait to re-render by removing and re-adding it at the same position
          const columnsTrait = traits.where({ name: 'columns' })[0];
          if (columnsTrait) {
            // Get the current index before removing
            const traitIndex = traits.indexOf(columnsTrait);
            
            const traitConfig = {
              type: 'columns-manager',
              label: 'Columns',
              name: 'columns',
              value: autoColumns,
              changeProp: 1
            };
            
            // Remove the trait
            traits.remove(columnsTrait);
            
            // Re-add at the same position
            traits.add(traitConfig, { at: traitIndex });
            
            // Force the component to trigger a re-selection to refresh the UI
            setTimeout(() => {
              this.trigger('change:traits');
              this.em.trigger('component:toggled');
            }, 0);
          }
          
          const totalColumns = (classMetadata?.attributes?.length || 0) + (classEnds?.length || 0);
          console.log(`[Table] Auto-generated ${totalColumns} columns (${classMetadata?.attributes?.length || 0} fields, ${classEnds?.length || 0} lookups) for class: ${classMetadata?.name || newClassId}`);
        });
      },
      renderReactTable(this: any) {
        const attrs = this.get('attributes') || {};
        const view = this.getView();
        if (view && view.el) {
          const container = view.el;
          
          // Don't clear innerHTML if we're reusing the root
          if (!view.__reactRoot) {
            container.innerHTML = '';
            view.__reactRoot = ReactDOM.createRoot(container);
          }
          
          const props = buildTableProps(attrs, config);
          view.__reactRoot.render(React.createElement(config.component, props));
        }
      },
    },
    view: {
      onRender({ el, model }: any) {
        const attrs = model.get('attributes') || {};
        
        // Store root on the view instance to reuse it
        if (!(this as any).__reactRoot) {
          (this as any).__reactRoot = ReactDOM.createRoot(el);
        }
        
        const props = buildTableProps(attrs, config);
        (this as any).__reactRoot.render(React.createElement(config.component, props));
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
    category: 'Basic',
    content: { type: config.id },
    media: config.icon,
  });
};
