import React, { useState } from 'react';
import { SketchPicker } from 'react-color';
import styled from 'styled-components';
import { Divider } from '../../../components/controls/divider/divider';
import {
  UserContentSpec,
  UserGuiPresentationSpec,
  UserModalitySpec,
  UserPersonalizationSpec,
  UserPresentationSpec,
  isPersonalizationSpecEmpty,
} from '../personalization-spec';
import { ALL_PERSONALIZATION_FIELDS, PersonalizationFieldKey } from './personalization-field-config';

/**
 * Compact editor for independent agent and GUI personalization specs,
 * shared by the profile-level box popup and the
 * attribute-level row popup. Self-contained native controls (the popup lives in
 * the editor's own DOM, not the webapp's Tailwind surface). Writes a sparse
 * spec: cleared fields are removed so serialization stays minimal and
 * `isPersonalizationSpecEmpty` stays accurate.
 *
 * When `suggestedFields` is provided only the listed fields are shown by
 * default; the user can reveal all options via the "Show all options" toggle.
 * Fields that already carry a value are always visible regardless of the list.
 */

const Wrapper = styled.div`
  font-size: 13px;
`;

const TargetSection = styled.section`
  margin: 12px 0;
  padding: 10px;
  border: 1px solid rgba(127, 127, 127, 0.3);
  border-radius: 6px;
`;

const TargetTitle = styled.h3`
  margin: 0 0 10px;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.06em;
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
  padding: 3px 6px;
  background: transparent;
  color: inherit;
  font-size: 13px;
`;
const Select = styled.select`
  ${controlStyle}
`;
const Input = styled.input`
  ${controlStyle}
`;

const ToggleButton = styled.button<{ active?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 6px;
  border: 1px solid ${({ active }) => (active ? 'rgba(120, 100, 255, 0.55)' : 'rgba(127, 127, 127, 0.3)')};
  border-radius: 6px;
  padding: 7px 10px;
  background: ${({ active }) =>
    active
      ? 'linear-gradient(135deg, rgba(120, 100, 255, 0.15) 0%, rgba(80, 150, 255, 0.08) 100%)'
      : 'rgba(127, 127, 127, 0.07)'};
  color: inherit;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  box-sizing: border-box;
  transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
  &:hover {
    background: ${({ active }) =>
      active
        ? 'linear-gradient(135deg, rgba(120, 100, 255, 0.22) 0%, rgba(80, 150, 255, 0.14) 100%)'
        : 'rgba(127, 127, 127, 0.13)'};
    border-color: ${({ active }) => (active ? 'rgba(120, 100, 255, 0.75)' : 'rgba(127, 127, 127, 0.5)')};
    box-shadow: ${({ active }) => (active ? '0 0 0 3px rgba(120, 100, 255, 0.08)' : 'none')};
  }
`;

const ButtonDescription = styled.div`
  font-size: 12px;
  opacity: 0.5;
  margin-top: 5px;
  margin-bottom: 2px;
  line-height: 1.4;
  padding: 0 2px;
`;

const ShowAllToggle = styled.button`
  display: block;
  margin-top: 8px;
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  font-size: 12px;
  opacity: 0.55;
  padding: 0;
  text-align: left;
  &:hover {
    opacity: 0.9;
    text-decoration: underline;
  }
`;

const Dot = styled.span`
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: hsl(250, 80%, 65%);
  box-shadow: 0 0 4px rgba(120, 100, 255, 0.5);
  flex-shrink: 0;
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
  font-size: 12px;
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
  /**
   * Restrict the editor to a recommended subset of fields.  Fields not in this
   * list are hidden by default; the user can reveal them via "Show all options".
   * Fields that already have an active value are always shown regardless.
   * When omitted, all fields are always visible.
   */
  suggestedFields?: PersonalizationFieldKey[];
};

/** Content enums default to `original` (no change); everything else to unset. */
const CONTENT_DEFAULT = 'original';
const SENTENCE_LENGTH_OPTIONS: NonNullable<UserPresentationSpec['sentenceLength']>[] = ['original', 'concise', 'verbose'];
const LANGUAGE_OPTIONS: NonNullable<UserPresentationSpec['language']>[] = [
  'original', 'english', 'spanish', 'french', 'german', 'portuguese', 'luxembourgish', 'italian',
];

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
        <button
          type="button"
          title="Keep the original text color"
          aria-pressed={!value}
          onClick={() => {
            onChange(undefined);
            setOpen(false);
          }}
          style={{ background: 'transparent', border: 'none', color: 'inherit', opacity: value ? 0.6 : 1, cursor: 'pointer', fontSize: 12 }}
        >
          Original
        </button>
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
  const guiPresentation = prune(spec.gui?.presentation);
  const guiContent = prune(spec.gui?.content);
  const guiModality = prune(spec.gui?.modality);
  const next: UserPersonalizationSpec = {
    presentation: prune(spec.presentation),
    modality: prune(spec.modality),
    content: prune(spec.content),
    ...(guiPresentation || guiContent || guiModality ? { gui: { presentation: guiPresentation, content: guiContent, modality: guiModality } } : {}),
  };
  return isPersonalizationSpecEmpty(next) ? undefined : next;
};

const parseNumber = (raw: string): number | undefined => {
  if (raw.trim() === '') return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
};

const FONT_SIZE_PRESETS = [
  { label: 'Medium (18px)', value: 18 },
  { label: 'Large (24px)', value: 24 },
  { label: 'Extra large (32px)', value: 32 },
];

const LINE_SPACING_PRESETS = [
  { label: 'Normal (1.2)', value: 1.2 },
  { label: 'Comfortable (1.5)', value: 1.5 },
  { label: 'Spacious (1.8)', value: 1.8 },
];

const NumberPresetField: React.FC<{
  label: string;
  value?: number;
  presets: { label: string; value: number }[];
  step?: number;
  onChange: (value: number | undefined) => void;
}> = ({ label, value, presets, step = 1, onChange }) => {
  const [customSelected, setCustomSelected] = useState(false);
  const custom = customSelected || (value !== undefined && !presets.some((preset) => preset.value === value));
  return (
    <div>
      <Row>
        <RowLabel>{label}</RowLabel>
        <Select
          value={custom ? 'custom' : value === undefined ? '' : String(value)}
          onChange={(event) => {
            const selected = event.target.value;
            setCustomSelected(selected === 'custom');
            if (selected !== 'custom') onChange(parseNumber(selected));
          }}
        >
          <option value="">Original</option>
          {presets.map((preset) => <option key={preset.value} value={preset.value}>{preset.label}</option>)}
          <option value="custom">Custom</option>
        </Select>
      </Row>
      {custom && (
        <Row>
          <RowLabel>Custom {label.toLowerCase()}</RowLabel>
          <Input
            type="number"
            placeholder="Original"
            min={step}
            step={step}
            value={value ?? ''}
            onChange={(event) => {
              const next = parseNumber(event.target.value);
              if (next === undefined) setCustomSelected(false);
              onChange(next);
            }}
          />
        </Row>
      )}
    </div>
  );
};

type TextStylingSpec = Pick<UserPresentationSpec, 'size' | 'font' | 'lineSpacing' | 'alignment' | 'color' | 'contrast'>;

const TextStyleFields: React.FC<{
  presentation: TextStylingSpec;
  onChange: (patch: Partial<TextStylingSpec>) => void;
  isVisible?: (key: PersonalizationFieldKey) => boolean;
}> = ({ presentation, onChange: patchPresentation, isVisible = () => true }) => (
  <>
    {isVisible('presentation.size') && (
      <NumberPresetField
        label="Font size"
        value={presentation.size}
        presets={FONT_SIZE_PRESETS}
        onChange={(size) => patchPresentation({ size })}
      />
    )}
    {isVisible('presentation.font') && (
      <Row>
        <RowLabel>Font</RowLabel>
        <Select
          value={presentation.font ?? ''}
          onChange={(e) => patchPresentation({ font: (e.target.value || undefined) as UserPresentationSpec['font'] })}
        >
          <option value="">Original</option>
          {['sans', 'serif', 'monospace', 'neutral', 'grotesque', 'condensed', 'hyperlegible', 'lexend', 'dyslexia', 'verdana'].map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </Select>
      </Row>
    )}
    {isVisible('presentation.lineSpacing') && (
      <NumberPresetField
        label="Line spacing"
        value={presentation.lineSpacing}
        presets={LINE_SPACING_PRESETS}
        step={0.1}
        onChange={(lineSpacing) => patchPresentation({ lineSpacing })}
      />
    )}
    {isVisible('presentation.alignment') && (
      <Row>
        <RowLabel>Alignment</RowLabel>
        <Select
          value={presentation.alignment ?? ''}
          onChange={(e) => patchPresentation({ alignment: (e.target.value || undefined) as UserPresentationSpec['alignment'] })}
        >
          <option value="">Original</option>
          {['left', 'center', 'justify'].map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </Select>
      </Row>
    )}
    {isVisible('presentation.contrast') && (
      <Row>
        <RowLabel>Contrast</RowLabel>
        <Select
          value={presentation.contrast ?? ''}
          onChange={(e) => patchPresentation({ contrast: (e.target.value || undefined) as UserPresentationSpec['contrast'] })}
        >
          <option value="">Original</option>
          {['low', 'medium', 'high'].map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </Select>
      </Row>
    )}
    {isVisible('presentation.color') && (
      <ColorField value={presentation.color} onChange={(color) => patchPresentation({ color })} />
    )}
  </>
);

export const PersonalizationEditor: React.FC<Props> = ({ value, onChange, label, defaultOpen, suggestedFields }) => {
  const [open, setOpen] = useState<boolean>(defaultOpen ?? !isPersonalizationSpecEmpty(value));
  const [showAll, setShowAll] = useState(false);
  const spec = value ?? {};
  const presentation = spec.presentation ?? {};
  const modality = spec.modality ?? {};
  const speechOutputEnabled = (modality.outputModalities ?? []).includes('speech');
  const content = spec.content ?? {};
  const guiPresentation = spec.gui?.presentation ?? {};
  const guiContent = spec.gui?.content ?? {};
  const active = !isPersonalizationSpecEmpty(value);

  // Whether a "show all / recommended" toggle should appear.
  // Only when a non-trivial suggested subset is defined (not when all fields are recommended).
  const hasSuggestions =
    suggestedFields !== undefined && suggestedFields.length < ALL_PERSONALIZATION_FIELDS.length;

  /** True when the field already carries a user-set value (always show regardless of filtering). */
  const hasActiveValue = (key: PersonalizationFieldKey): boolean => {
    switch (key) {
      case 'presentation.language': return !!presentation.language && presentation.language !== 'original';
      case 'presentation.style': return !!presentation.style && presentation.style !== 'original';
      case 'presentation.languageComplexity': return !!presentation.languageComplexity && presentation.languageComplexity !== 'original';
      case 'presentation.sentenceLength': return !!presentation.sentenceLength && presentation.sentenceLength !== 'original';
      case 'presentation.useAbbreviations': return !!presentation.useAbbreviations;
      case 'content.adaptContentToUserProfile': return !!content.adaptContentToUserProfile;
      case 'presentation.size': return presentation.size !== undefined;
      case 'presentation.font': return !!presentation.font;
      case 'presentation.lineSpacing': return presentation.lineSpacing !== undefined;
      case 'presentation.alignment': return !!presentation.alignment;
      case 'presentation.color': return !!presentation.color;
      case 'presentation.contrast': return !!presentation.contrast;
      case 'modality.inputModalities': return (modality.inputModalities ?? []).length > 0;
      case 'modality.outputModalities': return (modality.outputModalities ?? []).length > 0;
      case 'modality.voiceGender': return !!modality.voiceGender;
      case 'modality.voiceSpeed': return modality.voiceSpeed !== undefined;
      default: return false;
    }
  };

  /**
   * Whether to render a given field control.
   * - No `suggestedFields` → always show.
   * - `showAll` mode → always show.
   * - Otherwise: show only if the field is in the suggested list, or it already has a value.
   */
  const isVisible = (key: PersonalizationFieldKey): boolean => {
    if (showAll || !suggestedFields) return true;
    return suggestedFields.includes(key) || hasActiveValue(key);
  };

  // Section-level visibility: hide a section entirely when none of its fields would render.
  const section1Visible = (
    ['presentation.language', 'presentation.style', 'presentation.languageComplexity',
     'presentation.sentenceLength', 'presentation.useAbbreviations',
     'presentation.size', 'presentation.font', 'presentation.lineSpacing',
     'presentation.alignment', 'presentation.contrast', 'presentation.color'] as PersonalizationFieldKey[]
  ).some(isVisible);

  const interfaceVisible = (
    ['presentation.size', 'presentation.font', 'presentation.lineSpacing',
     'presentation.alignment', 'presentation.contrast', 'presentation.color'] as PersonalizationFieldKey[]
  ).some(isVisible);

  const section2Visible = isVisible('content.adaptContentToUserProfile');
  const section3Visible = (
    ['modality.inputModalities', 'modality.outputModalities',
     'modality.voiceGender', 'modality.voiceSpeed'] as PersonalizationFieldKey[]
  ).some(isVisible);

  const patchPresentation = (patch: Partial<UserPresentationSpec>) =>
    onChange(clean({ ...spec, presentation: { ...presentation, ...patch } }));
  const patchModality = (patch: Partial<UserModalitySpec>) =>
    onChange(clean({ ...spec, modality: { ...modality, ...patch } }));
  const patchContent = (patch: Partial<UserContentSpec>) =>
    onChange(clean({ ...spec, content: { ...content, ...patch } }));

  const patchGuiPresentation = (patch: Partial<UserGuiPresentationSpec>) =>
    onChange(clean({ ...spec, gui: { ...spec.gui, presentation: { ...guiPresentation, ...patch } } }));
  const patchGuiContent = (patch: Partial<NonNullable<NonNullable<UserPersonalizationSpec['gui']>['content']>>) =>
    onChange(clean({ ...spec, gui: { ...spec.gui, content: { ...guiContent, ...patch } } }));

  return (
    <Wrapper>
      <ToggleButton
        type="button"
        active={active}
        onClick={() => setOpen((o) => !o)}
        title="Configure agent and GUI personalization for this user group"
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ opacity: 0.7, fontSize: 12, lineHeight: 1 }}>✦</span>
          {label ?? 'Personalization'}
          {active && <Dot />}
        </span>
        <span style={{ opacity: 0.55, fontSize: 11 }}>{open ? '▾' : '▸'}</span>
      </ToggleButton>
      <ButtonDescription>
        Define agent and GUI personalization separately for this user group.
        {' '}Original keeps the current setting. Choose another option or enter a value to change it.
      </ButtonDescription>

      {open && (
        <div style={{ marginTop: 6 }}>
          <TargetSection aria-label="Agent personalization">
            <TargetTitle>AGENT</TargetTitle>
            {/* Section 1: language/style/complexity + interface styling */}
            {section1Visible && (
              <Section>
                <SectionTitle>Presentation</SectionTitle>
                {isVisible('presentation.language') && (
                  <Row>
                    <RowLabel>Language</RowLabel>
                    <Select
                      value={presentation.language ?? CONTENT_DEFAULT}
                      onChange={(e) => patchPresentation({ language: (e.target.value || undefined) as UserPresentationSpec['language'] })}
                    >
                      {LANGUAGE_OPTIONS.map((v) => (
                        <option key={v} value={v}>{v === 'original' ? 'Original' : v}</option>
                      ))}
                    </Select>
                  </Row>
                )}
                {isVisible('presentation.style') && (
                  <Row>
                    <RowLabel>Style</RowLabel>
                    <Select
                      value={presentation.style ?? CONTENT_DEFAULT}
                      onChange={(e) => patchPresentation({ style: (e.target.value || undefined) as UserPresentationSpec['style'] })}
                    >
                      {['original', 'formal', 'informal'].map((v) => (
                        <option key={v} value={v}>{v === 'original' ? 'Original' : v}</option>
                      ))}
                    </Select>
                  </Row>
                )}
                {isVisible('presentation.languageComplexity') && (
                  <Row>
                    <RowLabel>Language complexity</RowLabel>
                    <Select
                      value={presentation.languageComplexity ?? CONTENT_DEFAULT}
                      onChange={(e) => patchPresentation({ languageComplexity: (e.target.value || undefined) as UserPresentationSpec['languageComplexity'] })}
                    >
                      {['original', 'simple', 'medium', 'complex'].map((v) => (
                        <option key={v} value={v}>{v === 'original' ? 'Original' : v}</option>
                      ))}
                    </Select>
                  </Row>
                )}
                {isVisible('presentation.sentenceLength') && (
                  <Row>
                    <RowLabel>Sentence length</RowLabel>
                    <Select
                      value={presentation.sentenceLength ?? CONTENT_DEFAULT}
                      onChange={(e) => patchPresentation({ sentenceLength: (e.target.value || undefined) as UserPresentationSpec['sentenceLength'] })}
                    >
                      {SENTENCE_LENGTH_OPTIONS.map((v) => (
                        <option key={v} value={v}>{v === 'original' ? 'Original' : v}</option>
                      ))}
                    </Select>
                  </Row>
                )}
                {isVisible('presentation.useAbbreviations') && (
                  <Row>
                    <RowLabel>Use abbreviations</RowLabel>
                    <input
                      type="checkbox"
                      checked={presentation.useAbbreviations ?? false}
                      onChange={(e) => patchPresentation({ useAbbreviations: e.target.checked || undefined })}
                    />
                  </Row>
                )}

                {interfaceVisible && (
                  <>
                    <SubTitle>Interface</SubTitle>
                    <TextStyleFields
                      presentation={presentation}
                      onChange={patchPresentation}
                      isVisible={isVisible}
                    />
                  </>
                )}
              </Section>
            )}
            {section1Visible && (section2Visible || section3Visible) && <Divider />}

            {/* Section 2: adapt content flag */}
            {section2Visible && (
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
                <div style={{ opacity: 0.6, fontSize: 12, marginTop: 2 }}>
                  When enabled, the agent tailors its responses to this profile.
                </div>
              </Section>
            )}
            {section2Visible && section3Visible && <Divider />}

            {/* Section 3: modality */}
            {section3Visible && (
              <Section>
                <SectionTitle>Modality</SectionTitle>
                {isVisible('modality.inputModalities') && (
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
                )}
                {isVisible('modality.outputModalities') && (
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
                )}
                {!speechOutputEnabled && (isVisible('modality.voiceGender') || isVisible('modality.voiceSpeed')) && (
                  <ButtonDescription>Enable speech in Output to set voice gender and voice speed.</ButtonDescription>
                )}
                {isVisible('modality.voiceGender') && (
                  <Row style={{ opacity: speechOutputEnabled ? 1 : 0.45 }}>
                    <RowLabel>Voice gender</RowLabel>
                    <Select
                      disabled={!speechOutputEnabled}
                      title={speechOutputEnabled ? undefined : 'Enable speech in Output to set voice gender.'}
                      value={modality.voiceGender ?? ''}
                      onChange={(e) => patchModality({ voiceGender: (e.target.value || undefined) as UserModalitySpec['voiceGender'] })}
                    >
                      <option value="">Original</option>
                      {['male', 'female', 'ambiguous'].map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </Select>
                  </Row>
                )}
                {isVisible('modality.voiceSpeed') && (
                  <Row style={{ opacity: speechOutputEnabled ? 1 : 0.45 }}>
                    <RowLabel>Voice speed</RowLabel>
                    <Input
                      disabled={!speechOutputEnabled}
                      title={speechOutputEnabled ? undefined : 'Enable speech in Output to set voice speed.'}
                      type="number"
                      placeholder="Original"
                      step="0.1"
                      value={modality.voiceSpeed ?? ''}
                      onChange={(e) => patchModality({ voiceSpeed: parseNumber(e.target.value) })}
                    />
                  </Row>
                )}
              </Section>
            )}

            {/* Show all / recommended toggle — only when a non-trivial filter is active */}
            {hasSuggestions && (
              <ShowAllToggle type="button" onClick={() => setShowAll((v) => !v)}>
                {showAll ? '▲ Show recommended only' : '▼ Show all options'}
              </ShowAllToggle>
            )}
          </TargetSection>
          <TargetSection aria-label="GUI personalization">
            <TargetTitle>GUI</TargetTitle>
            <Section>
              <SectionTitle>Presentation</SectionTitle>
              <Row>
                <RowLabel>Language</RowLabel>
                <Select
                  value={guiPresentation.language ?? 'original'}
                  onChange={(event) => patchGuiPresentation({ language: event.target.value === 'original' ? undefined : event.target.value as UserGuiPresentationSpec['language'] })}
                >
                  {LANGUAGE_OPTIONS.map((language) => (
                    <option key={language} value={language}>{language === 'original' ? 'Original' : language}</option>
                  ))}
                </Select>
              </Row>
              <Row>
                <RowLabel>Text complexity</RowLabel>
                <Select
                  value={guiPresentation.languageComplexity ?? 'original'}
                  onChange={(event) => patchGuiPresentation({ languageComplexity: event.target.value === 'simple' ? 'simple' : undefined })}
                >
                  <option value="original">Original</option>
                  <option value="simple">Simple text</option>
                </Select>
              </Row>
              <Row>
                <RowLabel>Sentence length</RowLabel>
                <Select
                  value={guiPresentation.sentenceLength ?? 'original'}
                  onChange={(event) => patchGuiPresentation({ sentenceLength: event.target.value === 'original' ? undefined : event.target.value as UserGuiPresentationSpec['sentenceLength'] })}
                >
                  {SENTENCE_LENGTH_OPTIONS.map((length) => (
                    <option key={length} value={length}>{length === 'original' ? 'Original' : length}</option>
                  ))}
                </Select>
              </Row>
              <ButtonDescription>Language, Simple text, and sentence length use an LLM to adapt wording while keeping its meaning.</ButtonDescription>
              <SubTitle>Text styling</SubTitle>
              <TextStyleFields presentation={guiPresentation} onChange={patchGuiPresentation} />
            </Section>
            <Section>
              <SectionTitle>Content</SectionTitle>
              <CheckRow style={{ alignItems: 'flex-start' }}>
                <RowLabel style={{ whiteSpace: 'normal' }}>Adapt content to this user profile</RowLabel>
                <input
                  type="checkbox"
                  aria-label="Adapt content to this user profile"
                  checked={guiContent.adaptContentToUserProfile ?? false}
                  onChange={(event) => patchGuiContent({ adaptContentToUserProfile: event.target.checked || undefined })}
                />
              </CheckRow>
              <ButtonDescription>Use an LLM to review each component and adapt relevant content to this profile, using information already available on the page.</ButtonDescription>
              <CheckRow as="label" style={{ alignItems: 'flex-start' }}>
                <RowLabel style={{ whiteSpace: 'normal' }}>Summarize long content</RowLabel>
                <input
                  type="checkbox"
                  checked={guiContent.summarizeLongContent ?? false}
                  onChange={(event) => patchGuiContent({ summarizeLongContent: event.target.checked || undefined })}
                />
              </CheckRow>
              <ButtonDescription>Add a short, easy-to-understand summary above text blocks of 150 words or more. The full text stays available. Uses an LLM.</ButtonDescription>
            </Section>
            <Section>
              <SectionTitle>Modality</SectionTitle>
              <CheckRow as="label">
                <RowLabel>Read text aloud</RowLabel>
                <input type="checkbox" checked={spec.gui?.modality?.readAloud ?? false}
                  onChange={(event) => onChange(clean({ ...spec, gui: { ...spec.gui, modality: { readAloud: event.target.checked || undefined } } }))} />
              </CheckRow>
              <ButtonDescription>Show Play controls below text blocks and summaries after applying GUI rules. Click Play to generate and listen to a temporary preview. The exported app also includes listening controls.</ButtonDescription>
            </Section>
          </TargetSection>
        </div>
      )}
    </Wrapper>
  );
};
