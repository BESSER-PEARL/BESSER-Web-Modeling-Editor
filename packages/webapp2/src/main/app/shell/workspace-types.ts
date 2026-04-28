export type GeneratorType =
  | 'django'
  | 'backend'
  | 'web_app'
  | 'sql'
  | 'sqlalchemy'
  | 'python'
  | 'java'
  | 'pydantic'
  | 'jsonschema'
  | 'smartdata'
  | 'agent'
  | 'qiskit'
  | 'jsonobject'
  | 'kg_to_class'
  | 'kg_to_object';

export type GeneratorMenuMode = 'class' | 'object' | 'statemachine' | 'agent' | 'gui' | 'quantum' | 'kg' | 'none';
