import { TableComponent } from '../widgets/TableComponent';
import { getClassOptions } from '../diagram-helpers';
import i18n from '@/main/shared/i18n';

// Table trait configuration interface
export interface TableTrait {
  type: string;
  label?: string;
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

// Centralized table configuration.
// Factory so labels resolve in the current language each time it is called.
// Note: `defaultTitle` and trait `value` defaults stay English — they become user content.
export const getTableConfig = (): TableConfig => ({
  id: 'table',
  label: `Table`,
  component: TableComponent,
  defaultColor: '#2c3e50',
  defaultTitle: 'Table Title',
  dataSource: '',
  icon: '<svg viewBox="0 0 24 24" width="100%" height="100%"><rect x="3" y="4" width="18" height="16" rx="2" ry="2" fill="currentColor"/><rect x="5" y="7" width="14" height="2" fill="#ffffff"/><rect x="5" y="11" width="14" height="2" fill="#ffffff"/><rect x="5" y="15" width="14" height="2" fill="#ffffff"/></svg>',
  traits: [
    { type: 'color', label: i18n.t('editors.gui.traits.headerColor'), name: 'chart-color', value: '#2c3e50', changeProp: 1 },
    { type: 'text', label: i18n.t('editors.gui.traits.title'), name: 'chart-title', value: 'Table Title', changeProp: 1 },
    { type: 'select', label: i18n.t('editors.gui.traits.dataSource'), name: 'data-source', value: '', options: getClassOptions(), changeProp: 1 },
    { type: 'checkbox', label: i18n.t('editors.gui.traits.header'), name: 'show-header', value: true, changeProp: 1 },
    { type: 'checkbox', label: i18n.t('editors.gui.traits.stripedRows'), name: 'striped-rows', value: false, changeProp: 1 },
    { type: 'checkbox', label: i18n.t('editors.gui.traits.pagination'), name: 'show-pagination', value: true, changeProp: 1 },
    { type: 'number', label: i18n.t('editors.gui.traits.rowsPerPage'), name: 'rows-per-page', value: 5, changeProp: 1 },
  ],
});
