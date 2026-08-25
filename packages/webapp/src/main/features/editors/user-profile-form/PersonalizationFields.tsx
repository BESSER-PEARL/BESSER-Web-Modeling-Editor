/**
 * Tailwind editor for a per-element personalization spec (presentation /
 * modality / content). Webapp-form counterpart of the editor package's
 * `PersonalizationEditor` (canvas popups). Both write the same sparse
 * `UserPersonalizationSpec` onto the shared UserDiagram model, so the two views
 * stay in sync. Cleared fields are pruned so the stored spec stays minimal.
 */

import React, { useEffect, useRef, useState } from 'react';
import { SketchPicker } from 'react-color';
import type {
  UserContentSpec,
  UserModalitySpec,
  UserPersonalizationSpec,
  UserPresentationSpec,
} from '@besser/wme';
import { isPersonalizationSpecEmpty } from '@besser/wme';
import { ChevronRight, Info, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

const selectClass =
  'h-7 w-full rounded-md border border-brand/15 bg-card px-1.5 text-[12px] font-medium text-foreground shadow-sm transition-colors hover:border-brand/30 focus:border-brand/40 focus:outline-none focus:ring-1 focus:ring-brand/20';
const inputClass =
  'h-7 w-full rounded-md border border-input bg-background px-2 text-[12px] ring-offset-background transition-colors placeholder:text-muted-foreground/50 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/20';
const sectionTitleClass =
  'text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70';
const subSectionTitleClass =
  'text-[10px] font-medium uppercase tracking-wide text-muted-foreground/50';
const rowLabelClass = 'min-w-[92px] max-w-[92px] shrink-0 text-[12px] text-muted-foreground';

const prune = <T extends object>(obj?: T): T | undefined => {
  if (!obj) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === '' || v === null) continue;
    // `original` is the content dimensions' no-change default (shown selected
    // by default, matching the old personalization view). It means "keep the
    // original", so it's equivalent to unset: drop it to keep the spec sparse
    // (no spurious "active" indicator, nothing needlessly shipped to the agent).
    if (v === 'original') continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return Object.keys(out).length ? (out as T) : undefined;
};

/** Content enums default to `original` (no change); everything else to unset. */
const CONTENT_DEFAULT = 'original';

/**
 * Preset text colors shown inline for quick one-click picking — the classic
 * black / red / green / blue set. Anything else goes through the "custom" chip,
 * which opens a modern color picker (saturation/hue/hex).
 */
const COLOR_PRESETS: { label: string; value: string }[] = [
  { label: 'black', value: '#000000' },
  { label: 'red', value: '#ff0000' },
  { label: 'green', value: '#008000' },
  { label: 'blue', value: '#0000ff' },
];
const PRESET_VALUES = COLOR_PRESETS.map((c) => c.value);

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/** Rainbow gradient used as the "custom color" chip fill. */
const RAINBOW =
  'conic-gradient(from 90deg, #ef4444, #f97316, #eab308, #22c55e, #14b8a6, #3b82f6, #6366f1, #a855f7, #ec4899, #ef4444)';

const eq = (a?: string, b?: string) => (a ?? '').toLowerCase() === (b ?? '').toLowerCase();

/**
 * Text-color picker: preset swatches inline for quick picks, plus a "custom"
 * rainbow chip that opens a modern `SketchPicker` (saturation/hue/hex) — no more
 * native OS color dialog.
 */
const ColorPicker: React.FC<{ value?: string; onChange: (v: string | undefined) => void }> = ({
  value,
  onChange,
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const custom = value && HEX_RE.test(value) ? value : '#000000';

  return (
    <div className="relative flex flex-1 items-center gap-1.5" ref={ref}>
      {COLOR_PRESETS.map((c) => (
        <button
          key={c.value}
          type="button"
          title={c.label}
          aria-label={c.label}
          onClick={() => onChange(c.value)}
          className={cn(
            'size-5 shrink-0 rounded-full border transition-transform hover:scale-110',
            eq(value, c.value)
              ? 'border-transparent ring-2 ring-brand ring-offset-1 ring-offset-background'
              : 'border-border/50',
          )}
          style={{ backgroundColor: c.value }}
        />
      ))}

      <button
        type="button"
        title="Custom color"
        aria-label="Custom color"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'size-5 shrink-0 rounded-full border transition-transform hover:scale-110',
          value && !PRESET_VALUES.some((p) => eq(value, p))
            ? 'border-transparent ring-2 ring-brand ring-offset-1 ring-offset-background'
            : 'border-border/50',
        )}
        style={
          value && !PRESET_VALUES.some((p) => eq(value, p))
            ? { backgroundColor: value }
            : { backgroundImage: RAINBOW }
        }
      />

      {value && (
        <button
          type="button"
          className="shrink-0 rounded px-1 text-[11px] text-muted-foreground hover:text-foreground"
          title="Clear color"
          onClick={() => onChange(undefined)}
        >
          clear
        </button>
      )}

      {open && (
        <div className="absolute left-0 top-7 z-50 rounded-lg border border-border bg-popover shadow-lg">
          <SketchPicker
            color={custom}
            disableAlpha
            presetColors={PRESET_VALUES}
            onChange={(c) => onChange(c.hex)}
          />
        </div>
      )}
    </div>
  );
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

/**
 * `text` is always enabled by the agent runtime, so it's shown fixed/checked and
 * only `speech` is toggleable. A list containing `speech` implies text too; an
 * empty list is stored as undefined (text-only is the implicit default).
 */
const speechModalities = (on: boolean): string[] | undefined => (on ? ['text', 'speech'] : undefined);

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
          {/* Presentation (language/style/complexity/sentence + interface styling) */}
          <div className="space-y-0.5">
            <p className={sectionTitleClass}>Presentation</p>
            <Row label="Language">
              <select
                className={selectClass}
                value={content.language ?? CONTENT_DEFAULT}
                onChange={(e) => patchContent({ language: (e.target.value || undefined) as UserContentSpec['language'] })}
              >
                {['original', 'english', 'spanish', 'french', 'german', 'portuguese', 'luxembourgish', 'italian'].map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </Row>
            <Row label="Style">
              <select
                className={selectClass}
                value={content.style ?? CONTENT_DEFAULT}
                onChange={(e) => patchContent({ style: (e.target.value || undefined) as UserContentSpec['style'] })}
              >
                {['original', 'formal', 'informal'].map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </Row>
            <Row label="Language complexity">
              <select
                className={selectClass}
                value={content.languageComplexity ?? CONTENT_DEFAULT}
                onChange={(e) => patchContent({ languageComplexity: (e.target.value || undefined) as UserContentSpec['languageComplexity'] })}
              >
                {['original', 'simple', 'medium', 'complex'].map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </Row>
            <Row label="Sentence length">
              <select
                className={selectClass}
                value={content.sentenceLength ?? CONTENT_DEFAULT}
                onChange={(e) => patchContent({ sentenceLength: (e.target.value || undefined) as UserContentSpec['sentenceLength'] })}
              >
                {['original', 'concise', 'verbose'].map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </Row>
            <label className="flex items-center gap-2 py-0.5">
              <span className={rowLabelClass}>Use abbreviations</span>
              <input
                type="checkbox"
                className="size-3.5 accent-[hsl(var(--brand))]"
                checked={content.useAbbreviations ?? false}
                onChange={(e) => patchContent({ useAbbreviations: e.target.checked || undefined })}
              />
            </label>

            <p className={cn(subSectionTitleClass, 'pt-1.5')}>Interface</p>
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
                <option value="">none</option>
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
                <option value="">none</option>
                {['left', 'center', 'justify'].map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </Row>
            <Row label="Contrast">
              <select
                className={selectClass}
                value={presentation.contrast ?? ''}
                onChange={(e) => patchPresentation({ contrast: (e.target.value || undefined) as UserPresentationSpec['contrast'] })}
              >
                <option value="">none</option>
                {['low', 'medium', 'high'].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Row>
            <div className="flex items-center gap-2 py-0.5">
              <span className={rowLabelClass}>Color</span>
              <ColorPicker
                value={presentation.color}
                onChange={(color) => patchPresentation({ color })}
              />
            </div>
          </div>

          {/* Content */}
          <div className="space-y-1">
            <p className={sectionTitleClass}>Content</p>
            <label className="flex items-start gap-2 py-0.5">
              <input
                type="checkbox"
                className="mt-0.5 size-3.5 accent-[hsl(var(--brand))]"
                checked={content.adaptContentToUserProfile ?? false}
                onChange={(e) => patchContent({ adaptContentToUserProfile: e.target.checked || undefined })}
              />
              <span className="text-[12px] text-foreground">Adapt content to this user profile</span>
            </label>
            <p className="pl-[22px] text-[11px] text-muted-foreground/70">
              When enabled, the agent tailors its responses to this profile.
            </p>
          </div>

          {/* Modality */}
          <div className="space-y-0.5">
            <p className={sectionTitleClass}>Modality</p>
            <div className="flex items-center gap-2 py-0.5">
              <span className={rowLabelClass}>Input</span>
              <div className="flex flex-1 items-center gap-3">
                <span
                  className="inline-flex cursor-default items-center gap-1 text-[12px] text-foreground"
                  title="Text is always enabled"
                >
                  <input type="checkbox" className="size-3.5 accent-[hsl(var(--brand))]" checked readOnly disabled />
                  text
                  <Info className="size-3 text-muted-foreground/60" aria-label="Text is always enabled" />
                </span>
                <label className="inline-flex cursor-pointer items-center gap-1 text-[12px] text-foreground">
                  <input
                    type="checkbox"
                    className="size-3.5 accent-[hsl(var(--brand))]"
                    checked={(modality.inputModalities ?? []).includes('speech')}
                    onChange={(e) => patchModality({ inputModalities: speechModalities(e.target.checked) })}
                  />
                  speech
                </label>
              </div>
            </div>
            <div className="flex items-center gap-2 py-0.5">
              <span className={rowLabelClass}>Output</span>
              <div className="flex flex-1 items-center gap-3">
                <span
                  className="inline-flex cursor-default items-center gap-1 text-[12px] text-foreground"
                  title="Text is always enabled"
                >
                  <input type="checkbox" className="size-3.5 accent-[hsl(var(--brand))]" checked readOnly disabled />
                  text
                  <Info className="size-3 text-muted-foreground/60" aria-label="Text is always enabled" />
                </span>
                <label className="inline-flex cursor-pointer items-center gap-1 text-[12px] text-foreground">
                  <input
                    type="checkbox"
                    className="size-3.5 accent-[hsl(var(--brand))]"
                    checked={(modality.outputModalities ?? []).includes('speech')}
                    onChange={(e) => patchModality({ outputModalities: speechModalities(e.target.checked) })}
                  />
                  speech
                </label>
              </div>
            </div>
            <Row label="Voice gender">
              <select
                className={selectClass}
                value={modality.voiceGender ?? ''}
                onChange={(e) => patchModality({ voiceGender: (e.target.value || undefined) as UserModalitySpec['voiceGender'] })}
              >
                <option value="">none</option>
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
