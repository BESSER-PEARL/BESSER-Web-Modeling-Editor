import { LineChartComponent } from '../widgets/LineChartComponent';
import { BarChartComponent } from '../widgets/BarChartComponent';
import { PieChartComponent } from '../widgets/PieChartComponent';
import { RadarChartComponent } from '../widgets/RadarChartComponent';
import { RadialBarChartComponent } from '../widgets/RadialBarChartComponent';
import { TableChartComponent } from '../widgets/TableChartComponent';
import { getClassOptions } from '../diagram-helpers';

// Aggregation options for dashboard metrics
export const aggregationOptions = [
  { value: '', label: 'None' },
  { value: 'sum', label: 'Sum' },
  { value: 'avg', label: 'Average' },
  { value: 'count', label: 'Count' },
  { value: 'min', label: 'Minimum' },
  { value: 'max', label: 'Maximum' },
  { value: 'median', label: 'Median' },
  { value: 'first', label: 'First' },
  { value: 'last', label: 'Last' },
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

// Centralized chart configurations
export const chartConfigs: ChartConfig[] = [
  {
    id: 'line-chart',
    label: 'Line Chart',
    component: LineChartComponent,
    defaultColor: '#4CAF50',
    defaultTitle: 'Line Chart Title',
    dataSource: '',
    icon: '<svg viewBox="0 0 24 24" width="100%" height="100%"><path fill="currentColor" d="M3 3v18h18v-2H5V3H3zm2 12l3-4 3 3 5-6 4 5v2l-4-5-5 6-3-3-3 4z"/></svg>',
    traits: [
      { type: 'color', label: 'Line Color', name: 'chart-color', value: '#4CAF50', changeProp: 1 },
      { type: 'text', label: 'Chart Title', name: 'chart-title', value: 'Line Chart Title', changeProp: 1 },
      { type: 'select', label: 'Data Source', name: 'data-source', value: '', options: getClassOptions(), changeProp: 1 },
      { type: 'select', label: 'Label Field', name: 'label-field', value: '', options: [], changeProp: 1 },
      { type: 'select', label: 'Data Field', name: 'data-field', value: '', options: [], changeProp: 1 },
      // TODO: Uncomment when backend aggregation is ready
      // { type: 'select', label: 'Aggregation', name: 'aggregation', value: '', options: aggregationOptions, changeProp: 1 },
      // { type: 'select', label: 'Group By', name: 'group-by', value: '', options: [], changeProp: 1 },
      { type: 'number', label: 'Line Width', name: 'line-width', value: 2, changeProp: 1 },
      { type: 'checkbox', label: 'Show Grid', name: 'show-grid', value: true, changeProp: 1 },
      { type: 'checkbox', label: 'Show Legend', name: 'show-legend', value: true, changeProp: 1 },
      { type: 'checkbox', label: 'Show Tooltip', name: 'show-tooltip', value: true, changeProp: 1 },
      { type: 'select', label: 'Curve Type', name: 'curve-type', value: 'monotone', 
        options: [
          { value: 'linear', label: 'Linear' },
          { value: 'monotone', label: 'Monotone' },
          { value: 'step', label: 'Step' },
          { value: 'stepBefore', label: 'Step Before' },
          { value: 'stepAfter', label: 'Step After' }
        ], changeProp: 1 },
      { type: 'checkbox', label: 'Animate', name: 'animate', value: true, changeProp: 1 },
    ],
  },
  {
    id: 'bar-chart',
    label: 'Bar Chart',
    component: BarChartComponent,
    defaultColor: '#3498db',
    defaultTitle: 'Bar Chart Title',
    dataSource: '',
    icon: '<svg viewBox="0 0 24 24" width="100%" height="100%"><path fill="currentColor" d="M22,21H2V3H4V19H6V10H10V19H12V6H16V19H18V14H22V21Z"/></svg>',
    traits: [
      { type: 'color', label: 'Bar Color', name: 'chart-color', value: '#3498db', changeProp: 1 },
      { type: 'text', label: 'Chart Title', name: 'chart-title', value: 'Bar Chart Title', changeProp: 1 },
      { type: 'select', label: 'Data Source', name: 'data-source', value: '', options: getClassOptions(), changeProp: 1 },
      { type: 'select', label: 'Label Field', name: 'label-field', value: '', options: [], changeProp: 1 },
      { type: 'select', label: 'Data Field', name: 'data-field', value: '', options: [], changeProp: 1 },
      { type: 'number', label: 'Bar Width', name: 'bar-width', value: 30, changeProp: 1 },
      { type: 'select', label: 'Orientation', name: 'orientation', value: 'vertical',
        options: [
          { value: 'vertical', label: 'Vertical' },
          { value: 'horizontal', label: 'Horizontal' }
        ], changeProp: 1 },
      { type: 'checkbox', label: 'Show Grid', name: 'show-grid', value: true, changeProp: 1 },
      { type: 'checkbox', label: 'Show Legend', name: 'show-legend', value: true, changeProp: 1 },
      { type: 'checkbox', label: 'Stacked', name: 'stacked', value: false, changeProp: 1 },
    ],
  },
  {
    id: 'pie-chart',
    label: 'Pie Chart',
    component: PieChartComponent,
    defaultColor: '',
    defaultTitle: 'Pie Chart Title',
    dataSource: '',
    icon: '<svg viewBox="0 0 24 24" width="100%" height="100%"><path fill="currentColor" d="M11,2V22C5.9,21.5 2,17.2 2,12C2,6.8 5.9,2.5 11,2M13,2V11H22C21.5,6.2 17.8,2.5 13,2M13,13V22C17.7,21.5 21.5,17.8 22,13H13Z"/></svg>',
    traits: [
      { type: 'text', label: 'Chart Title', name: 'chart-title', value: 'Pie Chart Title', changeProp: 1 },
      { type: 'select', label: 'Data Source', name: 'data-source', value: '', options: getClassOptions(), changeProp: 1 },
      { type: 'select', label: 'Label Field', name: 'label-field', value: '', options: [], changeProp: 1 },
      { type: 'select', label: 'Data Field', name: 'data-field', value: '', options: [], changeProp: 1 },
      { type: 'checkbox', label: 'Show Legend', name: 'show-legend', value: true, changeProp: 1 },
      { type: 'select', label: 'Legend Position', name: 'legend-position', value: 'bottom',
        options: [
          { value: 'top', label: 'Top' },
          { value: 'bottom', label: 'Bottom' }
        ], changeProp: 1 },
      { type: 'checkbox', label: 'Show Labels', name: 'show-labels', value: true, changeProp: 1 },
      { type: 'select', label: 'Label Position', name: 'label-position', value: 'inside',
        options: [
          { value: 'inside', label: 'Inside' },
          { value: 'outside', label: 'Outside' }
        ], changeProp: 1 },
      { type: 'number', label: 'Padding Angle', name: 'padding-angle', value: 0, changeProp: 1 },
    ],
  },
  {
    id: 'radar-chart',
    label: 'Radar Chart',
    component: RadarChartComponent,
    defaultColor: '#8884d8',
    defaultTitle: 'Radar Chart Title',
    dataSource: '',
    icon: '<svg viewBox="0 0 24 24" width="100%" height="100%"><g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="12" x2="12" y2="3"/><line x1="12" y1="12" x2="20" y2="8"/><line x1="12" y1="12" x2="17" y2="20"/><line x1="12" y1="12" x2="7" y2="20"/><line x1="12" y1="12" x2="4" y2="8"/><polygon points="12,6 17.5,9.5 15,16 9,16 6.5,9.5"/></g></svg>',
    traits: [
      { type: 'color', label: 'Chart Color', name: 'chart-color', value: '#8884d8', changeProp: 1 },
      { type: 'text', label: 'Chart Title', name: 'chart-title', value: 'Radar Chart Title', changeProp: 1 },
      { type: 'select', label: 'Data Source', name: 'data-source', value: '', options: getClassOptions(), changeProp: 1 },
      { type: 'select', label: 'Label Field', name: 'label-field', value: '', options: [], changeProp: 1 },
      { type: 'select', label: 'Data Field', name: 'data-field', value: '', options: [], changeProp: 1 },
      { type: 'checkbox', label: 'Show Grid', name: 'show-grid', value: true, changeProp: 1 },
      { type: 'checkbox', label: 'Show Tooltip', name: 'show-tooltip', value: true, changeProp: 1 },
      { type: 'checkbox', label: 'Show Radius Axis', name: 'show-radius-axis', value: true, changeProp: 1 },
    ],
  },
  {
    id: 'radial-bar-chart',
    label: 'Radial Bar Chart',
    component: RadialBarChartComponent,
    defaultColor: '',
    defaultTitle: 'Radial Bar Chart Title',
    dataSource: '',
    icon: '<svg viewBox="0 0 24 24" width="100%" height="100%"><g fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="3"/></g></svg>',
    traits: [
      { type: 'text', label: 'Chart Title', name: 'chart-title', value: 'Radial Bar Chart Title', changeProp: 1 },
      { type: 'select', label: 'Data Source', name: 'data-source', value: '', options: getClassOptions(), changeProp: 1 },
      { type: 'select', label: 'Label Field', name: 'label-field', value: '', options: [], changeProp: 1 },
      { type: 'select', label: 'Data Field', name: 'data-field', value: '', options: [], changeProp: 1 },
      { type: 'number', label: 'Start Angle', name: 'start-angle', value: 90, changeProp: 1 },
      { type: 'number', label: 'End Angle', name: 'end-angle', value: 450, changeProp: 1 },
    ],
  },
  {
    id: 'table-chart',
    label: 'Table Chart',
    component: TableChartComponent,
    defaultColor: '#2c3e50',
    defaultTitle: 'Table Chart Title',
    dataSource: '',
    icon: '<svg viewBox="0 0 24 24" width="100%" height="100%"><rect x="3" y="4" width="18" height="16" rx="2" ry="2" fill="currentColor"/><rect x="5" y="7" width="14" height="2" fill="#ffffff"/><rect x="5" y="11" width="14" height="2" fill="#ffffff"/><rect x="5" y="15" width="14" height="2" fill="#ffffff"/></svg>',
    traits: [
      { type: 'color', label: 'Header Color', name: 'chart-color', value: '#2c3e50', changeProp: 1 },
      { type: 'text', label: 'Chart Title', name: 'chart-title', value: 'Table Chart Title', changeProp: 1 },
      { type: 'select', label: 'Data Source', name: 'data-source', value: '', options: getClassOptions(), changeProp: 1 },
      { type: 'checkbox', label: 'Show Header', name: 'show-header', value: true, changeProp: 1 },
      { type: 'checkbox', label: 'Striped Rows', name: 'striped-rows', value: false, changeProp: 1 },
      { type: 'checkbox', label: 'Show Pagination', name: 'show-pagination', value: true, changeProp: 1 },
      { type: 'number', label: 'Rows per Page', name: 'rows-per-page', value: 5, changeProp: 1 },
    ],
  },
];
