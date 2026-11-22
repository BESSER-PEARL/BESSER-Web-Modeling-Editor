import type { GeneratorType } from '../../shared/types/workspace-types';

export type ConfigDialog = 'none' | 'django' | 'spring' | 'sql' | 'supabase' | 'sqlalchemy' | 'jsonschema' | 'agent' | 'qiskit' | 'forecaster' | 'web_app_checklist';

const GENERATOR_DIALOG_MAP: Partial<Record<GeneratorType, Exclude<ConfigDialog, 'none'>>> = {
  django: 'django',
  spring: 'spring',
  sql: 'sql',
  supabase: 'supabase',
  sqlalchemy: 'sqlalchemy',
  jsonschema: 'jsonschema',
  agent: 'agent',
  qiskit: 'qiskit',
  forecaster: 'forecaster',
  web_app: 'web_app_checklist',
};

export const getConfigDialogForGenerator = (generatorType: GeneratorType): ConfigDialog => {
  return GENERATOR_DIALOG_MAP[generatorType] ?? 'none';
};
