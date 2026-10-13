export interface AgentConfigFormData {
  agent: { check_transitions_delay: string };
  nlp: {
    language: string;
    region: string;
    timezone: string;
    pre_processing: boolean;
    intent_threshold: string;
    huggingface_token: string;
    openai_api_key: string;
    replicate_api_key: string;
  };
  platforms: {
    websocket: {
      enabled: boolean;
      host: string;
      port: string;
      streamlit_host: string;
      streamlit_port: string;
      chat_size: string;
      chat_font: string;
      chat_line_spacing: string;
      chat_alignment: string;
      chat_color: string;
      chat_contrast: string;
    };
    telegram: { enabled: boolean; token: string };
    github: { enabled: boolean; personal_token: string; webhook_token: string; webhook_port: string };
    gitlab: { enabled: boolean; personal_token: string; webhook_token: string; webhook_port: string };
    a2a: { enabled: boolean; port: string };
  };
  db: {
    monitoring: { enabled: boolean; dialect: string; host: string; port: string; database: string; username: string; password: string };
    streamlit_db: { enabled: boolean; dialect: string; host: string; port: string; database: string; username: string; password: string };
  };
}

function yamlValue(v: string): string {
  const t = v.trim();
  if (t === '') return "''";
  if (!isNaN(Number(t))) return t;
  if (/^[A-Za-z0-9][A-Za-z0-9_.\-/]*$/.test(t)) return t;
  return `'${t.replace(/'/g, "''")}'`;
}

export function agentConfigFormToYaml(form: AgentConfigFormData): string {
  const lines: string[] = [];

  lines.push('agent:');
  if (form.agent.check_transitions_delay.trim())
    lines.push(`  check_transitions_delay: ${yamlValue(form.agent.check_transitions_delay)}`);
  lines.push('');

  lines.push('nlp:');
  if (form.nlp.language) lines.push(`  language: ${yamlValue(form.nlp.language)}`);
  if (form.nlp.region) lines.push(`  region: ${yamlValue(form.nlp.region)}`);
  if (form.nlp.timezone) lines.push(`  timezone: ${yamlValue(form.nlp.timezone)}`);
  lines.push(`  pre_processing: ${form.nlp.pre_processing ? 'True' : 'False'}`);
  if (form.nlp.intent_threshold.trim()) lines.push(`  intent_threshold: ${yamlValue(form.nlp.intent_threshold)}`);
  if (form.nlp.huggingface_token) { lines.push('  huggingface:'); lines.push(`    token: ${yamlValue(form.nlp.huggingface_token)}`); }
  if (form.nlp.openai_api_key) { lines.push('  openai:'); lines.push(`    api_key: ${yamlValue(form.nlp.openai_api_key)}`); }
  if (form.nlp.replicate_api_key) { lines.push('  replicate:'); lines.push(`    api_key: ${yamlValue(form.nlp.replicate_api_key)}`); }
  lines.push('');

  const { websocket: ws, telegram, github, gitlab, a2a } = form.platforms;
  const anyPlatform = ws.enabled || telegram.enabled || github.enabled || gitlab.enabled || a2a.enabled;
  if (anyPlatform) {
    lines.push('platforms:');
    if (ws.enabled) {
      lines.push('  websocket:');
      if (ws.host) lines.push(`    host: ${yamlValue(ws.host)}`);
      if (ws.port.trim()) lines.push(`    port: ${yamlValue(ws.port)}`);
      lines.push('    streamlit:');
      if (ws.streamlit_host) lines.push(`      host: ${yamlValue(ws.streamlit_host)}`);
      if (ws.streamlit_port.trim()) lines.push(`      port: ${yamlValue(ws.streamlit_port)}`);
      lines.push('      chat:');
      if (ws.chat_size.trim()) lines.push(`        size: ${yamlValue(ws.chat_size)}`);
      if (ws.chat_font) lines.push(`        font: ${yamlValue(ws.chat_font)}`);
      if (ws.chat_line_spacing.trim()) lines.push(`        line_spacing: ${yamlValue(ws.chat_line_spacing)}`);
      if (ws.chat_alignment) lines.push(`        alignment: ${yamlValue(ws.chat_alignment)}`);
      if (ws.chat_color) lines.push(`        color: ${yamlValue(ws.chat_color)}`);
      if (ws.chat_contrast) lines.push(`        contrast: ${yamlValue(ws.chat_contrast)}`);
    }
    if (telegram.enabled) {
      lines.push('  telegram:');
      if (telegram.token) lines.push(`    token: ${yamlValue(telegram.token)}`);
    }
    if (github.enabled) {
      lines.push('  github:');
      if (github.personal_token) lines.push(`    personal_token: ${yamlValue(github.personal_token)}`);
      if (github.webhook_token) lines.push(`    webhook_token: ${yamlValue(github.webhook_token)}`);
      if (github.webhook_port.trim()) lines.push(`    webhook_port: ${yamlValue(github.webhook_port)}`);
    }
    if (gitlab.enabled) {
      lines.push('  gitlab:');
      if (gitlab.personal_token) lines.push(`    personal_token: ${yamlValue(gitlab.personal_token)}`);
      if (gitlab.webhook_token) lines.push(`    webhook_token: ${yamlValue(gitlab.webhook_token)}`);
      if (gitlab.webhook_port.trim()) lines.push(`    webhook_port: ${yamlValue(gitlab.webhook_port)}`);
    }
    if (a2a.enabled) {
      lines.push('  a2a:');
      if (a2a.port.trim()) lines.push(`    port: ${yamlValue(a2a.port)}`);
    }
    lines.push('');
  }

  const { monitoring, streamlit_db } = form.db;
  if (monitoring.enabled || streamlit_db.enabled) {
    lines.push('db:');
    if (monitoring.enabled) {
      lines.push('  monitoring:');
      lines.push(`    enabled: True`);
      if (monitoring.dialect) lines.push(`    dialect: ${yamlValue(monitoring.dialect)}`);
      if (monitoring.host) lines.push(`    host: ${yamlValue(monitoring.host)}`);
      if (monitoring.port.trim()) lines.push(`    port: ${yamlValue(monitoring.port)}`);
      if (monitoring.database) lines.push(`    database: ${yamlValue(monitoring.database)}`);
      if (monitoring.username) lines.push(`    username: ${yamlValue(monitoring.username)}`);
      if (monitoring.password) lines.push(`    password: ${yamlValue(monitoring.password)}`);
    }
    if (streamlit_db.enabled) {
      lines.push('  streamlit:');
      lines.push(`    enabled: True`);
      if (streamlit_db.dialect) lines.push(`    dialect: ${yamlValue(streamlit_db.dialect)}`);
      if (streamlit_db.host) lines.push(`    host: ${yamlValue(streamlit_db.host)}`);
      if (streamlit_db.port.trim()) lines.push(`    port: ${yamlValue(streamlit_db.port)}`);
      if (streamlit_db.database) lines.push(`    database: ${yamlValue(streamlit_db.database)}`);
      if (streamlit_db.username) lines.push(`    username: ${yamlValue(streamlit_db.username)}`);
      if (streamlit_db.password) lines.push(`    password: ${yamlValue(streamlit_db.password)}`);
    }
  }

  return lines.join('\n').trimEnd();
}

export function buildConfigYaml(form: AgentConfigFormData, customYaml: string): string {
  const base = agentConfigFormToYaml(form);
  const extra = customYaml.trim();
  if (!extra) return base;
  return base + '\n\n' + extra;
}
