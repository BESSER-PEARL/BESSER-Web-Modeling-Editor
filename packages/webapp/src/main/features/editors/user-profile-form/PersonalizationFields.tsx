/**
 * Tailwind editor for a per-element personalization spec (presentation /
 * modality / content). Webapp-form counterpart of the editor package's
 * `PersonalizationEditor` (canvas popups). Both write the same sparse
 * `UserPersonalizationSpec` onto the shared UserDiagram model, so the two views
 * stay in sync. Cleared fields are pruned so the stored spec stays minimal.
 */

import React, { useState } from 'react';
import type {
  UserContentSpec,
  UserModalitySpec,
  UserPersonalizationSpec,
  UserPresentationSpec,
} from '@besser/wme';
import { isPersonalizationSpecEmpty } from '@besser/wme';
import { ChevronRight, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

const selectClass =
  'h-7 w-full rounded-md border border-brand/15 bg-card px-1.5 text-[12px] font-medium text-foreground shadow-sm transition-colors hover:border-brand/30 focus:border-brand/40 focus:outline-none focus:ring-1 focus:ring-brand/20';
const inputClass =
  'h-7 w-full rounded-md border border-input bg-background px-2 text-[12px] ring-offset-background transition-colors placeholder:text-muted-foreground/50 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/20';
const sectionTitleClass =
  'text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70';
const rowLabelClass = 'min-w-[92px] max-w-[92px] shrink-0 text-[12px] text-muted-foreground';

const prune = <T extends object>(obj?: T): T | undefined => {
  if (!obj) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === '' || v === null) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return Object.keys(out).length ? (out as T) : undefined;
};

const clean = (spec: UserPersonalizationSpec): UserPersonalizationSpec | undefined => {
  const next: UserPersonalizationSpec = {
    presentation: prune(spec.presentation),
    modality: prune(spec.modality),
    content: prune(spec.content),
  };
  return isPersonalizationSpecEmpty(next) ? undefined : next;
};

const parseNumber = (raw: string): number | undefined => {
  if (raw.trim() === '') return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
};

const parseList = (raw: string): string[] | undefined => {
  const items = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return items.length ? items : undefined;
};

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="flex items-center gap-2 py-0.5">
    <span className={rowLabelClass}>{label}</span>
    {children}
  </label>
);

interface Props {
  value?: UserPersonalizationSpec;
  onChange: (next: UserPersonalizationSpec | undefined) => void;
  label?: string;
}

export const PersonalizationFields: React.FC<Props> = ({ value, onChange, label }) => {
  const active = !isPersonalizationSpecEmpty(value);
  const [open, setOpen] = useState<boolean>(active);
  const spec = value ?? {};
  const presentation = spec.presentation ?? {};
  const modality = spec.modality ?? {};
  const content = spec.content ?? {};

  const patchPresentation = (patch: Partial<UserPresentationSpec>) =>
    onChange(clean({ ...spec, presentation: { ...presentation, ...patch } }));
  const patchModality = (patch: Partial<UserModalitySpec>) =>
    onChange(clean({ ...spec, modality: { ...modality, ...patch } }));
  const patchContent = (patch: Partial<UserContentSpec>) =>
    onChange(clean({ ...spec, content: { ...content, ...patch } }));

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          className={cn(
            'group flex w-full items-center gap-1.5 rounded-md border px-1.5 py-1 text-[12px] font-medium transition-colors',
            active
              ? 'border-brand/30 bg-brand/[0.06] text-brand-dark'
              : 'border-border/60 bg-card/60 text-muted-foreground hover:border-brand/25',
          )}
        >
          <ChevronRight className="size-3 transition-transform group-data-[state=open]:rotate-90" />
          <Sparkles className="size-3" />
          <span>{label ?? 'Personalization'}</span>
          {active && <span className="ml-1 size-1.5 rounded-full bg-brand" aria-hidden />}
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="mt-1.5 space-y-2.5 rounded-md border border-border/50 bg-muted/20 p-2">
          {/* Content */}
          <div className="space-y-0.5">
            <p className={sectionTitleClass}>Content</p>
            <Row label="Language">
              <select
                className={selectClass}
                value={content.language ?? ''}
                onChange={(e) => patchContent({ language: (e.target.value || undefined) as UserContentSpec['language'] })}
              >
                <option value="">—</option>
                {['original', 'english', 'spanish', 'french', 'german', 'portuguese', 'luxembourgish', 'italian'].map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </Row>
            <Row label="Style">
              <select
                className={selectClass}
                value={content.style ?? ''}
                onChange={(e) => patchContent({ style: (e.target.value || undefined) as UserContentSpec['style'] })}
              >
                <option value="">—</option>
                {['original', 'formal', 'informal'].map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </Row>
            <Row label="Complexity">
              <select
                className={selectClass}
                value={content.languageComplexity ?? ''}
                onChange={(e) => patchContent({ languageComplexity: (e.target.value || undefined) as UserContentSpec['languageComplexity'] })}
              >
                <option value="">—</option>
                {['original', 'simple', 'medium', 'complex'].map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </Row>
            <Row label="Sentence">
              <select
                className={selectClass}
                value={content.sentenceLength ?? ''}
                onChange={(e) => patchContent({ sentenceLength: (e.target.value || undefined) as UserContentSpec['sentenceLength'] })}
              >
                <option value="">—</option>
                {['original', 'concise', 'verbose'].map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </Row>
            <label className="flex items-center gap-2 py-0.5">
              <span className={rowLabelClass}>Abbreviations</span>
              <input
                type="checkbox"
                className="size-3.5 accent-[hsl(var(--brand))]"
                checked={content.useAbbreviations ?? false}
                onChange={(e) => patchContent({ useAbbreviations: e.target.checked || undefined })}
              />
            </label>
          </div>

          {/* Presentation */}
          <div className="space-y-0.5">
            <p className={sectionTitleClass}>Presentation</p>
            <Row label="Font size">
              <input
                type="number"
                className={inputClass}
                value={presentation.size ?? ''}
                onChange={(e) => patchPresentation({ size: parseNumber(e.target.value) })}
              />
            </Row>
            <Row label="Font">
              <select
                className={selectClass}
                value={presentation.font ?? ''}
                onChange={(e) => patchPresentation({ font: (e.target.value || undefined) as UserPresentationSpec['font'] })}
              >
                <option value="">—</option>
                {['sans', 'serif', 'monospace', 'neutral', 'grotesque', 'condensed'].map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </Row>
            <Row label="Line spacing">
              <input
                type="number"
                step="0.1"
                className={inputClass}
                value={presentation.lineSpacing ?? ''}
                onChange={(e) => patchPresentation({ lineSpacing: parseNumber(e.target.value) })}
              />
            </Row>
            <Row label="Alignment">
              <select
                className={selectClass}
                value={presentation.alignment ?? ''}
                onChange={(e) => patchPresentation({ alignment: (e.target.value || undefined) as UserPresentationSpec['alignment'] })}
              >
                <option value="">—</option>
                {['left', 'center', 'justify'].map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </Row>
            <Row label="Color">
              <input
                type="text"
                className={inputClass}
                placeholder="#000000"
                value={presentation.color ?? ''}
                onChange={(e) => patchPresentation({ color: e.target.value || undefined })}
              />
            </Row>
            <Row label="Contrast">
              <select
                className={selectClass}
                value={presentation.contrast ?? ''}
                onChange={(e) => patchPresentation({ contrast: (e.target.value || undefined) as UserPresentationSpec['contrast'] })}
              >
                <option value="">—</option>
                {['low', 'medium', 'high'].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Row>
          </div>

          {/* Modality */}
          <div className="space-y-0.5">
            <p className={sectionTitleClass}>Modality</p>
            <Row label="Input">
              <input
                type="text"
                className={inputClass}
                placeholder="text, voice…"
                value={(modality.inputModalities ?? []).join(', ')}
                onChange={(e) => patchModality({ inputModalities: parseList(e.target.value) })}
              />
            </Row>
            <Row label="Output">
              <input
                type="text"
                className={inputClass}
                placeholder="text, voice…"
                value={(modality.outputModalities ?? []).join(', ')}
                onChange={(e) => patchModality({ outputModalities: parseList(e.target.value) })}
              />
            </Row>
            <Row label="Voice gender">
              <select
                className={selectClass}
                value={modality.voiceGender ?? ''}
                onChange={(e) => patchModality({ voiceGender: (e.target.value || undefined) as UserModalitySpec['voiceGender'] })}
              >
                <option value="">—</option>
                {['male', 'female', 'ambiguous'].map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </Row>
            <Row label="Voice speed">
              <input
                type="number"
                step="0.1"
                className={inputClass}
                value={modality.voiceSpeed ?? ''}
                onChange={(e) => patchModality({ voiceSpeed: parseNumber(e.target.value) })}
              />
            </Row>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};
