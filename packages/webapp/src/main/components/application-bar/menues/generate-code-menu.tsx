import React, { useContext, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Dropdown, NavDropdown, Modal, Form, Button, Alert } from 'react-bootstrap';
import { ApollonEditorContext } from '../../apollon-editor-component/apollon-editor-context';
import { useGenerateCode, DjangoConfig, SQLConfig, SQLAlchemyConfig, JSONSchemaConfig, AgentConfig, QiskitConfig } from '../../../services/generate-code/useGenerateCode';
import posthog from 'posthog-js';
import { useDeployLocally } from '../../../services/generate-code/useDeployLocally';
import { useAppSelector } from '../../store/hooks';
import { toast } from 'react-toastify';
import { BACKEND_URL } from '../../../constant';
import { UMLDiagramType } from '@besser/wme';
import { ProjectStorageRepository } from '../../../services/storage/ProjectStorageRepository';
import { GrapesJSProjectData } from '../../../types/project';

export const GenerateCodeMenu: React.FC = () => {
  // Modal for spoken language selection for agent diagrams
  const [showAgentLanguageModal, setShowAgentLanguageModal] = useState(false);
  const [selectedAgentLanguages, setSelectedAgentLanguages] = useState<string[]>([]);
  const [dropdownLanguage, setDropdownLanguage] = useState<string>('none');
  const [sourceLanguage, setSourceLanguage] = useState<string>('none');
  const [showDjangoConfig, setShowDjangoConfig] = useState(false);
  const [showSqlConfig, setShowSqlConfig] = useState(false);
  const [showSqlAlchemyConfig, setShowSqlAlchemyConfig] = useState(false);
  const [showJsonSchemaConfig, setShowJsonSchemaConfig] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [appName, setAppName] = useState('');
  const [useDocker, setUseDocker] = useState(false);
  const [sqlDialect, setSqlDialect] = useState<'sqlite' | 'postgresql' | 'mysql' | 'mssql' | 'mariadb' | 'oracle'>('sqlite');
  const [sqlAlchemyDbms, setSqlAlchemyDbms] = useState<'sqlite' | 'postgresql' | 'mysql' | 'mssql' | 'mariadb' | 'oracle'>('sqlite');
  const [jsonSchemaMode, setJsonSchemaMode] = useState<'regular' | 'smart_data'>('regular');
  const [loadingAgent, setLoadingAgent] = useState(false);
  const [showQiskitConfig, setShowQiskitConfig] = useState(false);
  const [qiskitBackend, setQiskitBackend] = useState<'aer_simulator' | 'fake_backend' | 'ibm_quantum'>('aer_simulator');
  const [qiskitShots, setQiskitShots] = useState<number>(1024);

  const apollonEditor = useContext(ApollonEditorContext);
  const generateCode = useGenerateCode();
  const deployLocally = useDeployLocally();
  const diagram = useAppSelector((state) => state.diagram.diagram);
  const currentDiagramType = useAppSelector((state) => state.diagram.editorOptions.type);
  const editor = apollonEditor?.editor;

  // Helper to get model size metrics for analytics
 const getModelMetrics = () => {
  if (!diagram?.model) return { elements_count: 0, classes_count: 0, relationships_count: 0, total_size: 0 };
  const model = diagram.model as any;
  
  const allElementsCount = model.elements ? Object.keys(model.elements).length : 0;
  const classesCount = model.elements 
    ? Object.values(model.elements).filter((el: any) => el.type === 'Class').length 
    : 0;
  
  const relationshipsCount = model.relationships ? Object.keys(model.relationships).length : 0;
  
  return { 
    elements_count: allElementsCount,
    classes_count: classesCount,
    relationships_count: relationshipsCount,
    total_size: allElementsCount + relationshipsCount
  };
};

  // Use React Router's useLocation for reliable path detection
  const location = useLocation();
  const isQuantumDiagram = /quantum-editor/.test(location.pathname);
  const isGUINoCodeDiagram = /graphical-ui-editor/.test(location.pathname);

  // Check if we're running locally (not on AWS)
  const isLocalEnvironment = BACKEND_URL === undefined ||
    (BACKEND_URL ?? '').includes('localhost') ||
    (BACKEND_URL ?? '').includes('127.0.0.1');

  const handleGenerateCode = async (generatorType: string) => {
    // For GUI/No-Code diagrams and Quantum diagrams, we don't need the apollon editor
    if (!isGUINoCodeDiagram && !isQuantumDiagram && !editor) {
      toast.error('No diagram available to generate code from');
      return;
    }

    // Special check for web_app generator - verify GUI model has content
    if (generatorType === 'web_app') {
      const project = ProjectStorageRepository.getCurrentProject();
      const guiModel = project?.diagrams?.GUINoCodeDiagram?.model as GrapesJSProjectData | undefined;
      
      // Check if GUI model is empty or has no meaningful content
      // GrapesJS structure: pages[] -> frames[] -> component
      const isEmpty = !guiModel || 
                      !guiModel.pages || 
                      guiModel.pages.length === 0 ||
                      guiModel.pages.every((page: any) => {
                        // Check for new GrapesJS structure with frames
                        if (page.frames && Array.isArray(page.frames)) {
                          return page.frames.every((frame: any) => 
                            !frame || !frame.component || 
                            !frame.component.components || 
                            frame.component.components.length === 0
                          );
                        }
                        // Fallback: check old structure with direct component
                        return !page.component || Object.keys(page.component).length === 0;
                      });
      
      if (isEmpty) {
        toast.error('Cannot generate web application: GUI diagram is empty. Please design your UI first in the Graphical UI Editor.');
        return;
      }
      
      // web_app generator doesn't need the apollon editor - it uses project data
      try {
        await generateCode(null, 'web_app', diagram.title);
        posthog.capture('generator_used', {
          generator_type: 'web_app',
          diagram_type: currentDiagramType,
          ...getModelMetrics()
        });
      } catch (error) {
        console.error('Error in Web App generation:', error);
        toast.error('Web App generation failed. Check console for details.');
      }
      return;
    }

    if (generatorType === 'agent') {
      setShowAgentLanguageModal(true);
      return;
    }

    if (generatorType === 'django') {
      setShowDjangoConfig(true);
      return;
    }

    if (generatorType === 'sql') {
      setShowSqlConfig(true);
      return;
    }

    if (generatorType === 'sqlalchemy') {
      setShowSqlAlchemyConfig(true);
      return;
    }

    if (generatorType === 'jsonschema') {
      setShowJsonSchemaConfig(true);
      return;
    }

    if (generatorType === 'smartdata') {
      try {
        const jsonSchemaConfig: JSONSchemaConfig = {
          mode: 'smart_data'
        };
        if (editor) {
          await generateCode(editor, 'jsonschema', diagram.title, jsonSchemaConfig);
          posthog.capture('generator_used', {
            generator_type: 'smartdata',
            diagram_type: currentDiagramType,
            ...getModelMetrics()
          });
        }
      } catch (error) {
        console.error('Error in Smart Data Models generation:', error);
        toast.error('Smart Data Models generation failed. Check console for details.');
      }
      return;
    }

    try {
      // For quantum diagrams generating qiskit code, show config modal
      if (isQuantumDiagram && generatorType === 'qiskit') {
        setShowQiskitConfig(true);
        return;
      } else if (editor) {
        // Regular UML diagrams use editor
        await generateCode(editor, generatorType, diagram.title);
        posthog.capture('generator_used', {
          generator_type: generatorType,
          diagram_type: currentDiagramType,
          ...getModelMetrics()
        });
      } else {
        toast.error('No diagram available to generate code from');
      }
    } catch (error) {
      console.error('Error in code generation:', error);
      toast.error('Code generation failed. Check console for details.');
    }
  };

  const validateDjangoName = (name: string): boolean => {
    // Django project/app name requirements:
    // - Can't start with a number
    // - Can only contain letters, numbers, and underscores
    const pattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
    return pattern.test(name);
  };

  const handleAgentGenerate = async () => {
    setLoadingAgent(true);
    try {
      // Build base agent config (from localStorage or languages selection)
      let baseConfig: AgentConfig;
      if (selectedAgentLanguages.length === 0) {
        const stored = localStorage.getItem('agentConfig');
        baseConfig = stored ? { ...JSON.parse(stored) } : {};
      } else {
        baseConfig = {
          languages: {
            source: sourceLanguage,
            target: selectedAgentLanguages
          }
        } as any;
      }

      // Send the configuration
      await generateCode(editor!, 'agent', diagram.title, baseConfig as AgentConfig);
      posthog.capture('generator_used', {
        generator_type: 'agent',
        diagram_type: currentDiagramType,
        source_language: sourceLanguage,
        target_languages: selectedAgentLanguages,
        ...getModelMetrics()
      });
      setShowAgentLanguageModal(false);
    } catch (error) {
      console.error('Error in Agent code generation:', error);
      toast.error('Agent code generation failed');
    } finally {
      setLoadingAgent(false);
    }
  };

  const handleDjangoGenerate = async () => {
    if (!projectName || !appName) {
      toast.error('Project and app names are required');
      return;
    }

    if (projectName === appName) {
      toast.error('Project and app names must be different');
      return;
    }

    if (!validateDjangoName(projectName) || !validateDjangoName(appName)) {
      toast.error('Names must start with a letter/underscore and contain only letters, numbers, and underscores');
      return;
    }

    try {
      const djangoConfig: DjangoConfig = {
        project_name: projectName,
        app_name: appName,
        containerization: useDocker
      };
      await generateCode(editor!, 'django', diagram.title, djangoConfig);
      posthog.capture('generator_used', {
        generator_type: 'django',
        diagram_type: currentDiagramType,
        use_docker: useDocker,
        ...getModelMetrics()
      });
      setShowDjangoConfig(false);
    } catch (error) {
      console.error('Error in Django code generation:', error);
      toast.error('Django code generation failed');
    }
  };

  const handleDjangoDeployLocally = async () => {
    if (!projectName || !appName) {
      toast.error('Project and app names are required');
      return;
    }

    if (projectName === appName) {
      toast.error('Project and app names must be different');
      return;
    }

    if (!validateDjangoName(projectName) || !validateDjangoName(appName)) {
      toast.error('Names must start with a letter/underscore and contain only letters, numbers, and underscores');
      return;
    }

    try {
      const djangoConfig: DjangoConfig = {
        project_name: projectName,
        app_name: appName,
        containerization: useDocker
      };
      // Close the modal first, then start deployment
      setShowDjangoConfig(false);
      await deployLocally(editor!, 'django', diagram.title, djangoConfig);
      posthog.capture('generator_used', {
        generator_type: 'django_deploy_locally',
        diagram_type: currentDiagramType,
        use_docker: useDocker,
        ...getModelMetrics()
      });
    } catch (error) {
      console.error('Error in Django local deployment:', error);
      toast.error('Django local deployment failed');
    }
  };

  const handleSqlGenerate = async () => {
    try {
      const sqlConfig: SQLConfig = {
        dialect: sqlDialect
      };
      await generateCode(editor!, 'sql', diagram.title, sqlConfig);
      posthog.capture('generator_used', {
        generator_type: 'sql',
        diagram_type: currentDiagramType,
        sql_dialect: sqlDialect,
        ...getModelMetrics()
      });
      setShowSqlConfig(false);
    } catch (error) {
      console.error('Error in SQL code generation:', error);
      toast.error('SQL code generation failed');
    }
  };

  const handleSqlAlchemyGenerate = async () => {
    try {
      const sqlAlchemyConfig: SQLAlchemyConfig = {
        dbms: sqlAlchemyDbms
      };
      await generateCode(editor!, 'sqlalchemy', diagram.title, sqlAlchemyConfig);
      posthog.capture('generator_used', {
        generator_type: 'sqlalchemy',
        diagram_type: currentDiagramType,
        dbms: sqlAlchemyDbms,
        ...getModelMetrics()
      });
      setShowSqlAlchemyConfig(false);
    } catch (error) {
      console.error('Error in SQLAlchemy code generation:', error);
      toast.error('SQLAlchemy code generation failed');
    }
  };

  const handleJsonSchemaGenerate = async () => {
    try {
      const jsonSchemaConfig: JSONSchemaConfig = {
        mode: jsonSchemaMode
      };
      await generateCode(editor!, 'jsonschema', diagram.title, jsonSchemaConfig);
      posthog.capture('generator_used', {
        generator_type: 'jsonschema',
        diagram_type: currentDiagramType,
        json_schema_mode: jsonSchemaMode,
        ...getModelMetrics()
      });
      setShowJsonSchemaConfig(false);
    } catch (error) {
      console.error('Error in JSON Schema code generation:', error);
      toast.error('JSON Schema code generation failed');
    }
  };

  const handleQiskitGenerate = async () => {
    try {
      const qiskitConfig: QiskitConfig = {
        backend: qiskitBackend,
        shots: qiskitShots
      };
      // Pass null for editor since qiskit generator uses project data
      await generateCode(null, 'qiskit', diagram.title, qiskitConfig);
      posthog.capture('generator_used', {
        generator_type: 'qiskit',
        qiskit_backend: qiskitBackend,
        qiskit_shots: qiskitShots,
        ...getModelMetrics()
      });
      setShowQiskitConfig(false);
    } catch (error) {
      console.error('Error in Qiskit code generation:', error);
      toast.error('Qiskit code generation failed');
    }
  };

  const isAgentDiagram = currentDiagramType === UMLDiagramType.AgentDiagram;

  return (
    <>
      <NavDropdown title="Generate" className="pt-0 pb-0">
        {isQuantumDiagram ? (
          // Quantum Diagram: Show Qiskit generation option
          <>
            <Dropdown.Item onClick={() => handleGenerateCode('qiskit')}>Qiskit Code</Dropdown.Item>
          </>
        ) : isGUINoCodeDiagram ? (
          // No-Code Diagram: Show No-Code generation options
          <>
            <Dropdown.Item onClick={() => handleGenerateCode('web_app')}>Web Application</Dropdown.Item>
          </>
        ) : isAgentDiagram ? (
          // Agent Diagram: Show agent generation option
          <Dropdown.Item onClick={() => handleGenerateCode('agent')}>BESSER Agent</Dropdown.Item>
        ) : currentDiagramType === UMLDiagramType.ClassDiagram ? (
          // ...existing code...
          <>
            {/* Web Dropdown */}
            <Dropdown drop="end">
              <Dropdown.Toggle
                id="dropdown-basic"
                split
                className="bg-transparent w-100 text-start ps-3 d-flex align-items-center"
              >
                <span className="flex-grow-1">Web</span>
              </Dropdown.Toggle>
              <Dropdown.Menu>
                <Dropdown.Item onClick={() => handleGenerateCode('django')}>Django Project</Dropdown.Item>
                <Dropdown.Item onClick={() => handleGenerateCode('backend')}>Full Backend</Dropdown.Item>
                <Dropdown.Item onClick={() => handleGenerateCode('web_app')}>Web Application</Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>

            {/* Database Dropdown */}
            <Dropdown drop="end">
              <Dropdown.Toggle
                id="dropdown-basic"
                split
                className="bg-transparent w-100 text-start ps-3 d-flex align-items-center"
              >
                <span className="flex-grow-1">Database</span>
              </Dropdown.Toggle>
              <Dropdown.Menu>
                <Dropdown.Item onClick={() => handleGenerateCode('sql')}>SQL DDL</Dropdown.Item>
                <Dropdown.Item onClick={() => handleGenerateCode('sqlalchemy')}>SQLAlchemy DDL</Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>

            {/* OOP Dropdown */}
            <Dropdown drop="end">
              <Dropdown.Toggle
                id="dropdown-basic"
                split
                className="bg-transparent w-100 text-start ps-3 d-flex align-items-center"
              >
                <span className="flex-grow-1">OOP</span>
              </Dropdown.Toggle>
              <Dropdown.Menu>
                <Dropdown.Item onClick={() => handleGenerateCode('python')}>Python Classes</Dropdown.Item>
                <Dropdown.Item onClick={() => handleGenerateCode('java')}>Java Classes</Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>

            {/* Schema Dropdown */}
            <Dropdown drop="end">
              <Dropdown.Toggle
                id="dropdown-basic"
                split
                className="bg-transparent w-100 text-start ps-3 d-flex align-items-center"
              >
                <span className="flex-grow-1">Schema</span>
              </Dropdown.Toggle>
              <Dropdown.Menu>
                <Dropdown.Item onClick={() => handleGenerateCode('pydantic')}>Pydantic Models</Dropdown.Item>
                <Dropdown.Item onClick={() => handleGenerateCode('jsonschema')}>JSON Schema</Dropdown.Item>
                <Dropdown.Item onClick={() => handleGenerateCode('smartdata')}>Smart Data Models</Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
          </>
        ) : (
          // Not yet available
          <Dropdown.Item disabled>Not yet available</Dropdown.Item>
        )}
      </NavDropdown>

      {/* Agent Language Selection Modal (dropdown + removable list) */}
      <Modal show={showAgentLanguageModal} onHide={() => setShowAgentLanguageModal(false)}>
        {loadingAgent && (
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(255,255,255,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}>
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        )}
        <Modal.Header closeButton>
          <Modal.Title>Select Agent Languages</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Source language (optional)</Form.Label>
              <Form.Select
                value={sourceLanguage}
                onChange={e => setSourceLanguage(e.target.value)}
              >
                <option value="none">Select language...</option>
                <option value="english">English</option>
                <option value="french">French</option>
                <option value="german">German</option>
                <option value="luxembourgish">Luxembourgish</option>
                <option value="portuguese">Portuguese</option>
                <option value="spanish">Spanish</option>
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Add spoken language for agent translation</Form.Label>
              <Form.Select
                value={dropdownLanguage}
                onChange={(e) => setDropdownLanguage(e.target.value)}
              >
                <option value="none">Select language...</option>
                <option value="english">English</option>
                <option value="french">French</option>
                <option value="german">German</option>
                <option value="luxembourgish">Luxembourgish</option>
                <option value="portuguese">Portuguese</option>
                <option value="spanish">Spanish</option>
              </Form.Select>
              <Button
                className="mt-2"
                variant="primary"
                disabled={dropdownLanguage === 'none' || selectedAgentLanguages.includes(dropdownLanguage)}
                onClick={() => {
                  if (dropdownLanguage !== 'none' && !selectedAgentLanguages.includes(dropdownLanguage)) {
                    setSelectedAgentLanguages([...selectedAgentLanguages, dropdownLanguage]);
                    setDropdownLanguage('none');
                  }
                }}
              >
                Add Language
              </Button>
              <Form.Text className="text-muted d-block mt-2">
                The agent will be translated to all selected spoken languages.
              </Form.Text>
              <div className="text-warning small mt-1">
                <span role="img" aria-label="warning">⚠️</span> Adding more languages will increase the generation time.
              </div>
            </Form.Group>
            {/* List of selected languages with remove option */}
            {selectedAgentLanguages.length > 0 && (
              <div className="mb-3">
                <strong>Selected Languages:</strong>
                <ul className="list-unstyled mt-2">
                  {selectedAgentLanguages.map(lang => (
                    <li key={lang} className="d-flex align-items-center mb-1">
                      <span className="me-2">{lang.charAt(0).toUpperCase() + lang.slice(1)}</span>
                      <Button
                        variant="outline-danger"
                        size="sm"
                        onClick={() => setSelectedAgentLanguages(selectedAgentLanguages.filter(l => l !== lang))}
                      >
                        Remove
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowAgentLanguageModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleAgentGenerate}>
            Generate
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Django Configuration Modal */}
      <Modal show={showDjangoConfig} onHide={() => setShowDjangoConfig(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Django Project Configuration</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Project Name</Form.Label>
              <Form.Control
                type="text"
                placeholder="my_django_project"
                value={projectName}
                onChange={(e) => {
                  const value = e.target.value.replace(/\s/g, '_');
                  if (value === '' || validateDjangoName(value)) {
                    setProjectName(value);
                  }
                }}
                isInvalid={projectName !== '' && !validateDjangoName(projectName)}
              />
              <Form.Text className="text-muted">
                Must start with a letter/underscore and contain only letters, numbers, and underscores
              </Form.Text>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>App Name</Form.Label>
              <Form.Control
                type="text"
                placeholder="my_app"
                value={appName}
                onChange={(e) => {
                  const value = e.target.value.replace(/\s/g, '_');
                  if (value === '' || validateDjangoName(value)) {
                    setAppName(value);
                  }
                }}
                isInvalid={appName !== '' && !validateDjangoName(appName)}
              />
              <Form.Text className="text-muted">
                Must start with a letter/underscore and contain only letters, numbers, and underscores
              </Form.Text>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Check
                type="checkbox"
                label="Include Docker containerization"
                checked={useDocker}
                onChange={(e) => setUseDocker(e.target.checked)}
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDjangoConfig(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleDjangoGenerate}>
            Generate
          </Button>
          {isLocalEnvironment && (
            <Button variant="success" onClick={handleDjangoDeployLocally}>
              Deploy
            </Button>
          )}
        </Modal.Footer>
      </Modal>

      {/* SQL Configuration Modal */}
      <Modal show={showSqlConfig} onHide={() => setShowSqlConfig(false)}>
        <Modal.Header closeButton>
          <Modal.Title>SQL Dialect Selection</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Select SQL Dialect</Form.Label>
              <Form.Select
                value={sqlDialect}
                onChange={(e) => setSqlDialect(e.target.value as 'sqlite' | 'postgresql' | 'mysql' | 'mssql' | 'mariadb' | 'oracle')}
              >
                <option value="sqlite">SQLite</option>
                <option value="postgresql">PostgreSQL</option>
                <option value="mysql">MySQL</option>
                <option value="mssql">MS SQL Server</option>
                <option value="mariadb">MariaDB</option>;
                <option value="oracle">Oracle</option>
              </Form.Select>
              <Form.Text className="text-muted">
                Choose the SQL dialect for your generated DDL statements
              </Form.Text>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowSqlConfig(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSqlGenerate}>
            Generate
          </Button>
        </Modal.Footer>
      </Modal>

      {/* SQLAlchemy Configuration Modal */}
      <Modal show={showSqlAlchemyConfig} onHide={() => setShowSqlAlchemyConfig(false)}>
        <Modal.Header closeButton>
          <Modal.Title>SQLAlchemy DBMS Selection</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Select Database System</Form.Label>
              <Form.Select
                value={sqlAlchemyDbms}
                onChange={(e) => setSqlAlchemyDbms(e.target.value as 'sqlite' | 'postgresql' | 'mysql' | 'mssql' | 'mariadb')}
              >
                <option value="sqlite">SQLite</option>
                <option value="postgresql">PostgreSQL</option>
                <option value="mysql">MySQL</option>
                <option value="mssql">MS SQL Server</option>
                <option value="mariadb">MariaDB</option>
              </Form.Select>
              <Form.Text className="text-muted">
                Choose the database system for your generated SQLAlchemy code
              </Form.Text>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowSqlAlchemyConfig(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSqlAlchemyGenerate}>
            Generate
          </Button>
        </Modal.Footer>
      </Modal>

      {/* JSON Schema Configuration Modal */}
      <Modal show={showJsonSchemaConfig} onHide={() => setShowJsonSchemaConfig(false)}>
        <Modal.Header closeButton>
          <Modal.Title>JSON Schema Mode Selection</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Schema Generation Mode</Form.Label>
              <Form.Select
                value={jsonSchemaMode}
                onChange={(e) => setJsonSchemaMode(e.target.value as 'regular' | 'smart_data')}
              >
                <option value="regular">Regular JSON Schema</option>
                <option value="smart_data">Smart Data Models</option>
              </Form.Select>
              <Form.Text className="text-muted">
                Regular mode generates a standard JSON schema.
                Smart Data mode generates NGSI-LD compatible schemas for each class.
              </Form.Text>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowJsonSchemaConfig(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleJsonSchemaGenerate}>
            Generate
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Qiskit Configuration Modal */}
      <Modal show={showQiskitConfig} onHide={() => setShowQiskitConfig(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Qiskit Backend Configuration</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Execution Backend</Form.Label>
              <Form.Select
                value={qiskitBackend}
                onChange={(e) => setQiskitBackend(e.target.value as 'aer_simulator' | 'fake_backend' | 'ibm_quantum')}
              >
                <option value="aer_simulator">Aer Simulator (Local)</option>
                <option value="fake_backend">Moke Simulation (Noise Simulation)</option>
                <option value="ibm_quantum">IBM Quantum (Real Hardware)</option>
              </Form.Select>
              <Form.Text className="text-muted">
                {qiskitBackend === 'aer_simulator' && 'Fast local simulation without noise characteristics.'}
                {qiskitBackend === 'fake_backend' && 'Simulates noise characteristics of real IBM quantum hardware.'}
                {qiskitBackend === 'ibm_quantum' && 'Run on real IBM Quantum hardware. Requires IBM Quantum account.'}
              </Form.Text>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Number of Shots</Form.Label>
              <Form.Control
                type="number"
                value={qiskitShots}
                onChange={(e) => setQiskitShots(Math.max(1, parseInt(e.target.value) || 1024))}
                min={1}
                max={100000}
              />
              <Form.Text className="text-muted">
                Number of times to execute the circuit (1 - 100,000)
              </Form.Text>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowQiskitConfig(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleQiskitGenerate}>
            Generate
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};