import React from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { AgentConfigFormData } from '../AgentConfigYamlEditor';

export function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200',
        value ? 'bg-brand' : 'bg-input',
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow ring-0 transition-transform duration-200',
          value ? 'translate-x-4' : 'translate-x-0',
        )}
      />
    </button>
  );
}

export function Field({ id, label, description, children }: {
  id: string; label: string; description?: string; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs font-medium text-foreground/80">{label}</Label>
      {children}
      {description && <p className="text-[11px] leading-snug text-muted-foreground/70">{description}</p>}
    </div>
  );
}

export function TextField({ id, label, description, value, onChange, placeholder }: {
  id: string; label: string; description?: string; value: string;
  onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <Field id={id} label={label} description={description}>
      <Input
        id={id}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-7 text-sm font-mono"
      />
    </Field>
  );
}

export function BoolField({ id, label, description, value, onChange }: {
  id: string; label: string; description?: string; value: boolean; onChange: (v: boolean) => void;
}) {
  const { t } = useTranslation();
  return (
    <Field id={id} label={label} description={description}>
      <div className="flex items-center gap-2">
        <Toggle value={value} onChange={onChange} />
        <span className="text-xs text-muted-foreground">{value ? t('agentConfig.runtime.boolTrue') : t('agentConfig.runtime.boolFalse')}</span>
      </div>
    </Field>
  );
}

export function DbFields({
  prefix, value, onChange,
}: {
  prefix: string;
  value: AgentConfigFormData['db']['monitoring'];
  onChange: (v: Partial<AgentConfigFormData['db']['monitoring']>) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-2 gap-3">
      <TextField id={`${prefix}-dialect`} label="dialect" value={value.dialect} onChange={v => onChange({ dialect: v })} description={t('agentConfig.runtime.field.db.dialectDesc')} />
      <TextField id={`${prefix}-host`} label="host" value={value.host} onChange={v => onChange({ host: v })} description={t('agentConfig.runtime.field.db.hostDesc')} />
      <TextField id={`${prefix}-port`} label="port" value={value.port} onChange={v => onChange({ port: v })} description={t('agentConfig.runtime.field.db.portDesc')} />
      <TextField id={`${prefix}-database`} label="database" value={value.database} onChange={v => onChange({ database: v })} description={t('agentConfig.runtime.field.db.databaseDesc')} />
      <TextField id={`${prefix}-username`} label="username" value={value.username} onChange={v => onChange({ username: v })} description={t('agentConfig.runtime.field.db.usernameDesc')} />
      <TextField id={`${prefix}-password`} label="password" value={value.password} onChange={v => onChange({ password: v })} description={t('agentConfig.runtime.field.db.passwordDesc')} />
    </div>
  );
}

export function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-base font-semibold">{title}</h2>
      {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
    </div>
  );
}

/** "Enabled" label + toggle row at the top of each platform section. */
export function EnabledToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3">
      <Label className="text-xs font-medium">{t('agentConfig.runtime.enabled')}</Label>
      <Toggle value={value} onChange={onChange} />
    </div>
  );
}
