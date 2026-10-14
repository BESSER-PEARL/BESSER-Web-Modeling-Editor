// BAF reads a sqlite path from `db.sql.<name>.file`; with `database:` it logs
// "Missing required DB properties for 'db1' (dialect=sqlite): file".
import { describe, it, expect } from 'vitest';
// @ts-ignore
import * as jsyaml from 'js-yaml';
import {
  agentConfigFormToYaml,
  DEFAULT_AGENT_CONFIG_FORM,
  type AgentConfigFormData,
  type SqlDatabaseEntry,
} from '../AgentConfigYamlEditor';

const entry = (overrides: Partial<SqlDatabaseEntry>): SqlDatabaseEntry => ({
  name: 'db1', dialect: 'sqlite', database: 'shop.db', host: '', port: '', username: '', password: '',
  ...overrides,
});

function sqlSection(dbs: SqlDatabaseEntry[]): Record<string, Record<string, unknown>> {
  const form: AgentConfigFormData = {
    ...DEFAULT_AGENT_CONFIG_FORM,
    db: { ...DEFAULT_AGENT_CONFIG_FORM.db, sqlDatabases: dbs },
  };
  const parsed = (jsyaml as any).load(agentConfigFormToYaml(form));
  return Object.assign({}, ...parsed.db.sql);
}

describe('agentConfigFormToYaml sql databases', () => {
  it('writes the sqlite path under file:', () => {
    expect(sqlSection([entry({})]).db1).toEqual({ dialect: 'sqlite', file: 'shop.db' });
  });

  it('keeps database: for server dialects', () => {
    const sql = sqlSection([
      entry({ name: 'crm', dialect: 'postgresql', database: 'crm', host: 'db', port: '5432', username: 'u', password: 'p' }),
      entry({ name: 'erp', dialect: 'mysql', database: 'erp', host: 'db', port: '3306', username: 'u', password: 'p' }),
    ]);
    expect(sql.crm).toEqual({ dialect: 'postgresql', database: 'crm', host: 'db', port: 5432, username: 'u', password: 'p' });
    expect(sql.erp.database).toBe('erp');
    expect(sql.erp).not.toHaveProperty('file');
  });

  it('serializes a saved entry without a dialect as before', () => {
    const legacy = { ...entry({}), dialect: undefined } as unknown as SqlDatabaseEntry;
    expect(sqlSection([legacy]).db1).toEqual({ database: 'shop.db' });
  });
});
