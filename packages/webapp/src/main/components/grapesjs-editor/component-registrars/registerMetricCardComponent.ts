import React from 'react';
import ReactDOM from 'react-dom/client';
import { MetricCardConfig } from '../configs/metricCardConfigs';
import { getAttributeOptionsByClassId, getEndsByClassId, getClassOptions } from '../diagram-helpers';

/**
 * Build metric card props from attributes
 */
const buildMetricCardProps = (attrs: Record<string, any>, config: MetricCardConfig): any => {
  const props: any = {
    'metric-title': attrs['metric-title'] || config.defaultTitle,
    'value-color': attrs['value-color'] || '#2c3e50',
    'value-size': attrs['value-size'] !== undefined ? Number(attrs['value-size']) : 32,
    'show-trend': attrs['show-trend'] !== undefined ? attrs['show-trend'] === true || attrs['show-trend'] === 'true' : true,
    'positive-color': attrs['positive-color'] || '#27ae60',
    'negative-color': attrs['negative-color'] || '#e74c3c',
    format: attrs['format'] || 'number',
    value: 0, // Default placeholder value
    trend: 12, // Default placeholder trend
  };

  // Add data binding info if available
  const dataSource = attrs['data-source'];
  const dataField = attrs['data-field'];
  const aggregation = attrs['aggregation'];

  if (dataSource || dataField || aggregation) {
    props.data_binding = {
      entity: dataSource || undefined,
      endpoint: dataSource ? `/${dataSource.toLowerCase()}/` : undefined,
      data_field: dataField || undefined,
      aggregation: aggregation || undefined,
    };
  }

  return props;
};

/**
 * Register a metric card component in the GrapesJS editor
 * @param editor - GrapesJS editor instance
 * @param config - Metric card configuration
 */
export const registerMetricCardComponent = (editor: any, config: MetricCardConfig) => {
  // Build trait values inside the attributes object
  const traitAttributes: Record<string, any> = { class: `${config.id}-component` };
  if (Array.isArray(config.traits)) {
    config.traits.forEach(trait => {
      traitAttributes[trait.name] = trait.value !== undefined && trait.value !== null ? trait.value : '';
    });
  }

  const baseDefaults = {
    tagName: 'div',
    draggable: true,
    droppable: false,
    attributes: traitAttributes,
    style: {
      width: '100%',
      'min-height': '140px',
    },
  };

  editor.Components.addType(config.id, {
    model: {
      defaults: baseDefaults,
      init(this: any) {
        const traits = this.get('traits');
        traits.reset(config.traits);
        
        // Ensure all trait values are set in attributes if not already present
        if (Array.isArray(config.traits)) {
          const attrs = this.get('attributes') || {};
          let changed = false;
          config.traits.forEach(trait => {
            if (attrs[trait.name] === undefined || attrs[trait.name] === null) {
              attrs[trait.name] = trait.value !== undefined && trait.value !== null ? trait.value : '';
              changed = true;
            }
          });
          if (changed) {
            this.set('attributes', attrs);
          }
        }

        // On init, copy all values from attributes to top-level for traits (so sidebar shows correct values)
        if (Array.isArray(config.traits)) {
          const attrs = this.get('attributes') || {};
          config.traits.forEach(trait => {
            if (attrs[trait.name] !== undefined) {
              this.set(trait.name, attrs[trait.name]);
            }
          });
        }

        // Synchronize trait property changes to attributes
        if (Array.isArray(config.traits)) {
          config.traits.forEach(trait => {
            this.on(`change:${trait.name}`, () => {
              const attrs = { ...(this.get('attributes') || {}) };
              attrs[trait.name] = this.get(trait.name);
              this.set('attributes', attrs);
              // Re-render metric card for any trait change
              this.renderMetricCard();
            });
          });
        }

        // Update data-source trait with fresh class options
        const dataSourceTrait = traits.where({ name: 'data-source' })[0];
        if (dataSourceTrait) {
          const classOptions = getClassOptions();
          console.log('📊 Metric Card - Loading class options:', classOptions);
          dataSourceTrait.set('options', classOptions);
        }

        // Helper to update data-field options
        const updateFieldOptions = (classId: string) => {
          const attrOptions = getAttributeOptionsByClassId(classId);
          const relOptions = getEndsByClassId(classId);
          const allOptions = [...attrOptions, ...relOptions];
          const dataFieldTrait = traits.where({ name: 'data-field' })[0];
          if (dataFieldTrait) {
            dataFieldTrait.set('options', allOptions);
          }
        };

        // On init, if a class is already selected, set the options
        const selectedClass = this.get('attributes')?.['data-source'];
        if (selectedClass) {
          updateFieldOptions(selectedClass);
        }

        // Listen for changes to data-source (class selection) to update attribute/relationship options
        this.on('change:attributes', () => {
          const classId = this.get('attributes')?.['data-source'];
          if (classId) {
            updateFieldOptions(classId);
          }
        });
      },
      
      renderMetricCard(this: any) {
        const attrs = this.get('attributes') || {};
        const view = this.getView();
        if (view && view.el) {
          const container = view.el;
          container.innerHTML = '';
          const root = ReactDOM.createRoot(container);
          const props = buildMetricCardProps(attrs, config);
          root.render(React.createElement(config.component, props));
        }
      },
    },
    view: {
      onRender({ el, model }: any) {
        const attrs = model.get('attributes') || {};
        const root = ReactDOM.createRoot(el);
        const props = buildMetricCardProps(attrs, config);
        root.render(React.createElement(config.component, props));
      },
    },
    isComponent: (el: any) => {
      if (el.classList && el.classList.contains(`${config.id}-component`)) {
        return { type: config.id };
      }
    },
  });

  // Add metric card to Block Manager
  editor.BlockManager.add(config.id, {
    label: config.label,
    category: 'Basic',
    content: { type: config.id },
    media: config.icon,
  });
};
