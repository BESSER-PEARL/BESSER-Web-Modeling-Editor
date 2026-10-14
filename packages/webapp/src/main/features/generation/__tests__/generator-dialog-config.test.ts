import { describe, it, expect } from 'vitest';
import { getConfigDialogForGenerator } from '../generator-dialog-config';

describe('getConfigDialogForGenerator', () => {
  it('maps supabase to its own config dialog', () => {
    expect(getConfigDialogForGenerator('supabase')).toBe('supabase');
  });

  it('maps the other dialog-backed generators to their dialogs', () => {
    expect(getConfigDialogForGenerator('django')).toBe('django');
    expect(getConfigDialogForGenerator('sql')).toBe('sql');
    expect(getConfigDialogForGenerator('sqlalchemy')).toBe('sqlalchemy');
    expect(getConfigDialogForGenerator('jsonschema')).toBe('jsonschema');
    expect(getConfigDialogForGenerator('agent')).toBe('agent');
    expect(getConfigDialogForGenerator('qiskit')).toBe('qiskit');
    expect(getConfigDialogForGenerator('web_app')).toBe('web_app_checklist');
  });

  it('returns none for generators without a config dialog', () => {
    expect(getConfigDialogForGenerator('python')).toBe('none');
    expect(getConfigDialogForGenerator('java')).toBe('none');
    expect(getConfigDialogForGenerator('pydantic')).toBe('none');
    expect(getConfigDialogForGenerator('smartdata')).toBe('none');
  });
});
