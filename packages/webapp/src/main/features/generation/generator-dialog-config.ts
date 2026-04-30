import type { GeneratorType } from '../../app/shell/workspace-types';

export type ConfigDialog = 'none' | 'django' | 'sql' | 'sqlalchemy' | 'jsonschema' | 'agent' | 'qiskit' | 'web_app_checklist';

const GENERATOR_DIALOG_MAP: Partial<Record<GeneratorType, Exclude<ConfigDialog, 'none'>>> = {
  django: 'django',
  sql: 'sql',
  sqlalchemy: 'sqlalchemy',
  jsonschema: 'jsonschema',
  agent: 'agent',
  qiskit: 'qiskit',
  web_app: 'web_app_checklist',
};

export const getConfigDialogForGenerator = (generatorType: GeneratorType): ConfigDialog => {
  return GENERATOR_DIALOG_MAP[generatorType] ?? 'none';
};
