import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Database, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useImportDiagramFromDb,
  type DbConnectionParams,
  type SupportedDbDialect,
} from './useImportDiagramFromDb';

const DIALECT_LABELS: Record<SupportedDbDialect, string> = {
  postgresql: 'PostgreSQL',
  mysql: 'MySQL / MariaDB',
  sqlite: 'SQLite (file upload)',
  mssql: 'SQL Server',
  oracle: 'Oracle',
};

const DEFAULT_PORTS: Partial<Record<SupportedDbDialect, number>> = {
  postgresql: 5432,
  mysql: 3306,
  mssql: 1433,
  oracle: 1521,
};

interface DatabaseImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: (diagramTitle: string) => void;
}

type Step = 'connect' | 'select';

export const DatabaseImportDialog: React.FC<DatabaseImportDialogProps> = ({
  open,
  onOpenChange,
  onImported,
}) => {
  const { uploadSqliteFile, introspect, importSelected } = useImportDiagramFromDb();

  const [step, setStep] = useState<Step>('connect');
  const [dialect, setDialect] = useState<SupportedDbDialect>('postgresql');
  const [host, setHost] = useState('');
  const [port, setPort] = useState<string>('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [database, setDatabase] = useState('');
  const [rawUrl, setRawUrl] = useState('');
  const [useRawUrl, setUseRawUrl] = useState(false);
  const [sqliteFile, setSqliteFile] = useState<File | null>(null);
  const [databaseToken, setDatabaseToken] = useState<string | null>(null);

  const [error, setError] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [busyMessage, setBusyMessage] = useState('');

  const [schemas, setSchemas] = useState<Record<string, string[]>>({});
  const [selected, setSelected] = useState<Record<string, Set<string>>>({});

  const reset = useCallback(() => {
    setStep('connect');
    setDialect('postgresql');
    setHost('');
    setPort('');
    setUsername('');
    setPassword('');
    setDatabase('');
    setRawUrl('');
    setUseRawUrl(false);
    setSqliteFile(null);
    setDatabaseToken(null);
    setError('');
    setIsBusy(false);
    setBusyMessage('');
    setSchemas({});
    setSelected({});
  }, []);

  useEffect(() => {
    if (!open) {
      reset();
    }
  }, [open, reset]);

  const buildConnection = useCallback((): DbConnectionParams => {
    if (useRawUrl) {
      return { raw_url: rawUrl.trim() };
    }
    if (dialect === 'sqlite' && databaseToken) {
      return { dialect: 'sqlite', database_token: databaseToken };
    }
    const portValue = port.trim();
    return {
      dialect,
      host: host.trim() || undefined,
      port: portValue ? Number(portValue) : undefined,
      username: username.trim() || undefined,
      password: password || undefined,
      database: database.trim() || undefined,
    };
  }, [useRawUrl, rawUrl, dialect, databaseToken, host, port, username, password, database]);

  const canConnect = useMemo(() => {
    if (isBusy) return false;
    if (useRawUrl) return rawUrl.trim().length > 0;
    if (dialect === 'sqlite') return Boolean(sqliteFile || databaseToken);
    return host.trim().length > 0 && database.trim().length > 0;
  }, [isBusy, useRawUrl, rawUrl, dialect, sqliteFile, databaseToken, host, database]);

  const totalSelectedTables = useMemo(
    () => Object.values(selected).reduce((sum, tables) => sum + tables.size, 0),
    [selected],
  );

  const handleSqliteFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSqliteFile(file);
    setDatabaseToken(null);
    if (file) {
      const allowed = ['.sqlite', '.sqlite3', '.db'];
      const lower = file.name.toLowerCase();
      if (!allowed.some((ext) => lower.endsWith(ext))) {
        setError('Only .sqlite, .sqlite3, or .db files are allowed.');
        setSqliteFile(null);
        return;
      }
      setError('');
    }
  }, []);

  const handleDialectChange = useCallback((value: string) => {
    const next = value as SupportedDbDialect;
    setDialect(next);
    setError('');
    setSqliteFile(null);
    setDatabaseToken(null);
    if (DEFAULT_PORTS[next] !== undefined) {
      setPort(String(DEFAULT_PORTS[next]));
    } else {
      setPort('');
    }
  }, []);

  const handleConnect = useCallback(async () => {
    setError('');
    setIsBusy(true);
    try {
      let connection: DbConnectionParams;
      if (!useRawUrl && dialect === 'sqlite' && sqliteFile && !databaseToken) {
        setBusyMessage('Uploading SQLite file…');
        const upload = await uploadSqliteFile(sqliteFile);
        setDatabaseToken(upload.database_token);
        connection = { dialect: 'sqlite', database_token: upload.database_token };
      } else {
        connection = buildConnection();
      }
      setBusyMessage('Connecting…');
      const result = await introspect(connection);
      const filtered: Record<string, string[]> = {};
      for (const [schema, tables] of Object.entries(result.schemas || {})) {
        if (Array.isArray(tables) && tables.length > 0) {
          filtered[schema] = tables;
        }
      }
      if (Object.keys(filtered).length === 0) {
        setError('No tables were discovered for this connection.');
        return;
      }
      setSchemas(filtered);
      const initialSelection: Record<string, Set<string>> = {};
      for (const [schema, tables] of Object.entries(filtered)) {
        initialSelection[schema] = new Set(tables);
      }
      setSelected(initialSelection);
      setStep('select');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed.');
    } finally {
      setIsBusy(false);
      setBusyMessage('');
    }
  }, [useRawUrl, dialect, sqliteFile, databaseToken, uploadSqliteFile, buildConnection, introspect]);

  const toggleTable = useCallback((schema: string, table: string) => {
    setSelected((prev) => {
      const next = { ...prev };
      const current = new Set(next[schema] ?? []);
      if (current.has(table)) {
        current.delete(table);
      } else {
        current.add(table);
      }
      next[schema] = current;
      return next;
    });
  }, []);

  const toggleSchema = useCallback(
    (schema: string) => {
      setSelected((prev) => {
        const tables = schemas[schema] ?? [];
        const current = prev[schema] ?? new Set<string>();
        const next = { ...prev };
        next[schema] = current.size === tables.length ? new Set<string>() : new Set(tables);
        return next;
      });
    },
    [schemas],
  );

  const handleImport = useCallback(async () => {
    setError('');
    setIsBusy(true);
    setBusyMessage('Importing…');
    try {
      const selectionPayload: Record<string, string[]> = {};
      for (const [schema, tables] of Object.entries(selected)) {
        if (tables.size > 0) {
          selectionPayload[schema] = Array.from(tables);
        }
      }
      if (Object.keys(selectionPayload).length === 0) {
        setError('Select at least one table to import.');
        return;
      }
      const result = await importSelected(buildConnection(), selectionPayload);
      onImported?.(result.diagramTitle);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      setIsBusy(false);
      setBusyMessage('');
    }
  }, [selected, buildConnection, importSelected, onImported, onOpenChange]);

  const isStructured = !useRawUrl;
  const isSqliteStructured = isStructured && dialect === 'sqlite';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="size-4" />
            {step === 'connect' ? 'Connect to Database' : 'Select Tables to Import'}
          </DialogTitle>
          <DialogDescription>
            {step === 'connect'
              ? 'Connect to an external database to reverse-engineer a class diagram.'
              : 'Pick the tables to include. Foreign keys become associations automatically.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'connect' ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="db-import-mode">Connection mode</Label>
              <div className="flex items-center gap-3 text-sm">
                <label className="flex items-center gap-1">
                  <input
                    type="radio"
                    name="db-import-mode"
                    checked={!useRawUrl}
                    onChange={() => setUseRawUrl(false)}
                  />
                  Structured fields
                </label>
                <label className="flex items-center gap-1">
                  <input
                    type="radio"
                    name="db-import-mode"
                    checked={useRawUrl}
                    onChange={() => setUseRawUrl(true)}
                  />
                  SQLAlchemy URL
                </label>
              </div>
            </div>

            {useRawUrl ? (
              <div className="space-y-1.5">
                <Label htmlFor="db-import-raw-url">SQLAlchemy URL</Label>
                <Input
                  id="db-import-raw-url"
                  placeholder="postgresql://user:pass@host:5432/dbname"
                  value={rawUrl}
                  onChange={(e) => setRawUrl(e.target.value)}
                  autoComplete="off"
                />
                <p className="text-xs text-muted-foreground">
                  Used as-is. Make sure the corresponding driver is installed on the backend.
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="db-import-dialect">Database type</Label>
                  <Select value={dialect} onValueChange={handleDialectChange}>
                    <SelectTrigger id="db-import-dialect">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(DIALECT_LABELS) as SupportedDbDialect[]).map((d) => (
                        <SelectItem key={d} value={d}>
                          {DIALECT_LABELS[d]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {isSqliteStructured ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="db-import-sqlite-file">SQLite file</Label>
                    <input
                      id="db-import-sqlite-file"
                      type="file"
                      accept=".sqlite,.sqlite3,.db"
                      onChange={handleSqliteFileChange}
                      className="block w-full cursor-pointer rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground/80"
                    />
                    {sqliteFile && (
                      <p className="text-xs text-muted-foreground">Selected: {sqliteFile.name}</p>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-2 space-y-1.5">
                        <Label htmlFor="db-import-host">Host</Label>
                        <Input
                          id="db-import-host"
                          value={host}
                          onChange={(e) => setHost(e.target.value)}
                          placeholder="localhost"
                          autoComplete="off"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="db-import-port">Port</Label>
                        <Input
                          id="db-import-port"
                          type="number"
                          value={port}
                          onChange={(e) => setPort(e.target.value)}
                          placeholder="5432"
                          autoComplete="off"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="db-import-database">Database name</Label>
                      <Input
                        id="db-import-database"
                        value={database}
                        onChange={(e) => setDatabase(e.target.value)}
                        autoComplete="off"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="db-import-username">Username</Label>
                        <Input
                          id="db-import-username"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          autoComplete="off"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="db-import-password">Password</Label>
                        <Input
                          id="db-import-password"
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          autoComplete="off"
                        />
                      </div>
                    </div>
                  </>
                )}
              </>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}
            {isBusy && busyMessage && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-3 animate-spin" />
                {busyMessage}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="max-h-80 space-y-3 overflow-y-auto rounded-md border border-border p-3">
              {Object.entries(schemas).map(([schema, tables]) => {
                const selectedTables = selected[schema] ?? new Set<string>();
                const allChecked = selectedTables.size === tables.length && tables.length > 0;
                return (
                  <div key={schema} className="space-y-1.5">
                    <label className="flex items-center gap-2 text-sm font-semibold">
                      <input
                        type="checkbox"
                        checked={allChecked}
                        onChange={() => toggleSchema(schema)}
                      />
                      <span>{schema}</span>
                      <span className="text-xs font-normal text-muted-foreground">
                        ({selectedTables.size}/{tables.length})
                      </span>
                    </label>
                    <div className="ml-6 grid grid-cols-2 gap-1">
                      {tables.map((table) => (
                        <label key={table} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={selectedTables.has(table)}
                            onChange={() => toggleTable(schema, table)}
                          />
                          <span className="truncate">{table}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              {totalSelectedTables} table{totalSelectedTables === 1 ? '' : 's'} selected.
            </p>
            {error && <p className="text-sm text-destructive">{error}</p>}
            {isBusy && busyMessage && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-3 animate-spin" />
                {busyMessage}
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          {step === 'select' && (
            <Button
              variant="outline"
              onClick={() => setStep('connect')}
              disabled={isBusy}
              className="mr-auto"
            >
              Back
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isBusy}>
            Cancel
          </Button>
          {step === 'connect' ? (
            <Button
              onClick={handleConnect}
              disabled={!canConnect}
              className="bg-brand text-brand-foreground hover:bg-brand-dark"
            >
              {isBusy ? 'Connecting…' : 'Connect'}
            </Button>
          ) : (
            <Button
              onClick={handleImport}
              disabled={isBusy || totalSelectedTables === 0}
              className="bg-brand text-brand-foreground hover:bg-brand-dark"
            >
              {isBusy ? 'Importing…' : 'Import'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
