import React from 'react';
import ReactDOM from 'react-dom/client';
import { ChartConfig } from '../configs/chartConfigs';
import { getAttributeOptionsByClassId, getEndsByClassId, getClassOptions } from '../diagram-helpers';

/**
 * Register a chart component in the GrapesJS editor
 * @param editor - GrapesJS editor instance
 * @param config - Chart configuration
 */
export const registerChartComponent = (editor: any, config: ChartConfig) => {
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
      'min-height': '400px',
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
            if (attrs[trait.name] === undefined) {
              attrs[trait.name] = trait.value !== undefined && trait.value !== null ? trait.value : '';
              changed = true;
            }
          });
          if (changed) this.set('attributes', attrs);
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

        // Synchronize trait property changes to attributes (do not remove top-level property)
        if (Array.isArray(config.traits)) {
          config.traits.forEach(trait => {
            this.on(`change:${trait.name}`, () => {
              const attrs = { ...(this.get('attributes') || {}) };
              attrs[trait.name] = this.get(trait.name);
              this.set('attributes', attrs);
              // Re-render chart for any trait change
              this.renderReactChart();
            });
          });
        }

        // Update data-source trait with fresh class options (called dynamically when component is initialized)
        const dataSourceTrait = traits.where({ name: 'data-source' })[0];
        if (dataSourceTrait) {
          const classOptions = getClassOptions();
          console.log('📊 Chart Component - Loading class options:', classOptions);
          dataSourceTrait.set('options', classOptions);
        }

        // Helper to update label-field and data-field options
        const updateFieldOptions = (classId: string) => {
          const attrOptions = getAttributeOptionsByClassId(classId);
          const relOptions = getEndsByClassId(classId);
          const allOptions = [...attrOptions, ...relOptions];
          const labelTrait = traits.where({ name: 'label-field' })[0];
          const dataTrait = traits.where({ name: 'data-field' })[0];
          if (labelTrait) labelTrait.set('options', allOptions);
          if (dataTrait) dataTrait.set('options', allOptions);
        };

        // On init, if a class is already selected, set the options
        const selectedClass = this.get('attributes')?.['data-source'];
        if (selectedClass) {
          updateFieldOptions(selectedClass);
        }

        // Listen for changes to data-source (class selection) to update attribute/relationship options
        this.on('change:attributes', () => {
          const classId = this.get('attributes')?.['data-source'];
          updateFieldOptions(classId);
        });
      },
      renderReactChart(this: any) {
        const attrs = this.get('attributes') || {};
        const view = this.getView();
        if (view && view.el) {
          const container = view.el;
          container.innerHTML = '';
          const root = ReactDOM.createRoot(container);
          
          // Common props for all charts
          const props: any = {
            title: attrs['chart-title'] || config.defaultTitle,
            color: attrs['chart-color'] || config.defaultColor,
            showGrid: attrs['show-grid'] !== undefined ? attrs['show-grid'] === true || attrs['show-grid'] === 'true' : true,
            showLegend: attrs['show-legend'] !== undefined ? attrs['show-legend'] === true || attrs['show-legend'] === 'true' : true,
          };

          // Chart-specific props
          if (config.id === 'line-chart') {
            props.showTooltip = attrs['show-tooltip'] !== undefined ? attrs['show-tooltip'] === true || attrs['show-tooltip'] === 'true' : true;
            props.lineWidth = attrs['line-width'] !== undefined ? Number(attrs['line-width']) : 2;
            props.curveType = attrs['curve-type'] || 'monotone';
            props.animate = attrs['animate'] !== undefined ? attrs['animate'] === true || attrs['animate'] === 'true' : true;
          } 
          else if (config.id === 'bar-chart') {
            props.barWidth = attrs['bar-width'] !== undefined ? Number(attrs['bar-width']) : 30;
            props.orientation = attrs['orientation'] || 'vertical';
            props.stacked = attrs['stacked'] !== undefined ? attrs['stacked'] === true || attrs['stacked'] === 'true' : false;
          }
          else if (config.id === 'pie-chart') {
            props.legendPosition = attrs['legend-position'] || 'right';
            props.showLabels = attrs['show-labels'] !== undefined ? attrs['show-labels'] === true || attrs['show-labels'] === 'true' : true;
            props.labelPosition = attrs['label-position'] || 'inside';
            props.paddingAngle = attrs['padding-angle'] !== undefined ? Number(attrs['padding-angle']) : 0;
          }
          else if (config.id === 'radar-chart') {
            props.showTooltip = attrs['show-tooltip'] !== undefined ? attrs['show-tooltip'] === true || attrs['show-tooltip'] === 'true' : true;
            props.showRadiusAxis = attrs['show-radius-axis'] !== undefined ? attrs['show-radius-axis'] === true || attrs['show-radius-axis'] === 'true' : true;
          }
          else if (config.id === 'radial-bar-chart') {
            props.startAngle = attrs['start-angle'] !== undefined ? Number(attrs['start-angle']) : 90;
            props.endAngle = attrs['end-angle'] !== undefined ? Number(attrs['end-angle']) : 450;
          }

          root.render(React.createElement(config.component, props));
        }
      },
    },
    view: {
      onRender({ el, model }: any) {
        const attrs = model.get('attributes') || {};
        const root = ReactDOM.createRoot(el);
        
        // Common props for all charts
        const props: any = {
          title: attrs['chart-title'] || config.defaultTitle,
          color: attrs['chart-color'] || config.defaultColor,
          showGrid: attrs['show-grid'] !== undefined ? attrs['show-grid'] === true || attrs['show-grid'] === 'true' : true,
          showLegend: attrs['show-legend'] !== undefined ? attrs['show-legend'] === true || attrs['show-legend'] === 'true' : true,
        };

        // Chart-specific props
        if (config.id === 'line-chart') {
          props.showTooltip = attrs['show-tooltip'] !== undefined ? attrs['show-tooltip'] === true || attrs['show-tooltip'] === 'true' : true;
          props.lineWidth = attrs['line-width'] !== undefined ? Number(attrs['line-width']) : 2;
          props.curveType = attrs['curve-type'] || 'monotone';
          props.animate = attrs['animate'] !== undefined ? attrs['animate'] === true || attrs['animate'] === 'true' : true;
        } 
        else if (config.id === 'bar-chart') {
          props.barWidth = attrs['bar-width'] !== undefined ? Number(attrs['bar-width']) : 30;
          props.orientation = attrs['orientation'] || 'vertical';
          props.stacked = attrs['stacked'] !== undefined ? attrs['stacked'] === true || attrs['stacked'] === 'true' : false;
        }
        else if (config.id === 'pie-chart') {
          props.legendPosition = attrs['legend-position'] || 'right';
          props.showLabels = attrs['show-labels'] !== undefined ? attrs['show-labels'] === true || attrs['show-labels'] === 'true' : true;
          props.labelPosition = attrs['label-position'] || 'inside';
          props.paddingAngle = attrs['padding-angle'] !== undefined ? Number(attrs['padding-angle']) : 0;
        }
        else if (config.id === 'radar-chart') {
          props.showTooltip = attrs['show-tooltip'] !== undefined ? attrs['show-tooltip'] === true || attrs['show-tooltip'] === 'true' : true;
          props.showRadiusAxis = attrs['show-radius-axis'] !== undefined ? attrs['show-radius-axis'] === true || attrs['show-radius-axis'] === 'true' : true;
        }
        else if (config.id === 'radial-bar-chart') {
          props.startAngle = attrs['start-angle'] !== undefined ? Number(attrs['start-angle']) : 90;
          props.endAngle = attrs['end-angle'] !== undefined ? Number(attrs['end-angle']) : 450;
        }

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
