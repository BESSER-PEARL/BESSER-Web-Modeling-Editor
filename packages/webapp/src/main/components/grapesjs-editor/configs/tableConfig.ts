import { TableComponent } from '../widgets/TableComponent';
import { getClassOptions } from '../diagram-helpers';

// Table trait configuration interface
export interface TableTrait {
  type: string;
  label: string;
  name: string;
  value: any;
  changeProp: number;
  options?: { value: string; label: string }[];
}

export interface TableConfig {
  id: string;
  label: string;
  component: React.FC<any>;
  defaultColor: string;
  defaultTitle: string;
  dataSource: string;
  icon: string;
  traits: TableTrait[];
}

// Centralized table configuration
export const tableConfig: TableConfig = {
  id: 'table',
  label: 'Table',
  component: TableComponent,
  defaultColor: '#2c3e50',
  defaultTitle: 'Table Title',
  dataSource: '',
  icon: '<svg viewBox="0 0 24 24" width="100%" height="100%"><rect x="3" y="4" width="18" height="16" rx="2" ry="2" fill="currentColor"/><rect x="5" y="7" width="14" height="2" fill="#ffffff"/><rect x="5" y="11" width="14" height="2" fill="#ffffff"/><rect x="5" y="15" width="14" height="2" fill="#ffffff"/></svg>',
  traits: [
    { type: 'color', label: 'Header Color', name: 'chart-color', value: '#2c3e50', changeProp: 1 },
    { type: 'text', label: 'Title', name: 'chart-title', value: 'Table Title', changeProp: 1 },
    { type: 'select', label: 'Data Source', name: 'data-source', value: '', options: getClassOptions(), changeProp: 1 },
    { type: 'columns-manager', label: 'Columns', name: 'columns', value: '[]', changeProp: 1 },
    { type: 'checkbox', label: 'Show Header', name: 'show-header', value: true, changeProp: 1 },
    { type: 'checkbox', label: 'Striped Rows', name: 'striped-rows', value: false, changeProp: 1 },
    { type: 'checkbox', label: 'Show Pagination', name: 'show-pagination', value: true, changeProp: 1 },
    { type: 'number', label: 'Rows per Page', name: 'rows-per-page', value: 5, changeProp: 1 },
  ],
};
