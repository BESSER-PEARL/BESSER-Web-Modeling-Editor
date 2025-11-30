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
  
  if (classMetadata?.attributes?.length) {
    props.columns = classMetadata.attributes.map(attr => ({
      field: attr.name,
      label: attr.name.replace(/_/g, ' ') || attr.name,
    }));
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
  traitsList.push({
    type: 'text',
    name: 'filter',
    label: 'Filter',
    value: '',
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

        // Update data-source trait with fresh class options (called dynamically when component is initialized)
        const dataSourceTrait = traits.where({ name: 'data-source' })[0];
        if (dataSourceTrait) {
          const classOptions = getClassOptions();
          dataSourceTrait.set('options', classOptions);
        }

        // On init, if a class is already selected, set the options
        const selectedClass = this.get('attributes')?.['data-source'];
        if (selectedClass) {
          // No need to update field options for table as it uses all attributes automatically
        }

        // Listen for changes to data-source (class selection)
        this.on('change:attributes', () => {
          // Table automatically handles all attributes from the selected class
        });
      },
      renderReactTable(this: any) {
        const attrs = this.get('attributes') || {};
        const view = this.getView();
        if (view && view.el) {
          const container = view.el;
          container.innerHTML = '';
          const root = ReactDOM.createRoot(container);
          const props = buildTableProps(attrs, config);
          root.render(React.createElement(config.component, props));
        }
      },
    },
    view: {
      onRender({ el, model }: any) {
        const attrs = model.get('attributes') || {};
        const root = ReactDOM.createRoot(el);
        const props = buildTableProps(attrs, config);
        root.render(React.createElement(config.component, props));
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
