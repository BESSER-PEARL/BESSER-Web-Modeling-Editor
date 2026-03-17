import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { loadDiagram } from '../../../services/diagram/diagramSlice';
import { Modal, Button, Form, Spinner, Alert, Tabs, Tab } from 'react-bootstrap';
import { fetchDatabaseMetadata } from '../../../services/external-db/externalDbApi';

export interface ExternalDbConnectionModalProps {
  show: boolean;
  onHide: () => void;
}

export const ExternalDbConnectionModal: React.FC<ExternalDbConnectionModalProps> = ({ show, onHide }) => {
  const dispatch = useDispatch();
  const [connectionMethod, setConnectionMethod] = useState<'parameters' | 'url'>('parameters');
  
  // Parameter fields
  const [dbType, setDbType] = useState('postgresql');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [host, setHost] = useState('localhost');
  const [port, setPort] = useState('5432');
  const [dbName, setDbName] = useState('');
  
  // URL field
  const [connectionUrl, setConnectionUrl] = useState('');

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<any | null>(null);

  const buildConnectionUrl = () => {
    if (connectionMethod === 'url') {
      return connectionUrl;
    }

    if (dbType === 'sqlite') {
      return `sqlite:///${dbName || ':memory:'}`;
    }

    const auth = password ? `${username}:${password}` : username;
    const authPart = auth ? `${auth}@` : '';
    const portPart = port ? `:${port}` : '';
    
    // Default dialects for sqlalchemy:
    // Postgres -> postgresql
    // MySQL -> mysql+pymysql (or mysql)
    // Here we use postgresql and mysql as the base driver strings
    let dialect = dbType;
    if (dbType === 'mysql') {
      dialect = 'mysql+pymysql';
    }

    return `${dialect}://${authPart}${host}${portPart}/${dbName}`;
  };

  const handleConnect = async () => {
    setError(null);
    setMetadata(null);
    setIsLoading(true);

    try {
      const url = buildConnectionUrl();
      const diagramJson = await fetchDatabaseMetadata(url);
      setMetadata(diagramJson);
      // Load diagram into editor
      dispatch(loadDiagram({
        id: diagramJson.id || 'external-db-diagram',
        title: 'External DB Class Diagram',
        model: diagramJson,
        lastUpdate: new Date().toISOString(),
      }));
      // Optionally close modal after loading
      onHide();
    } catch (err: any) {
      setError(err.message || 'Failed to connect to the database.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    // Reset state before hiding
    setError(null);
    setMetadata(null);
    onHide();
  };

  const renderParametersForm = () => (
    <>
      <Form.Group className="mb-3">
        <Form.Label>Database Type</Form.Label>
        <Form.Select value={dbType} onChange={(e) => setDbType(e.target.value)}>
          <option value="postgresql">PostgreSQL</option>
          <option value="mysql">MySQL</option>
          <option value="sqlite">SQLite</option>
        </Form.Select>
      </Form.Group>

      {dbType !== 'sqlite' && (
        <>
          <div className="row mb-3">
            <Form.Group className="col-md-8">
              <Form.Label>Host</Form.Label>
              <Form.Control type="text" value={host} onChange={(e) => setHost(e.target.value)} />
            </Form.Group>
            <Form.Group className="col-md-4">
              <Form.Label>Port</Form.Label>
              <Form.Control type="text" value={port} onChange={(e) => setPort(e.target.value)} />
            </Form.Group>
          </div>

          <div className="row mb-3">
            <Form.Group className="col-md-6">
              <Form.Label>Username</Form.Label>
              <Form.Control type="text" value={username} onChange={(e) => setUsername(e.target.value)} />
            </Form.Group>
            <Form.Group className="col-md-6">
              <Form.Label>Password</Form.Label>
              <Form.Control type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </Form.Group>
          </div>
        </>
      )}

      <Form.Group className="mb-3">
        <Form.Label>{dbType === 'sqlite' ? 'File Path (or leave blank for memory)' : 'Database Name'}</Form.Label>
        <Form.Control type="text" value={dbName} onChange={(e) => setDbName(e.target.value)} />
      </Form.Group>
    </>
  );

  return (
    <Modal show={show} onHide={handleClose} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Connect External Database</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {!metadata ? (
          <>
            <Tabs
              activeKey={connectionMethod}
              onSelect={(k) => setConnectionMethod(k as 'parameters' | 'url')}
              className="mb-3"
            >
              <Tab eventKey="parameters" title="Parameters">
                {renderParametersForm()}
              </Tab>
              <Tab eventKey="url" title="Connection URL">
                <Form.Group className="mb-3">
                  <Form.Label>SQLAlchemy Connection URL</Form.Label>
                  <Form.Control
                    type="text"
                    value={connectionUrl}
                    onChange={(e) => setConnectionUrl(e.target.value)}
                    placeholder="postgresql://user:password@localhost:5432/dbname"
                  />
                  <Form.Text className="text-muted">
                    Enter a complete SQLAlchemy connection URL.
                  </Form.Text>
                </Form.Group>
              </Tab>
            </Tabs>

            {error && <Alert variant="danger">{error}</Alert>}
          </>
        ) : (
          <div>
            <Alert variant="success">Successfully connected and loaded class diagram!</Alert>
            <Button variant="outline-secondary" size="sm" onClick={() => setMetadata(null)} className="mb-3">
              Configure different connection
            </Button>
            <div style={{ maxHeight: '400px', overflowY: 'auto', backgroundColor: '#f8f9fa', padding: '15px', borderRadius: '5px' }}>
              <pre style={{ margin: 0 }}><code>{JSON.stringify(metadata, null, 2)}</code></pre>
            </div>
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose}>
          Close
        </Button>
        {!metadata && (
          <Button variant="primary" onClick={handleConnect} disabled={isLoading}>
            {isLoading ? (
              <>
                <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" />
                <span className="ms-2">Connecting...</span>
              </>
            ) : (
              'Connect and Fetch Metadata'
            )}
          </Button>
        )}
      </Modal.Footer>
    </Modal>
  );
};
