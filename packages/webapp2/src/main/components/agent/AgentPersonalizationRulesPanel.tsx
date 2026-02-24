import React, { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import jsonSchema from './json_schema.json';

type Operator = 'is' | 'contains' | '<' | '<=' | '>' | '>=' | 'between';
type TargetField = 'agentLanguage' | 'agentStyle' | 'agentLanguageComplexity';
type RuleValue = string | number | Array<string | number>;

type Rule = {
  id: string;
  feature: string;
  operator: Operator;
  value: RuleValue;
  target: TargetField;
  targetValue: string;
};

type MappingEntry = {
  feature: string;
  rules: Rule[];
};

type UserProperty = {
  name: string;
  type: string;
  enumValues?: string[];
};

const STORAGE_KEY = 'agentPersonalization';

const createRuleId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

const parseSchemaUserProperties = (): UserProperty[] => {
  const schema = jsonSchema as any;
  const definitions = schema?.definitions || {};
  const personalInfo =
    definitions?.Personal_Information?.allOf?.[0]?.properties
    || schema?.properties?.Personal_Information?.allOf?.[0]?.properties
    || {};

  return Object.entries(personalInfo).map(([name, rawValue]) => {
    const property = rawValue as any;

    if (property?.$ref && typeof property.$ref === 'string') {
      const refName = property.$ref.replace('#/definitions/', '');
      const refDefinition = definitions?.[refName];
      if (refDefinition?.enum && Array.isArray(refDefinition.enum)) {
        return { name, type: 'string', enumValues: refDefinition.enum as string[] };
      }
      return { name, type: 'string' };
    }

    return {
      name,
      type: typeof property?.type === 'string' ? property.type : 'string',
      enumValues: Array.isArray(property?.enum) ? (property.enum as string[]) : undefined,
    };
  });
};

const normalizeMappings = (properties: UserProperty[], mappings: MappingEntry[]): MappingEntry[] => {
  const byFeature = new Map(mappings.map((entry) => [entry.feature, entry]));
  return properties.map((property) => byFeature.get(property.name) || { feature: property.name, rules: [] });
};

export const AgentPersonalizationRulesPanel: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const userProperties = useMemo(() => parseSchemaUserProperties(), []);
  const [mappings, setMappings] = useState<MappingEntry[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as MappingEntry[];
        return normalizeMappings(userProperties, parsed);
      }
    } catch (error) {
      console.warn('Failed to parse saved personalization rules:', error);
    }
    return userProperties.map((property) => ({ feature: property.name, rules: [] }));
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mappings));
  }, [mappings]);

  const addRule = (feature: string) => {
    const property = userProperties.find((entry) => entry.name === feature);
    const operator: Operator = property?.type === 'integer' || property?.type === 'number' ? '<' : 'is';
    const newRule: Rule = {
      id: createRuleId(),
      feature,
      operator,
      value: '',
      target: 'agentStyle',
      targetValue: 'original',
    };

    setMappings((previous) =>
      previous.map((entry) => (entry.feature === feature ? { ...entry, rules: [...entry.rules, newRule] } : entry)),
    );
  };

  const updateRule = (feature: string, ruleId: string, patch: Partial<Rule>) => {
    setMappings((previous) =>
      previous.map((entry) =>
        entry.feature === feature
          ? {
            ...entry,
            rules: entry.rules.map((rule) => (rule.id === ruleId ? { ...rule, ...patch } : rule)),
          }
          : entry,
      ),
    );
  };

  const removeRule = (feature: string, ruleId: string) => {
    setMappings((previous) =>
      previous.map((entry) =>
        entry.feature === feature
          ? { ...entry, rules: entry.rules.filter((rule) => rule.id !== ruleId) }
          : entry,
      ),
    );
  };

  const handleReset = () => {
    const resetEntries = userProperties.map((property) => ({ feature: property.name, rules: [] }));
    setMappings(resetEntries);
    localStorage.removeItem(STORAGE_KEY);
    toast.success('Personalization rules reset.');
  };

  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(mappings, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'agent_personalization.json';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const handleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || '[]')) as MappingEntry[];
        setMappings(normalizeMappings(userProperties, parsed));
        toast.success('Personalization rules loaded.');
      } catch {
        toast.error('Invalid personalization file.');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const languageOptions = ['original', 'english', 'french', 'german', 'spanish', 'luxembourgish', 'portuguese'];
  const styleOptions = ['original', 'formal', 'informal'];
  const complexityOptions = ['original', 'simple', 'medium', 'complex'];

  return (
    <div className="h-full overflow-auto px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Agent Personalization Rules</CardTitle>
            <CardDescription>
              Define rules that map user profile attributes to agent behavior settings.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleDownload} variant="outline">
                Download Rules
              </Button>
              <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                Upload Rules
              </Button>
              <Button variant="outline" onClick={() => toast.success('Rules are auto-saved in localStorage.')}>
                Save Rules
              </Button>
              <Button variant="destructive" onClick={handleReset}>
                Reset
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={handleUpload}
              />
            </div>

            <Separator />

            <div className="space-y-4">
              {mappings.map((entry) => {
                const property = userProperties.find((item) => item.name === entry.feature);
                const isNumeric = property?.type === 'integer' || property?.type === 'number';
                const enumValues = property?.enumValues || [];

                return (
                  <div key={entry.feature} className="rounded-lg border border-border/70 p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">{entry.feature}</p>
                        <p className="text-xs text-muted-foreground">{entry.rules.length} rule(s)</p>
                      </div>
                      <Button variant="outline" onClick={() => addRule(entry.feature)}>
                        Add Rule
                      </Button>
                    </div>

                    {entry.rules.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No rules defined for this attribute.</p>
                    ) : (
                      <div className="space-y-3">
                        {entry.rules.map((rule) => (
                          <div key={rule.id} className="grid gap-3 rounded-md border border-border/60 p-3 md:grid-cols-5">
                            <div className="space-y-1.5">
                              <Label>Operator</Label>
                              <select
                                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={rule.operator}
                                onChange={(event) => updateRule(entry.feature, rule.id, { operator: event.target.value as Operator })}
                              >
                                {isNumeric ? (
                                  <>
                                    <option value="<">&lt;</option>
                                    <option value="<=">&le;</option>
                                    <option value=">">&gt;</option>
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
                              </select>
                            </div>

                            <div className="space-y-1.5">
                              <Label>Value</Label>
                              {rule.operator === 'between' && isNumeric ? (
                                <div className="grid grid-cols-2 gap-2">
                                  <Input
                                    type="number"
                                    placeholder="min"
                                    value={Array.isArray(rule.value) ? String(rule.value[0] ?? '') : ''}
                                    onChange={(event) => {
                                      const values = Array.isArray(rule.value) ? [...rule.value] : ['', ''];
                                      values[0] = event.target.value === '' ? '' : Number(event.target.value);
                                      updateRule(entry.feature, rule.id, { value: values });
                                    }}
                                  />
                                  <Input
                                    type="number"
                                    placeholder="max"
                                    value={Array.isArray(rule.value) ? String(rule.value[1] ?? '') : ''}
                                    onChange={(event) => {
                                      const values = Array.isArray(rule.value) ? [...rule.value] : ['', ''];
                                      values[1] = event.target.value === '' ? '' : Number(event.target.value);
                                      updateRule(entry.feature, rule.id, { value: values });
                                    }}
                                  />
                                </div>
                              ) : enumValues.length > 0 ? (
                                <select
                                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                  value={Array.isArray(rule.value) ? String(rule.value[0] || '') : String(rule.value || '')}
                                  onChange={(event) => updateRule(entry.feature, rule.id, { value: event.target.value })}
                                >
                                  <option value="">Select value</option>
                                  {enumValues.map((value) => (
                                    <option key={value} value={value}>
                                      {value}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <Input
                                  type={isNumeric ? 'number' : 'text'}
                                  value={Array.isArray(rule.value) ? String(rule.value[0] || '') : String(rule.value || '')}
                                  onChange={(event) =>
                                    updateRule(entry.feature, rule.id, {
                                      value: isNumeric
                                        ? (event.target.value === '' ? '' : Number(event.target.value))
                                        : event.target.value,
                                    })
                                  }
                                />
                              )}
                            </div>

                            <div className="space-y-1.5">
                              <Label>Target</Label>
                              <select
                                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={rule.target}
                                onChange={(event) => updateRule(entry.feature, rule.id, { target: event.target.value as TargetField })}
                              >
                                <option value="agentStyle">Agent Style</option>
                                <option value="agentLanguage">Agent Language</option>
                                <option value="agentLanguageComplexity">Language Complexity</option>
                              </select>
                            </div>

                            <div className="space-y-1.5">
                              <Label>Target Value</Label>
                              <select
                                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={rule.targetValue}
                                onChange={(event) => updateRule(entry.feature, rule.id, { targetValue: event.target.value })}
                              >
                                {(rule.target === 'agentLanguage'
                                  ? languageOptions
                                  : rule.target === 'agentLanguageComplexity'
                                    ? complexityOptions
                                    : styleOptions).map((value) => (
                                      <option key={value} value={value}>
                                        {value}
                                      </option>
                                    ))}
                              </select>
                            </div>

                            <div className="flex items-end">
                              <Button variant="outline" onClick={() => removeRule(entry.feature, rule.id)}>
                                Remove
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
