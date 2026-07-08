import { MetricCardComponent } from '../widgets/MetricCardComponent';
import { getClassOptions } from '../diagram-helpers';
import i18n from '@/main/shared/i18n';

// Format options for metric display.
// Factory so labels resolve in the current language each time it is called.
export const getFormatOptions = () => [
  { value: 'number', label: i18n.t('editors.gui.traits.formatOptions.number') },
  { value: 'currency', label: i18n.t('editors.gui.traits.formatOptions.currency') },
  { value: 'percentage', label: i18n.t('editors.gui.traits.formatOptions.percentage') },
  { value: 'time', label: i18n.t('editors.gui.traits.formatOptions.time') },
];

// Metric Card configuration interface
export interface MetricCardTrait {
  type: string;
  label: string;
  name: string;
  value: any;
  changeProp: number;
  options?: { value: string; label: string }[];
}

export interface MetricCardConfig {
  id: string;
  label: string;
  component: React.FC<any>;
  defaultTitle: string;
  dataSource: string;
  icon: string;
  traits: MetricCardTrait[];
}

// Metric Card configuration.
// Factory so labels resolve in the current language each time it is called.
// Note: `defaultTitle` and trait `value` defaults stay English — they become user content.
export const getMetricCardConfig = (): MetricCardConfig => ({
  id: 'metric-card',
  label: i18n.t('editors.gui.blocks.metricCard'),
  component: MetricCardComponent,
  defaultTitle: 'Metric Title',
  dataSource: '',
  icon: '<svg viewBox="0 0 24 24" width="100%" height="100%"><rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><text x="12" y="14" text-anchor="middle" font-size="8" fill="currentColor">123</text></svg>',
  traits: [
    { type: 'text', label: i18n.t('editors.gui.traits.metricTitle'), name: 'metric-title', value: 'Metric Title', changeProp: 1 },
    { type: 'select', label: i18n.t('editors.gui.traits.dataSource'), name: 'data-source', value: '', options: getClassOptions(), changeProp: 1 },
    { type: 'select', label: i18n.t('editors.gui.traits.dataField'), name: 'data-field', value: '', options: [], changeProp: 1 },
    // TODO: Uncomment when backend aggregation is ready
    // { type: 'select', label: i18n.t('editors.gui.traits.aggregation'), name: 'aggregation', value: 'sum', options: getAggregationOptions(), changeProp: 1 },
    { type: 'select', label: i18n.t('editors.gui.traits.format'), name: 'format', value: 'number', options: getFormatOptions(), changeProp: 1 },
    { type: 'color', label: i18n.t('editors.gui.traits.valueColor'), name: 'value-color', value: '#2c3e50', changeProp: 1 },
    { type: 'number', label: i18n.t('editors.gui.traits.valueSize'), name: 'value-size', value: 32, changeProp: 1 },
    { type: 'checkbox', label: i18n.t('editors.gui.traits.showTrend'), name: 'show-trend', value: true, changeProp: 1 },
    { type: 'color', label: i18n.t('editors.gui.traits.positiveTrendColor'), name: 'positive-color', value: '#27ae60', changeProp: 1 },
    { type: 'color', label: i18n.t('editors.gui.traits.negativeTrendColor'), name: 'negative-color', value: '#e74c3c', changeProp: 1 },
  ],
});
