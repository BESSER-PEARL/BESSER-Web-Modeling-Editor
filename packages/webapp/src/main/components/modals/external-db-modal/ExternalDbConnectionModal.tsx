import React, { useState } from 'react';
import { fetchDatabaseMetadata } from '../../../services/external-db/externalDbApi';
import { useAppDispatch } from '../../../app/store/hooks';
import { updateDiagramModelThunk, bumpEditorRevision } from '../../../app/store/workspaceSlice';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface ExternalDbConnectionModalProps {
  show: boolean;
  onHide: () => void;
}

type ConnectionMethod = 'parameters' | 'url';

export const ExternalDbConnectionModal: React.FC<ExternalDbConnectionModalProps> = ({ show, onHide }) => {
  const dispatch = useAppDispatch();
  const [connectionMethod, setConnectionMethod] = useState<ConnectionMethod>('parameters');

  const [dbType, setDbType] = useState('postgresql');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [host, setHost] = useState('localhost');
  const [port, setPort] = useState('5432');
  const [dbName, setDbName] = useState('');

  const [connectionUrl, setConnectionUrl] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const buildConnectionUrl = (): string => {
    if (connectionMethod === 'url') {
      return connectionUrl;
    }
    if (dbType === 'sqlite') {
      return `sqlite:///${dbName || ':memory:'}`;
    }
    const auth = password ? `${username}:${password}` : username;
    const authPart = auth ? `${auth}@` : '';
    const portPart = port ? `:${port}` : '';
    const dialect = dbType === 'mysql' ? 'mysql+pymysql' : dbType;
    return `${dialect}://${authPart}${host}${portPart}/${dbName}`;
  };

  const handleConnect = async () => {
    setError(null);
    setSuccess(false);
    setIsLoading(true);
    try {
      const url = buildConnectionUrl();
      const diagramJson = await fetchDatabaseMetadata(url);
      await dispatch(updateDiagramModelThunk({ model: diagramJson, title: 'External DB Class Diagram' }));
      dispatch(bumpEditorRevision());
      setSuccess(true);
      onHide();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to connect to the database.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setError(null);
    setSuccess(false);
    onHide();
  };

  const tabs: ConnectionMethod[] = ['parameters', 'url'];
  const tabLabels: Record<ConnectionMethod, string> = { parameters: 'Parameters', url: 'Connection URL' };

  return (
    <Dialog open={show} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Connect External Database</DialogTitle>
        </DialogHeader>

        {/* Tab switcher */}
        <div className="flex gap-1 rounded-lg bg-muted p-1 text-sm">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setConnectionMethod(tab)}
              className={`flex-1 rounded-md px-3 py-1.5 transition-colors ${
                connectionMethod === tab
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tabLabels[tab]}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {connectionMethod === 'parameters' ? (
            <>
              <div className="space-y-1">
                <Label>Database Type</Label>
                <Select value={dbType} onValueChange={setDbType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="postgresql">PostgreSQL</SelectItem>
                    <SelectItem value="mysql">MySQL</SelectItem>
                    <SelectItem value="sqlite">SQLite</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {dbType !== 'sqlite' && (
                <>
                  <div className="flex gap-3">
                    <div className="flex-1 space-y-1">
                      <Label>Host</Label>
                      <Input value={host} onChange={(e) => setHost(e.target.value)} />
                    </div>
                    <div className="w-24 space-y-1">
                      <Label>Port</Label>
                      <Input value={port} onChange={(e) => setPort(e.target.value)} />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1 space-y-1">
                      <Label>Username</Label>
                      <Input value={username} onChange={(e) => setUsername(e.target.value)} />
                    </div>
                    <div className="flex-1 space-y-1">
                      <Label>Password</Label>
                      <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                    </div>
                  </div>
                </>
              )}

              <div className="space-y-1">
                <Label>{dbType === 'sqlite' ? 'File Path (leave blank for memory)' : 'Database Name'}</Label>
                <Input value={dbName} onChange={(e) => setDbName(e.target.value)} />
              </div>
            </>
          ) : (
            <div className="space-y-1">
              <Label>SQLAlchemy Connection URL</Label>
              <Input
                value={connectionUrl}
                onChange={(e) => setConnectionUrl(e.target.value)}
                placeholder="postgresql://user:password@localhost:5432/dbname"
              />
              <p className="text-xs text-muted-foreground">Enter a complete SQLAlchemy connection URL.</p>
            </div>
          )}

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          )}
          {success && (
            <p className="rounded-md bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-400">
              Successfully connected and loaded class diagram!
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Close</Button>
          <Button onClick={handleConnect} disabled={isLoading}>
            {isLoading ? 'Connecting...' : 'Connect and Fetch Metadata'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
