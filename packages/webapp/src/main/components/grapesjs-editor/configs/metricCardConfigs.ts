import { MetricCardComponent } from '../widgets/MetricCardComponent';
import { getClassOptions } from '../diagram-helpers';
import { aggregationOptions } from './chartConfigs';

// Format options for metric display
export const formatOptions = [
  { value: 'number', label: 'Number' },
  { value: 'currency', label: 'Currency' },
  { value: 'percentage', label: 'Percentage' },
  { value: 'time', label: 'Time Duration' },
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

// Metric Card configuration
export const metricCardConfig: MetricCardConfig = {
  id: 'metric-card',
  label: 'Metric Card / KPI',
  component: MetricCardComponent,
  defaultTitle: 'Metric Title',
  dataSource: '',
  icon: '<svg viewBox="0 0 24 24" width="100%" height="100%"><rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><text x="12" y="14" text-anchor="middle" font-size="8" fill="currentColor">123</text></svg>',
  traits: [
    { type: 'text', label: 'Metric Title', name: 'metric-title', value: 'Metric Title', changeProp: 1 },
    { type: 'select', label: 'Data Source', name: 'data-source', value: '', options: getClassOptions(), changeProp: 1 },
    { type: 'select', label: 'Data Field', name: 'data-field', value: '', options: [], changeProp: 1 },
    // TODO: Uncomment when backend aggregation is ready
    // { type: 'select', label: 'Aggregation', name: 'aggregation', value: 'sum', options: aggregationOptions, changeProp: 1 },
    { type: 'select', label: 'Format', name: 'format', value: 'number', options: formatOptions, changeProp: 1 },
    { type: 'color', label: 'Value Color', name: 'value-color', value: '#2c3e50', changeProp: 1 },
    { type: 'number', label: 'Value Size', name: 'value-size', value: 32, changeProp: 1 },
    { type: 'checkbox', label: 'Show Trend', name: 'show-trend', value: true, changeProp: 1 },
    { type: 'color', label: 'Positive Trend Color', name: 'positive-color', value: '#27ae60', changeProp: 1 },
    { type: 'color', label: 'Negative Trend Color', name: 'negative-color', value: '#e74c3c', changeProp: 1 },
  ],
};
