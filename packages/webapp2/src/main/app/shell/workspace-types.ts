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
  | 'kg_to_object'
  | 'kg_refine'
  | 'kg_export_owl'
  | 'kg_export_ttl'
  | 'kg_export_with_options';

export type GeneratorMenuMode = 'class' | 'object' | 'statemachine' | 'agent' | 'gui' | 'quantum' | 'kg' | 'none';
