import { LineChartComponent } from '../widgets/LineChartComponent';
import { BarChartComponent } from '../widgets/BarChartComponent';
import { PieChartComponent } from '../widgets/PieChartComponent';
import { RadarChartComponent } from '../widgets/RadarChartComponent';
import { RadialBarChartComponent } from '../widgets/RadialBarChartComponent';
import { getClassOptions } from '../diagram-helpers';
import i18n from '@/main/shared/i18n';

// Aggregation options for dashboard metrics.
// Factory so labels resolve in the current language each time it is called.
export const getAggregationOptions = () => [
  { value: '', label: i18n.t('editors.gui.traits.aggregationOptions.none') },
  { value: 'sum', label: i18n.t('editors.gui.traits.aggregationOptions.sum') },
  { value: 'avg', label: i18n.t('editors.gui.traits.aggregationOptions.avg') },
  { value: 'count', label: i18n.t('editors.gui.traits.aggregationOptions.count') },
  { value: 'min', label: i18n.t('editors.gui.traits.aggregationOptions.min') },
  { value: 'max', label: i18n.t('editors.gui.traits.aggregationOptions.max') },
  { value: 'median', label: i18n.t('editors.gui.traits.aggregationOptions.median') },
  { value: 'first', label: i18n.t('editors.gui.traits.aggregationOptions.first') },
  { value: 'last', label: i18n.t('editors.gui.traits.aggregationOptions.last') },
];

// Chart configuration interface
export interface ChartTrait {
  type: string;
  label: string;
  name: string;
  value: any;
  changeProp: number;
  options?: { value: string; label: string }[];
}

export interface ChartConfig {
  id: string;
  label: string;
  component: React.FC<any>;
  defaultColor: string;
  defaultTitle: string;
  dataSource: string;
  icon: string;
  traits: ChartTrait[];
}

// Centralized chart configurations.
// Factory so labels resolve in the current language each time it is called.
// Note: `defaultTitle` and trait `value` defaults stay English — they become user content.
export const getChartConfigs = (): ChartConfig[] => [
  {
    id: 'line-chart',
    label: i18n.t('editors.gui.blocks.lineChart'),
    component: LineChartComponent,
    defaultColor: '#4CAF50',
    defaultTitle: 'Line Chart Title',
    dataSource: '',
    icon: '<svg viewBox="0 0 24 24" width="100%" height="100%"><path fill="currentColor" d="M3 3v18h18v-2H5V3H3zm2 12l3-4 3 3 5-6 4 5v2l-4-5-5 6-3-3-3 4z"/></svg>',
    traits: [
      // Removed 'Line Color' trait
      { type: 'text', label: i18n.t('editors.gui.traits.chartTitle'), name: 'chart-title', value: 'Line Chart Title', changeProp: 1 },
      { type: 'select', label: i18n.t('editors.gui.traits.dataSource'), name: 'data-source', value: '', options: getClassOptions(), changeProp: 1 },
      { type: 'select', label: i18n.t('editors.gui.traits.labelField'), name: 'label-field', value: '', options: [], changeProp: 1 },
      { type: 'select', label: i18n.t('editors.gui.traits.dataField'), name: 'data-field', value: '', options: [], changeProp: 1 },
      // TODO: Uncomment when backend aggregation is ready
      // { type: 'select', label: i18n.t('editors.gui.traits.aggregation'), name: 'aggregation', value: '', options: getAggregationOptions(), changeProp: 1 },
      // { type: 'select', label: i18n.t('editors.gui.traits.groupBy'), name: 'group-by', value: '', options: [], changeProp: 1 },
      { type: 'number', label: i18n.t('editors.gui.traits.lineWidth'), name: 'line-width', value: 2, changeProp: 1 },
      { type: 'checkbox', label: i18n.t('editors.gui.traits.showGrid'), name: 'show-grid', value: true, changeProp: 1 },
      { type: 'checkbox', label: i18n.t('editors.gui.traits.showLegend'), name: 'show-legend', value: true, changeProp: 1 },
      { type: 'checkbox', label: i18n.t('editors.gui.traits.showTooltip'), name: 'show-tooltip', value: true, changeProp: 1 },
      { type: 'select', label: i18n.t('editors.gui.traits.curveType'), name: 'curve-type', value: 'monotone',
        options: [
          { value: 'linear', label: i18n.t('editors.gui.traits.curveTypeOptions.linear') },
          { value: 'monotone', label: i18n.t('editors.gui.traits.curveTypeOptions.monotone') },
          { value: 'step', label: i18n.t('editors.gui.traits.curveTypeOptions.step') },
          { value: 'stepBefore', label: i18n.t('editors.gui.traits.curveTypeOptions.stepBefore') },
          { value: 'stepAfter', label: i18n.t('editors.gui.traits.curveTypeOptions.stepAfter') }
        ], changeProp: 1 },
      { type: 'checkbox', label: i18n.t('editors.gui.traits.animate'), name: 'animate', value: true, changeProp: 1 },
    ],
  },
  {
    id: 'bar-chart',
    label: i18n.t('editors.gui.blocks.barChart'),
    component: BarChartComponent,
    defaultColor: '#3498db',
    defaultTitle: 'Bar Chart Title',
    dataSource: '',
    icon: '<svg viewBox="0 0 24 24" width="100%" height="100%"><path fill="currentColor" d="M22,21H2V3H4V19H6V10H10V19H12V6H16V19H18V14H22V21Z"/></svg>',
    traits: [
      // Removed 'Bar Color' trait
      { type: 'text', label: i18n.t('editors.gui.traits.chartTitle'), name: 'chart-title', value: 'Bar Chart Title', changeProp: 1 },
      { type: 'select', label: i18n.t('editors.gui.traits.dataSource'), name: 'data-source', value: '', options: getClassOptions(), changeProp: 1 },
      { type: 'select', label: i18n.t('editors.gui.traits.labelField'), name: 'label-field', value: '', options: [], changeProp: 1 },
      { type: 'select', label: i18n.t('editors.gui.traits.dataField'), name: 'data-field', value: '', options: [], changeProp: 1 },
      { type: 'number', label: i18n.t('editors.gui.traits.barWidth'), name: 'bar-width', value: 30, changeProp: 1 },
      { type: 'select', label: i18n.t('editors.gui.traits.orientation'), name: 'orientation', value: 'vertical',
        options: [
          { value: 'vertical', label: i18n.t('editors.gui.traits.orientationOptions.vertical') },
          { value: 'horizontal', label: i18n.t('editors.gui.traits.orientationOptions.horizontal') }
        ], changeProp: 1 },
      { type: 'checkbox', label: i18n.t('editors.gui.traits.showGrid'), name: 'show-grid', value: true, changeProp: 1 },
      { type: 'checkbox', label: i18n.t('editors.gui.traits.showLegend'), name: 'show-legend', value: true, changeProp: 1 },
      { type: 'checkbox', label: i18n.t('editors.gui.traits.stacked'), name: 'stacked', value: false, changeProp: 1 },
    ],
  },
  {
    id: 'pie-chart',
    label: i18n.t('editors.gui.blocks.pieChart'),
    component: PieChartComponent,
    defaultColor: '',
    defaultTitle: 'Pie Chart Title',
    dataSource: '',
    icon: '<svg viewBox="0 0 24 24" width="100%" height="100%"><path fill="currentColor" d="M11,2V22C5.9,21.5 2,17.2 2,12C2,6.8 5.9,2.5 11,2M13,2V11H22C21.5,6.2 17.8,2.5 13,2M13,13V22C17.7,21.5 21.5,17.8 22,13H13Z"/></svg>',
    traits: [
      { type: 'text', label: i18n.t('editors.gui.traits.chartTitle'), name: 'chart-title', value: 'Pie Chart Title', changeProp: 1 },
      { type: 'checkbox', label: i18n.t('editors.gui.traits.showLegend'), name: 'show-legend', value: true, changeProp: 1 },
      { type: 'select', label: i18n.t('editors.gui.traits.legendPosition'), name: 'legend-position', value: 'bottom',
        options: [
          { value: 'top', label: i18n.t('editors.gui.traits.legendPositionOptions.top') },
          { value: 'bottom', label: i18n.t('editors.gui.traits.legendPositionOptions.bottom') }
        ], changeProp: 1 },
      { type: 'checkbox', label: i18n.t('editors.gui.traits.showLabels'), name: 'show-labels', value: true, changeProp: 1 },
      { type: 'select', label: i18n.t('editors.gui.traits.labelPosition'), name: 'label-position', value: 'inside',
        options: [
          { value: 'inside', label: i18n.t('editors.gui.traits.labelPositionOptions.inside') },
          { value: 'outside', label: i18n.t('editors.gui.traits.labelPositionOptions.outside') }
        ], changeProp: 1 },
      { type: 'number', label: i18n.t('editors.gui.traits.paddingAngle'), name: 'padding-angle', value: 0, changeProp: 1 },
  { type: 'series-manager', name: 'series', label: i18n.t('editors.gui.traits.series'), value: '[{"name":"Series 1","dataSource":"","labelField":"","dataField":"","color":"#00C49F","data":[{"name":"Category A","value":90,"color":"#00C49F"},{"name":"Category B","value":70,"color":"#0088FE"},{"name":"Category C","value":50,"color":"#FFBB28"},{"name":"Category D","value":30,"color":"#FF8042"},{"name":"Category E","value":15,"color":"#A569BD"}]}]', changeProp: 1 },
    ],
  },
  {
    id: 'radar-chart',
    label: i18n.t('editors.gui.blocks.radarChart'),
    component: RadarChartComponent,
    defaultColor: '#8884d8',
    defaultTitle: 'Radar Chart Title',
    dataSource: '',
    icon: '<svg viewBox="0 0 24 24" width="100%" height="100%"><g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="12" x2="12" y2="3"/><line x1="12" y1="12" x2="20" y2="8"/><line x1="12" y1="12" x2="17" y2="20"/><line x1="12" y1="12" x2="7" y2="20"/><line x1="12" y1="12" x2="4" y2="8"/><polygon points="12,6 17.5,9.5 15,16 9,16 6.5,9.5"/></g></svg>',
    traits: [
      // Removed 'Chart Color' trait
      { type: 'text', label: i18n.t('editors.gui.traits.chartTitle'), name: 'chart-title', value: 'Radar Chart Title', changeProp: 1 },
      { type: 'select', label: i18n.t('editors.gui.traits.dataSource'), name: 'data-source', value: '', options: getClassOptions(), changeProp: 1 },
      { type: 'select', label: i18n.t('editors.gui.traits.labelField'), name: 'label-field', value: '', options: [], changeProp: 1 },
      { type: 'select', label: i18n.t('editors.gui.traits.dataField'), name: 'data-field', value: '', options: [], changeProp: 1 },
      { type: 'checkbox', label: i18n.t('editors.gui.traits.showGrid'), name: 'show-grid', value: true, changeProp: 1 },
      { type: 'checkbox', label: i18n.t('editors.gui.traits.showTooltip'), name: 'show-tooltip', value: true, changeProp: 1 },
      { type: 'checkbox', label: i18n.t('editors.gui.traits.showRadiusAxis'), name: 'show-radius-axis', value: true, changeProp: 1 },
    ],
  },
  {
    id: 'radial-bar-chart',
    label: i18n.t('editors.gui.blocks.radialBarChart'),
    component: RadialBarChartComponent,
    defaultColor: '',
    defaultTitle: 'Radial Bar Chart Title',
    dataSource: '',
    icon: '<svg viewBox="0 0 24 24" width="100%" height="100%"><g fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="3"/></g></svg>',
    traits: [
  { type: 'text', label: i18n.t('editors.gui.traits.chartTitle'), name: 'chart-title', value: 'Radial Bar Chart Title', changeProp: 1 },
  { type: 'number', label: i18n.t('editors.gui.traits.startAngle'), name: 'start-angle', value: 90, changeProp: 1 },
  { type: 'number', label: i18n.t('editors.gui.traits.endAngle'), name: 'end-angle', value: 450, changeProp: 1 },
  { type: 'series-manager', name: 'series', label: i18n.t('editors.gui.traits.series'), value: '[{"name":"Series 1","dataSource":"","labelField":"","dataField":"","color":"#4CAF50","data":[{"name":"Category A","value":90,"fill":"#00C49F"},{"name":"Category B","value":70,"fill":"#0088FE"},{"name":"Category C","value":50,"fill":"#FFBB28"},{"name":"Category D","value":30,"fill":"#FF8042"},{"name":"Category E","value":15,"fill":"#A569BD"}]}]', changeProp: 1 },
    ],
  },
];
