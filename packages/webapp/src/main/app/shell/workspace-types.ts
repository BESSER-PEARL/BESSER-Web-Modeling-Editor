export type GeneratorType =
  | 'django'
  | 'backend'
  | 'web_app'
  | 'sql'
  | 'supabase'
  | 'sqlalchemy'
  | 'python'
  | 'java'
  | 'pydantic'
  | 'jsonschema'
  | 'smartdata'
  | 'agent'
  | 'qiskit'
  | 'jsonobject'
  | 'platform'
  | 'pytorch'
  | 'tensorflow'
  | 'bpmn'
  | 'test_case';

export type GeneratorMenuMode = 'class' | 'object' | 'user' | 'statemachine' | 'agent' | 'gui' | 'quantum' | 'nn' | 'platform' | 'bpmn' | 'none';
