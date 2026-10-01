import type { Editor } from 'grapesjs';
import { getChartConfigs } from './configs/chartConfigs';
import { getTableConfig } from './configs/tableConfig';
import { getMetricCardConfig } from './configs/metricCardConfigs';
import { getMapConfig } from './configs/mapConfig';
import { registerChartComponent } from './component-registrars/registerChartComponent';
import { registerTableComponent } from './component-registrars/registerTableComponent';
import { registerMetricCardComponent } from './component-registrars/registerMetricCardComponent';
import { registerMapComponent } from './component-registrars/registerMapComponent';
import { registerButtonComponent } from './component-registrars/registerButtonComponent';
import { registerLayoutComponents } from './component-registrars/registerLayoutComponents';
import { registerAgentComponent } from './component-registrars/registerAgentComponent';
import { setupLayoutBlocks } from './setup/setupLayoutBlocks';
import { setupInputBlocks } from './setup/setupInputBlocks';
import registerColumnsManagerTrait from './traits/registerColumnsManagerTrait';

/**
 * Register all shared custom components, blocks, and traits on a GrapesJS editor
 * instance. Called by both GraphicalUIEditor and AgentGUIEditor so that adding a
 * new component here automatically applies to both editors.
 */
export function registerAllComponents(editor: Editor): void {
  registerColumnsManagerTrait(editor);
  setupLayoutBlocks(editor);
  setupInputBlocks(editor);
  getChartConfigs().forEach((config) => registerChartComponent(editor, config));
  registerTableComponent(editor, getTableConfig());
  registerMetricCardComponent(editor, getMetricCardConfig());
  registerMapComponent(editor, getMapConfig());
  registerButtonComponent(editor);
  // registerFormComponents(editor); // Uncomment when form components are re-enabled
  registerLayoutComponents(editor);
  registerAgentComponent(editor);
}
