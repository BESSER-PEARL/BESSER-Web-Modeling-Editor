import React from 'react';
import { useTranslation } from 'react-i18next';
import { ItemRow } from '../ui/ItemRow';
import { SelectField, TextField } from '../ui/fields';
import { EmptyHint, SectionPage } from '../ui/SectionPage';
import type { SectionProps } from './types';

/** Row id of a SQL database entry (they live in the config form, keyed by index). */
export const sqlItemId = (index: number) => `sql-item-${index}`;

export function SqlDatabasesSection({ store, expandedId, toggle, expand }: SectionProps) {
  const { t } = useTranslation();
  const { sqlDatabases, updateSqlDatabase, removeSqlDatabase } = store;

  return (
    <SectionPage
      title={t('agentComponents.sql.title')}
      description={t('agentComponents.sql.description')}
      onAdd={() => expand(sqlItemId(store.addSqlDatabase()))}
      addLabel={t('agentComponents.sql.addLabel')}
    >
      {sqlDatabases.length === 0 && <EmptyHint message={t('agentComponents.sql.empty')} />}
      {sqlDatabases.map((db, index) => {
        const itemId = sqlItemId(index);
        const isSqlite = db.dialect === 'sqlite';
        return (
          <ItemRow
            key={itemId}
            name={db.name}
            badge={db.dialect || undefined}
            expanded={expandedId === itemId}
            onToggle={() => toggle(itemId)}
            onDelete={() => removeSqlDatabase(index)}
          >
            <div className="grid grid-cols-2 gap-4">
              <TextField
                id={`sql-name-${index}`}
                label={t('agentComponents.sql.name')}
                value={db.name}
                onChange={v => updateSqlDatabase(index, { name: v })}
                placeholder={t('agentComponents.sql.namePlaceholder')}
                description={t('agentComponents.sql.nameDescription')}
              />
              <SelectField
                id={`sql-dialect-${index}`}
                label={t('agentComponents.sql.dialect')}
                value={db.dialect}
                onChange={v => updateSqlDatabase(index, { dialect: v })}
                options={[
                  { value: 'postgresql', label: t('agentComponents.sql.dialectPostgresql') },
                  { value: 'sqlite', label: t('agentComponents.sql.dialectSqlite') },
                  { value: 'mysql', label: t('agentComponents.sql.dialectMysql') },
                  { value: 'mariadb', label: t('agentComponents.sql.dialectMariadb') },
                  { value: 'mssql', label: t('agentComponents.sql.dialectMssql') },
                  { value: 'oracle', label: t('agentComponents.sql.dialectOracle') },
                ]}
              />
            </div>
            <TextField
              id={`sql-database-${index}`}
              label={isSqlite ? t('agentComponents.sql.databaseFilePath') : t('agentComponents.sql.databaseName')}
              value={db.database}
              onChange={v => updateSqlDatabase(index, { database: v })}
              placeholder={isSqlite ? t('agentComponents.sql.databaseFilePathPlaceholder') : t('agentComponents.sql.databaseNamePlaceholder')}
            />
            {!isSqlite && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <TextField
                    id={`sql-host-${index}`}
                    label={t('agentComponents.sql.host')}
                    value={db.host}
                    onChange={v => updateSqlDatabase(index, { host: v })}
                    placeholder={t('agentComponents.sql.hostPlaceholder')}
                  />
                  <TextField
                    id={`sql-port-${index}`}
                    label={t('agentComponents.sql.port')}
                    value={db.port}
                    onChange={v => updateSqlDatabase(index, { port: v })}
                    placeholder={t('agentComponents.sql.portPlaceholder')}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <TextField
                    id={`sql-user-${index}`}
                    label={t('agentComponents.sql.username')}
                    value={db.username}
                    onChange={v => updateSqlDatabase(index, { username: v })}
                    placeholder={t('agentComponents.sql.usernamePlaceholder')}
                  />
                  <TextField
                    id={`sql-pass-${index}`}
                    label={t('agentComponents.sql.password')}
                    value={db.password}
                    onChange={v => updateSqlDatabase(index, { password: v })}
                    placeholder={t('agentComponents.sql.passwordPlaceholder')}
                  />
                </div>
              </>
            )}
          </ItemRow>
        );
      })}
    </SectionPage>
  );
}
