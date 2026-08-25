import React, { useState } from 'react';
import { SketchPicker } from 'react-color';
import styled from 'styled-components';
import { Divider } from '../../../components/controls/divider/divider';
import {
  UserContentSpec,
  UserModalitySpec,
  UserPersonalizationSpec,
  UserPresentationSpec,
  isPersonalizationSpecEmpty,
} from '../personalization-spec';

/**
 * Compact editor for a per-element personalization spec (presentation /
 * modality / content), shared by the profile-level box popup and the
 * attribute-level row popup. Self-contained native controls (the popup lives in
 * the editor's own DOM, not the webapp's Tailwind surface). Writes a sparse
 * spec: cleared fields are removed so serialization stays minimal and
 * `isPersonalizationSpecEmpty` stays accurate.
 */

const Wrapper = styled.div`
  font-size: 12px;
`;

const Section = styled.div`
  margin: 6px 0;
`;

const SectionTitle = styled.div`
  font-weight: 600;
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  opacity: 0.7;
`;

const SubTitle = styled.div`
  font-weight: 500;
  margin: 8px 0 4px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  opacity: 0.5;
`;

const Row = styled.label`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 3px 0;
`;

const RowLabel = styled.span`
  white-space: nowrap;
`;

const controlStyle = `
  flex: 1;
  min-width: 0;
  max-width: 150px;
  box-sizing: border-box;
  border: 1px solid rgba(127, 127, 127, 0.4);
  border-radius: 4px;
  padding: 2px 4px;
  background: transparent;
  color: inherit;
  font-size: 12px;
`;
const Select = styled.select`
  ${controlStyle}
`;
const Input = styled.input`
  ${controlStyle}
`;

const ToggleButton = styled.button<{ active?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid rgba(127, 127, 127, 0.4);
  border-radius: 4px;
  padding: 3px 8px;
  background: ${({ active }) => (active ? 'rgba(120, 120, 255, 0.12)' : 'transparent')};
  color: inherit;
  cursor: pointer;
  font-size: 12px;
`;

const Dot = styled.span`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: hsl(250, 70%, 60%);
`;

/* A row whose control area holds inline checkboxes (not a single <label>, so it
   can nest its own per-option <label>s without invalid label-in-label markup). */
const CheckRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 3px 0;
`;
const CheckGroup = styled.div`
  display: flex;
  gap: 12px;
  flex: 1;
  justify-content: flex-end;
`;
const CheckLabel = styled.label<{ disabled?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: ${({ disabled }) => (disabled ? 'default' : 'pointer')};
  white-space: nowrap;
`;
const InfoMark = styled.span`
  cursor: help;
  opacity: 0.55;
  font-size: 11px;
`;

/**
 * `text` is always enabled by the agent runtime, so it's shown fixed/checked and
 * only `speech` is toggleable. A list containing `speech` implies text too; an
 * empty list is stored as undefined (text-only is the implicit default).
 */
const speechModalities = (on: boolean): string[] | undefined => (on ? ['text', 'speech'] : undefined);

type Props = {
  value?: UserPersonalizationSpec;
  onChange: (next: UserPersonalizationSpec | undefined) => void;
  /** Optional label for the toggle button (default "Personalization"). */
  label?: string;
  /** Start expanded (default: expanded when a spec already exists). */
  defaultOpen?: boolean;
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

const eqColor = (a?: string, b?: string) => (a ?? '').toLowerCase() === (b ?? '').toLowerCase();

/**
 * Text-color picker for the canvas popup: preset swatches inline plus a "custom"
 * chip that toggles a modern `SketchPicker` (rendered inline, not in a floating
 * layer, so it can't be clipped by the editor's own popup).
 */
const ColorField: React.FC<{ value?: string; onChange: (v: string | undefined) => void }> = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const isCustom = !!value && !PRESET_VALUES.some((p) => eqColor(value, p));
  const custom = value && HEX_RE.test(value) ? value : '#000000';

  return (
    <div style={{ margin: '6px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <RowLabel>Color</RowLabel>
        {value && (
          <button
            type="button"
            title="Clear color"
            onClick={() => {
              onChange(undefined);
              setOpen(false);
            }}
            style={{ background: 'transparent', border: 'none', color: 'inherit', opacity: 0.6, cursor: 'pointer', fontSize: 11 }}
          >
            clear
          </button>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {COLOR_PRESETS.map((c) => (
          <button
            key={c.value}
            type="button"
            title={c.label}
            aria-label={c.label}
            onClick={() => {
              onChange(c.value);
              setOpen(false);
            }}
            style={{
              width: 20,
              height: 20,
              borderRadius: '50%',
              padding: 0,
              cursor: 'pointer',
              background: c.value,
              boxShadow: eqColor(value, c.value) ? '0 0 0 2px hsl(250, 70%, 60%)' : 'none',
              border: eqColor(value, c.value) ? '1px solid transparent' : '1px solid rgba(127, 127, 127, 0.45)',
            }}
          />
        ))}
        <button
          type="button"
          title="Custom color"
          aria-label="Custom color"
          onClick={() => setOpen((o) => !o)}
          style={{
            width: 20,
            height: 20,
            borderRadius: '50%',
            padding: 0,
            cursor: 'pointer',
            backgroundImage: isCustom ? undefined : RAINBOW,
            background: isCustom ? value : undefined,
            boxShadow: isCustom ? '0 0 0 2px hsl(250, 70%, 60%)' : 'none',
            border: isCustom ? '1px solid transparent' : '1px solid rgba(127, 127, 127, 0.45)',
          }}
        />
      </div>
      {open && (
        <div style={{ marginTop: 8 }}>
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

/** Drop empty dimensions / fields so the stored spec stays sparse; undefined when fully empty. */
const clean = (spec: UserPersonalizationSpec): UserPersonalizationSpec | undefined => {
  const prune = <T extends object>(obj?: T): T | undefined => {
    if (!obj) return undefined;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v === undefined || v === '' || v === null) continue;
      // `original` is the content dimensions' no-change default (shown selected
      // by default, matching the old personalization view): equivalent to unset,
      // so drop it to keep the spec sparse.
      if (v === 'original') continue;
      if (Array.isArray(v) && v.length === 0) continue;
      out[k] = v;
    }
    return Object.keys(out).length ? (out as T) : undefined;
  };
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

export const PersonalizationEditor: React.FC<Props> = ({ value, onChange, label, defaultOpen }) => {
  const [open, setOpen] = useState<boolean>(defaultOpen ?? !isPersonalizationSpecEmpty(value));
  const spec = value ?? {};
  const presentation = spec.presentation ?? {};
  const modality = spec.modality ?? {};
  const content = spec.content ?? {};
  const active = !isPersonalizationSpecEmpty(value);

  const patchPresentation = (patch: Partial<UserPresentationSpec>) =>
    onChange(clean({ ...spec, presentation: { ...presentation, ...patch } }));
  const patchModality = (patch: Partial<UserModalitySpec>) =>
    onChange(clean({ ...spec, modality: { ...modality, ...patch } }));
  const patchContent = (patch: Partial<UserContentSpec>) =>
    onChange(clean({ ...spec, content: { ...content, ...patch } }));

  return (
    <Wrapper>
      <ToggleButton type="button" active={active} onClick={() => setOpen((o) => !o)}>
        {active && <Dot />}
        {label ?? 'Personalization'}
        <span style={{ opacity: 0.6 }}>{open ? '▾' : '▸'}</span>
      </ToggleButton>

      {open && (
        <div style={{ marginTop: 6 }}>
          {/* Presentation (language/style/complexity/sentence + interface styling) */}
          <Section>
            <SectionTitle>Presentation</SectionTitle>
            <Row>
              <RowLabel>Language</RowLabel>
              <Select
                value={content.language ?? CONTENT_DEFAULT}
                onChange={(e) => patchContent({ language: (e.target.value || undefined) as UserContentSpec['language'] })}
              >
                {['original', 'english', 'spanish', 'french', 'german', 'portuguese', 'luxembourgish', 'italian'].map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </Select>
            </Row>
            <Row>
              <RowLabel>Style</RowLabel>
              <Select
                value={content.style ?? CONTENT_DEFAULT}
                onChange={(e) => patchContent({ style: (e.target.value || undefined) as UserContentSpec['style'] })}
              >
                {['original', 'formal', 'informal'].map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </Select>
            </Row>
            <Row>
              <RowLabel>Language complexity</RowLabel>
              <Select
                value={content.languageComplexity ?? CONTENT_DEFAULT}
                onChange={(e) => patchContent({ languageComplexity: (e.target.value || undefined) as UserContentSpec['languageComplexity'] })}
              >
                {['original', 'simple', 'medium', 'complex'].map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </Select>
            </Row>
            <Row>
              <RowLabel>Sentence length</RowLabel>
              <Select
                value={content.sentenceLength ?? CONTENT_DEFAULT}
                onChange={(e) => patchContent({ sentenceLength: (e.target.value || undefined) as UserContentSpec['sentenceLength'] })}
              >
                {['original', 'concise', 'verbose'].map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </Select>
            </Row>
            <Row>
              <RowLabel>Use abbreviations</RowLabel>
              <input
                type="checkbox"
                checked={content.useAbbreviations ?? false}
                onChange={(e) => patchContent({ useAbbreviations: e.target.checked || undefined })}
              />
            </Row>

            <SubTitle>Interface</SubTitle>
            <Row>
              <RowLabel>Font size</RowLabel>
              <Input
                type="number"
                value={presentation.size ?? ''}
                onChange={(e) => patchPresentation({ size: parseNumber(e.target.value) })}
              />
            </Row>
            <Row>
              <RowLabel>Font</RowLabel>
              <Select
                value={presentation.font ?? ''}
                onChange={(e) => patchPresentation({ font: (e.target.value || undefined) as UserPresentationSpec['font'] })}
              >
                <option value="">none</option>
                {['sans', 'serif', 'monospace', 'neutral', 'grotesque', 'condensed'].map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </Select>
            </Row>
            <Row>
              <RowLabel>Line spacing</RowLabel>
              <Input
                type="number"
                step="0.1"
                value={presentation.lineSpacing ?? ''}
                onChange={(e) => patchPresentation({ lineSpacing: parseNumber(e.target.value) })}
              />
            </Row>
            <Row>
              <RowLabel>Alignment</RowLabel>
              <Select
                value={presentation.alignment ?? ''}
                onChange={(e) => patchPresentation({ alignment: (e.target.value || undefined) as UserPresentationSpec['alignment'] })}
              >
                <option value="">none</option>
                {['left', 'center', 'justify'].map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </Select>
            </Row>
            <Row>
              <RowLabel>Contrast</RowLabel>
              <Select
                value={presentation.contrast ?? ''}
                onChange={(e) => patchPresentation({ contrast: (e.target.value || undefined) as UserPresentationSpec['contrast'] })}
              >
                <option value="">none</option>
                {['low', 'medium', 'high'].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </Row>
            <ColorField value={presentation.color} onChange={(color) => patchPresentation({ color })} />
          </Section>
          <Divider />

          {/* Content */}
          <Section>
            <SectionTitle>Content</SectionTitle>
            <CheckRow style={{ alignItems: 'flex-start' }}>
              <RowLabel style={{ whiteSpace: 'normal' }}>Adapt content to this user profile</RowLabel>
              <input
                type="checkbox"
                checked={content.adaptContentToUserProfile ?? false}
                onChange={(e) => patchContent({ adaptContentToUserProfile: e.target.checked || undefined })}
              />
            </CheckRow>
            <div style={{ opacity: 0.6, fontSize: 11, marginTop: 2 }}>
              When enabled, the agent tailors its responses to this profile.
            </div>
          </Section>
          <Divider />

          {/* Modality */}
          <Section>
            <SectionTitle>Modality</SectionTitle>
            <CheckRow>
              <RowLabel>Input</RowLabel>
              <CheckGroup>
                <CheckLabel disabled title="Text is always enabled">
                  <input type="checkbox" checked readOnly disabled />
                  text
                  <InfoMark title="Text is always enabled">ⓘ</InfoMark>
                </CheckLabel>
                <CheckLabel>
                  <input
                    type="checkbox"
                    checked={(modality.inputModalities ?? []).includes('speech')}
                    onChange={(e) => patchModality({ inputModalities: speechModalities(e.target.checked) })}
                  />
                  speech
                </CheckLabel>
              </CheckGroup>
            </CheckRow>
            <CheckRow>
              <RowLabel>Output</RowLabel>
              <CheckGroup>
                <CheckLabel disabled title="Text is always enabled">
                  <input type="checkbox" checked readOnly disabled />
                  text
                  <InfoMark title="Text is always enabled">ⓘ</InfoMark>
                </CheckLabel>
                <CheckLabel>
                  <input
                    type="checkbox"
                    checked={(modality.outputModalities ?? []).includes('speech')}
                    onChange={(e) => patchModality({ outputModalities: speechModalities(e.target.checked) })}
                  />
                  speech
                </CheckLabel>
              </CheckGroup>
            </CheckRow>
            <Row>
              <RowLabel>Voice gender</RowLabel>
              <Select
                value={modality.voiceGender ?? ''}
                onChange={(e) => patchModality({ voiceGender: (e.target.value || undefined) as UserModalitySpec['voiceGender'] })}
              >
                <option value="">none</option>
                {['male', 'female', 'ambiguous'].map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </Select>
            </Row>
            <Row>
              <RowLabel>Voice speed</RowLabel>
              <Input
                type="number"
                step="0.1"
                value={modality.voiceSpeed ?? ''}
                onChange={(e) => patchModality({ voiceSpeed: parseNumber(e.target.value) })}
              />
            </Row>
          </Section>
        </div>
      )}
    </Wrapper>
  );
};
