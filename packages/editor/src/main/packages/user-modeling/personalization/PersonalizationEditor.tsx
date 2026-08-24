import React, { useState } from 'react';
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

type Props = {
  value?: UserPersonalizationSpec;
  onChange: (next: UserPersonalizationSpec | undefined) => void;
  /** Optional label for the toggle button (default "Personalization"). */
  label?: string;
  /** Start expanded (default: expanded when a spec already exists). */
  defaultOpen?: boolean;
};

/** Drop empty dimensions / fields so the stored spec stays sparse; undefined when fully empty. */
const clean = (spec: UserPersonalizationSpec): UserPersonalizationSpec | undefined => {
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
          {/* Content */}
          <Section>
            <SectionTitle>Content</SectionTitle>
            <Row>
              <RowLabel>Language</RowLabel>
              <Select
                value={content.language ?? ''}
                onChange={(e) => patchContent({ language: (e.target.value || undefined) as UserContentSpec['language'] })}
              >
                <option value="">—</option>
                {['original', 'english', 'spanish', 'french', 'german', 'portuguese', 'luxembourgish', 'italian'].map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </Select>
            </Row>
            <Row>
              <RowLabel>Style</RowLabel>
              <Select
                value={content.style ?? ''}
                onChange={(e) => patchContent({ style: (e.target.value || undefined) as UserContentSpec['style'] })}
              >
                <option value="">—</option>
                {['original', 'formal', 'informal'].map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </Select>
            </Row>
            <Row>
              <RowLabel>Language complexity</RowLabel>
              <Select
                value={content.languageComplexity ?? ''}
                onChange={(e) => patchContent({ languageComplexity: (e.target.value || undefined) as UserContentSpec['languageComplexity'] })}
              >
                <option value="">—</option>
                {['original', 'simple', 'medium', 'complex'].map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </Select>
            </Row>
            <Row>
              <RowLabel>Sentence length</RowLabel>
              <Select
                value={content.sentenceLength ?? ''}
                onChange={(e) => patchContent({ sentenceLength: (e.target.value || undefined) as UserContentSpec['sentenceLength'] })}
              >
                <option value="">—</option>
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
          </Section>
          <Divider />

          {/* Presentation */}
          <Section>
            <SectionTitle>Presentation</SectionTitle>
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
                <option value="">—</option>
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
                <option value="">—</option>
                {['left', 'center', 'justify'].map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </Select>
            </Row>
            <Row>
              <RowLabel>Color</RowLabel>
              <Input
                type="text"
                placeholder="#000000"
                value={presentation.color ?? ''}
                onChange={(e) => patchPresentation({ color: e.target.value || undefined })}
              />
            </Row>
            <Row>
              <RowLabel>Contrast</RowLabel>
              <Select
                value={presentation.contrast ?? ''}
                onChange={(e) => patchPresentation({ contrast: (e.target.value || undefined) as UserPresentationSpec['contrast'] })}
              >
                <option value="">—</option>
                {['low', 'medium', 'high'].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </Row>
          </Section>
          <Divider />

          {/* Modality */}
          <Section>
            <SectionTitle>Modality</SectionTitle>
            <Row>
              <RowLabel>Input</RowLabel>
              <Input
                type="text"
                placeholder="text, voice…"
                value={(modality.inputModalities ?? []).join(', ')}
                onChange={(e) => patchModality({ inputModalities: parseList(e.target.value) })}
              />
            </Row>
            <Row>
              <RowLabel>Output</RowLabel>
              <Input
                type="text"
                placeholder="text, voice…"
                value={(modality.outputModalities ?? []).join(', ')}
                onChange={(e) => patchModality({ outputModalities: parseList(e.target.value) })}
              />
            </Row>
            <Row>
              <RowLabel>Voice gender</RowLabel>
              <Select
                value={modality.voiceGender ?? ''}
                onChange={(e) => patchModality({ voiceGender: (e.target.value || undefined) as UserModalitySpec['voiceGender'] })}
              >
                <option value="">—</option>
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
