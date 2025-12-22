import React, { useEffect, useState } from 'react';
import { Card, Form, Button, Row, Col, InputGroup } from 'react-bootstrap';
import styled from 'styled-components';
import jsonSchema from './json_schema.json';

const PageContainer = styled.div`
  padding: 40px 20px;
  min-height: calc(100vh - 60px);
  background-color: var(--apollon-background);
  display: flex;
  justify-content: center;
  align-items: flex-start;
`;

const AgentCard = styled(Card)`
  width: 100%;
  max-width: 900px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  border: 1px solid var(--apollon-switch-box-border-color);
  border-radius: 16px;
  overflow: hidden;
  background-color: var(--apollon-background);
`;

const CardHeader = styled(Card.Header)`
  background: var(--apollon-primary);
  color: var(--apollon-primary-contrast);
  border: none;
  padding: 24px 32px;
  h3 {
    margin: 0;
    font-weight: 600;
    font-size: 1.5rem;
    color: var(--apollon-primary-contrast);
  }
`;

const CardBody = styled(Card.Body)`
  padding: 24px;
  background-color: var(--apollon-background);
  color: var(--apollon-primary-contrast);
`;

type Operator = 'is' | 'contains' | '<' | '<=' | '>' | '>=' | 'between';

type Rule = {
  id: string;
  feature: string;
  operator: Operator;
  value: string | number | Array<string | number>;
  target: 'agentLanguage' | 'agentStyle' | 'agentLanguageComplexity';
  targetValue: string;
};

type Mapping = {
  feature: string;
  rules: Rule[];
};

const STORAGE_KEY = 'agentPersonalization';

export const AgentPersonalizationConfigScreen: React.FC = () => {
  // Derive top-level User properties from schema (Personal_Information_end, Accessibility_end etc.)
  const schema = (jsonSchema as any).definitions || (jsonSchema as any).properties || jsonSchema;

  // Flatten: collect fields under Personal_Information and User->Personal_Information_end
  const userProps: { name: string; type: string; enum?: string[] }[] = [];

  try {
    const defs = (jsonSchema as any).definitions || {};
    const personal = defs?.Personal_Information?.allOf?.[0]?.properties || (jsonSchema as any).properties?.Personal_Information?.allOf?.[0]?.properties;
    if (personal) {
      for (const k of Object.keys(personal)) {
        const prop = personal[k];
        if (prop && prop.$ref) {
          // attempt to resolve enum ref
          const refName = prop.$ref.replace('#/definitions/', '');
          const ref = defs?.[refName];
          if (ref && ref.enum) {
            userProps.push({ name: k, type: 'string', enum: ref.enum });
          } else {
            userProps.push({ name: k, type: 'string' });
          }
        } else if (prop && prop.type) {
          const t = prop.type;
          userProps.push({ name: k, type: t, enum: prop.enum });
        } else {
          userProps.push({ name: k, type: 'string' });
        }
      }
    }
  } catch (e) {
    console.warn('Failed to parse json_schema', e);
  }

  // defaults
  const [mappings, setMappings] = useState<Mapping[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return JSON.parse(stored) as Mapping[];
    } catch {}
    // initialize mapping entries for each user prop
    return userProps.map(p => ({ feature: p.name, rules: [] }));
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mappings));
  }, [mappings]);

  function addRule(feature: string) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const prop = userProps.find(p => p.name === feature);
    const operator: Operator = prop?.type === 'integer' ? '<' : 'is';
    const newRule: Rule = { id, feature, operator, value: '', target: 'agentStyle', targetValue: 'original' };
    setMappings(prev => prev.map(m => m.feature === feature ? { ...m, rules: [...m.rules, newRule] } : m));
  }

  function updateRule(feature: string, ruleId: string, patch: Partial<Rule>) {
    setMappings(prev => prev.map(m => m.feature === feature ? { ...m, rules: m.rules.map(r => r.id === ruleId ? { ...r, ...patch } : r) } : m));
  }

  function removeRule(feature: string, ruleId: string) {
    setMappings(prev => prev.map(m => m.feature === feature ? { ...m, rules: m.rules.filter(r => r.id !== ruleId) } : m));
  }

  function handleDownload() {
    const blob = new Blob([JSON.stringify(mappings, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'agent_personalization.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string) as Mapping[];
        setMappings(data);
        alert('Personalization mapping loaded');
      } catch (err) {
        alert('Invalid file');
      }
    };
    reader.readAsText(file);
  }

  const languageOptions = ['original','english','french','german','spanish','luxembourgish','portuguese'];
  const styleOptions = ['original','formal','informal'];
  const complexityOptions = ['original', 'simple', 'medium', 'complex'];

  return (
    <PageContainer>
      <AgentCard>
        <CardHeader>
          <h3>Agent Personalization</h3>
        </CardHeader>
        <CardBody>
          <p>Define rules that map user attributes to agent configuration. For each user feature you may add rules that set an agent feature when the rule matches.</p>

          <Row className="mb-3">
            <Col>
              <Form.Label>Features</Form.Label>
              <div className="text-muted">Add rules directly in each feature row below.</div>
            </Col>
            <Col className="d-flex align-items-end justify-content-end gap-2">
              <Button variant="outline-secondary" onClick={handleDownload}>Download Mapping</Button>
              <label className="btn btn-outline-secondary mb-0">
                Upload Mapping
                <input type="file" accept="application/json" style={{ display: 'none' }} onChange={handleUpload} />
              </label>
            </Col>
          </Row>

          {mappings.map(map => (
            <Card key={map.feature} className="mb-3">
                <Card.Header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div><b>{map.feature}</b></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Button variant="success" size="sm" onClick={() => addRule(map.feature)}>Add rule</Button>
                    <div>{map.rules.length} rule(s)</div>
                  </div>
                </Card.Header>
              <Card.Body>
                {map.rules.length === 0 && <div className="text-muted">No rules defined for this feature.</div>}
                {map.rules.map(rule => {
                  const prop = userProps.find(p => p.name === map.feature);
                  const isNumeric = prop?.type === 'integer' || prop?.type === 'number';
                  const isEnum = !!prop?.enum;
                  return (
                    <div key={rule.id} className="mb-3 p-2" style={{ border: '1px dashed var(--apollon-switch-box-border-color)', borderRadius: 6 }}>
                      <Row className="align-items-center">
                        <Col md={3}>
                          <Form.Control as="select" value={rule.operator} onChange={e => updateRule(map.feature, rule.id, { operator: e.target.value as Operator })}>
                            {isNumeric ? (
                              <>
                                <option value="<">&lt;</option>
                                <option value=">">&gt;</option>
                                <option value="<=">&le;</option>
                                <option value=">=">&ge;</option>
                                <option value="between">between</option>
                                <option value="is">is</option>
                              </>
                            ) : (
                              <>
                                <option value="is">is</option>
                                <option value="contains">contains</option>
                              </>
                            )}
                          </Form.Control>
                        </Col>
                        <Col md={3}>
                          {!isEnum && (
                            <>
                              {isNumeric && rule.operator === 'between' ? (
                                <InputGroup>
                                  <Form.Control type="number" value={Array.isArray(rule.value) ? String(rule.value[0] ?? '') : ''} onChange={e => {
                                    const hi = Array.isArray(rule.value) ? [...rule.value] as any[] : [null, null];
                                    hi[0] = e.target.value === '' ? '' : Number(e.target.value);
                                    updateRule(map.feature, rule.id, { value: hi as any });
                                  }} placeholder="min" />
                                  <Form.Control type="number" value={Array.isArray(rule.value) ? String(rule.value[1] ?? '') : ''} onChange={e => {
                                    const hi = Array.isArray(rule.value) ? [...rule.value] as any[] : [null, null];
                                    hi[1] = e.target.value === '' ? '' : Number(e.target.value);
                                    updateRule(map.feature, rule.id, { value: hi as any });
                                  }} placeholder="max" />
                                </InputGroup>
                              ) : (
                                <Form.Control type={isNumeric ? 'number' : 'text'} value={Array.isArray(rule.value) ? String(rule.value[0] ?? '') : String(rule.value ?? '')} onChange={e => updateRule(map.feature, rule.id, { value: isNumeric ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value })} />
                              )}
                            </>
                          )}
                          {isEnum && (
                            <Form.Select multiple value={Array.isArray(rule.value) ? rule.value.map(String) : (rule.value ? [String(rule.value)] : [])} onChange={e => {
                              const opts = Array.from(e.target.selectedOptions).map(o => o.value);
                              updateRule(map.feature, rule.id, { value: opts });
                            }}>
                              {prop!.enum!.map(ev => <option key={ev} value={ev}>{ev}</option>)}
                            </Form.Select>
                          )}
                        </Col>
                        <Col md={3}>
                          <Form.Select value={rule.target} onChange={e => updateRule(map.feature, rule.id, { target: e.target.value as Rule['target'] })}>
                            <option value="agentStyle">Agent Style</option>
                            <option value="agentLanguage">Agent Language</option>
                            <option value="agentLanguageComplexity">Agent Language Complexity</option>
                          </Form.Select>
                        </Col>
                        <Col md={2}>
                          {rule.target === 'agentLanguage' ? (
                            <Form.Select value={rule.targetValue} onChange={e => updateRule(map.feature, rule.id, { targetValue: e.target.value })}>
                              {languageOptions.map(lo => <option key={lo} value={lo}>{lo}</option>)}
                            </Form.Select>
                          ) : rule.target === 'agentLanguageComplexity' ? (
                            <Form.Select value={rule.targetValue} onChange={e => updateRule(map.feature, rule.id, { targetValue: e.target.value })}>
                              {complexityOptions.map(co => <option key={co} value={co}>{co}</option>)}
                            </Form.Select>
                          ) : (
                            <Form.Select value={rule.targetValue} onChange={e => updateRule(map.feature, rule.id, { targetValue: e.target.value })}>
                              {styleOptions.map(s => <option key={s} value={s}>{s}</option>)}
                            </Form.Select>
                          )}
                        </Col>
                        <Col md={1} className="text-end">
                          <Button variant="danger" size="sm" onClick={() => removeRule(map.feature, rule.id)}>Remove</Button>
                        </Col>
                      </Row>
                    </div>
                  );
                })}
              </Card.Body>
            </Card>
          ))}

          <div className="d-flex justify-content-end gap-3 mt-3">
            <Button variant="primary" onClick={() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(mappings)); alert('Saved'); }}>Save</Button>
            <Button variant="outline-secondary" onClick={() => { localStorage.removeItem(STORAGE_KEY); setMappings(userProps.map(p => ({ feature: p.name, rules: [] }))); }}>Reset</Button>
          </div>
        </CardBody>
      </AgentCard>
    </PageContainer>
  );
};

export default AgentPersonalizationConfigScreen;
