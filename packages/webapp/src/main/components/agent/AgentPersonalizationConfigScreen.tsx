import React, { useEffect, useState } from 'react';
import { Card, Form, Button, Row, Col, InputGroup } from 'react-bootstrap';
import styled from 'styled-components';
import jsonSchema from './json_schema.json';

const PageContainer = styled.div`
  padding: 32px 40px;
  min-height: calc(100vh - 60px);
  background-color: var(--apollon-background);
  display: flex;
  flex-direction: column;
  width: 100%;
  overflow-y: auto;
`;

const PageHeader = styled.div`
  margin-bottom: 32px;
  h1 {
    margin: 0 0 8px 0;
    font-weight: 700;
    font-size: 2rem;
    color: var(--apollon-primary-contrast);
    display: flex;
    align-items: center;
    gap: 12px;
  }
  p {
    margin: 0;
    color: var(--apollon-secondary);
    font-size: 1rem;
  }
`;

const Section = styled.div`
  background: var(--apollon-background);
  border: 1px solid var(--apollon-switch-box-border-color);
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 24px;
  transition: box-shadow 0.2s ease;
  
  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  }
`;

const SectionHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
`;

const SectionTitle = styled.h5`
  color: var(--apollon-primary-contrast);
  margin: 0;
  font-weight: 600;
  font-size: 1.1rem;
  display: flex;
  align-items: center;
  gap: 8px;
  
  &::before {
    content: '';
    width: 4px;
    height: 20px;
    background: var(--apollon-primary);
    border-radius: 2px;
  }
`;

const RuleCard = styled.div`
  background: var(--apollon-background-variant, #f8f9fa);
  border: 1px solid var(--apollon-switch-box-border-color);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
`;

const AgentCard = styled.div`
  width: 100%;
  background-color: var(--apollon-background);
`;

const CardHeader = styled.div`
  display: none;
`;

const CardBody = styled.div`
  padding: 0;
  background-color: var(--apollon-background);
  color: var(--apollon-primary-contrast);
`;

const ActionBar = styled.div`
  display: flex;
  gap: 12px;
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px solid var(--apollon-switch-box-border-color);
  flex-wrap: wrap;
`;

const StyledButton = styled(Button)`
  padding: 10px 24px;
  font-weight: 500;
  border-radius: 8px;
  transition: all 0.2s ease;
  
  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 32px;
  color: var(--apollon-secondary);
  font-style: italic;
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
      <PageHeader>
        <h1>🎯 Agent Personalization</h1>
        <p>Define rules that map user attributes to agent configuration settings</p>
      </PageHeader>
      
      <Section>
        <SectionHeader>
          <SectionTitle>Personalization Rules</SectionTitle>
          <div className="d-flex gap-2">
            <Button variant="outline-secondary" onClick={handleDownload} style={{ borderRadius: '8px' }}>Download Mapping</Button>
            <label className="btn btn-outline-secondary mb-0" style={{ borderRadius: '8px' }}>
              Upload Mapping
              <input type="file" accept="application/json" style={{ display: 'none' }} onChange={handleUpload} />
            </label>
          </div>
        </SectionHeader>
        
        <p className="text-muted mb-4">For each user feature, add rules that configure the agent when the rule matches.</p>

        {mappings.length === 0 && (
          <EmptyState>No user features found in the schema.</EmptyState>
        )}

        {mappings.map(map => (
          <Section key={map.feature} style={{ marginBottom: '16px', background: 'var(--apollon-background-variant, #f8f9fa)' }}>
            <SectionHeader>
              <SectionTitle style={{ fontSize: '1rem' }}>{map.feature}</SectionTitle>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="text-muted">{map.rules.length} rule(s)</span>
                <Button variant="success" size="sm" onClick={() => addRule(map.feature)} style={{ borderRadius: '6px' }}>
                  + Add Rule
                </Button>
              </div>
            </SectionHeader>
                {map.rules.length === 0 && <EmptyState>No rules defined for this feature.</EmptyState>}
                {map.rules.map(rule => {
                  const prop = userProps.find(p => p.name === map.feature);
                  const isNumeric = prop?.type === 'integer' || prop?.type === 'number';
                  const isEnum = !!prop?.enum;
                  return (
                    <RuleCard key={rule.id}>
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
                          <Button variant="danger" size="sm" onClick={() => removeRule(map.feature, rule.id)} style={{ borderRadius: '6px' }}>Remove</Button>
                        </Col>
                      </Row>
                    </RuleCard>
                  );
                })}
                
                {map.rules.length === 0 && (
                  <EmptyState>No rules defined for this feature. Click "+ Add Rule" to create one.</EmptyState>
                )}
          </Section>
          ))}
      </Section>

      <ActionBar>
        <StyledButton variant="primary" onClick={() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(mappings)); alert('Saved'); }}>
          Save All Rules
        </StyledButton>
        <StyledButton variant="outline-secondary" onClick={() => { localStorage.removeItem(STORAGE_KEY); setMappings(userProps.map(p => ({ feature: p.name, rules: [] }))); }}>
          Reset All
        </StyledButton>
      </ActionBar>
    </PageContainer>
  );
};

export default AgentPersonalizationConfigScreen;
