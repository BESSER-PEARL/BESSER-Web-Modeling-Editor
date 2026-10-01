import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface FieldBaseProps {
  id: string;
  label: string;
  description?: string;
}

export function Field({ id, label, description, children }: FieldBaseProps & { children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-medium">{label}</Label>
      {children}
      {description && <p className="text-[11px] text-muted-foreground">{description}</p>}
    </div>
  );
}

export function TextField({ id, label, description, value, onChange, placeholder, multiline }: FieldBaseProps & {
  value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean;
}) {
  return (
    <Field id={id} label={label} description={description}>
      {multiline ? (
        <textarea
          id={id}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono resize-y focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
        />
      ) : (
        <Input
          id={id}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-8 text-sm"
        />
      )}
    </Field>
  );
}

export function NumberField({ id, label, description, value, onChange, min }: FieldBaseProps & {
  value: number; onChange: (v: number) => void; min?: number;
}) {
  return (
    <Field id={id} label={label} description={description}>
      <Input
        id={id}
        type="number"
        value={value}
        min={min}
        onChange={e => onChange(Number(e.target.value))}
        className="h-8 text-sm"
      />
    </Field>
  );
}

export function SelectField({ id, label, description, value, onChange, options }: FieldBaseProps & {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[];
}) {
  return (
    <Field id={id} label={label} description={description}>
      <select
        id={id}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </Field>
  );
}

export function CheckboxField({ id, label, description, value, onChange }: FieldBaseProps & {
  value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-2">
      <input
        id={id}
        type="checkbox"
        checked={value}
        onChange={e => onChange(e.target.checked)}
        className="mt-0.5 h-3.5 w-3.5"
      />
      <div>
        <Label htmlFor={id} className="text-xs font-medium cursor-pointer">{label}</Label>
        {description && <p className="text-[11px] text-muted-foreground">{description}</p>}
      </div>
    </div>
  );
}

/** A textarea editing a JSON object; only valid objects are propagated. */
export function JsonField({ id, label, description, value, onChange }: FieldBaseProps & {
  value: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void;
}) {
  const { t } = useTranslation();
  const [text, setText] = useState(() => JSON.stringify(value ?? {}, null, 2));
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextText = e.target.value;
    setText(nextText);
    try {
      const parsed = JSON.parse(nextText);
      if (typeof parsed !== 'object' || Array.isArray(parsed) || parsed === null) {
        setError(t('agentComponents.json.mustBeObject'));
        return;
      }
      setError(null);
      onChange(parsed);
    } catch {
      setError(t('agentComponents.json.invalid'));
    }
  };

  return (
    <Field id={id} label={label} description={description}>
      <textarea
        id={id}
        value={text}
        onChange={handleChange}
        rows={5}
        className={cn(
          'w-full rounded-md border bg-background px-3 py-2 text-sm font-mono resize-y focus:outline-none focus:ring-1 focus:ring-ring',
          error ? 'border-destructive' : 'border-input',
        )}
        placeholder="{}"
      />
      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </Field>
  );
}
