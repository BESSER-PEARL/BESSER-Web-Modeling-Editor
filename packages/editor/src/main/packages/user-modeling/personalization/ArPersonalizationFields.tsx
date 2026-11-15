import React from 'react';
import type { UserArPersonalizationSpec } from '../personalization-spec';

interface Props {
  value?: UserArPersonalizationSpec;
  onChange: (value: UserArPersonalizationSpec | undefined) => void;
}

/** Profile settings only: applying these to an AR application is a future step. */
export const ArPersonalizationFields: React.FC<Props> = ({ value, onChange }) => {
  const spec = value ?? {};
  const update = (dimension: keyof UserArPersonalizationSpec, field: string, next: unknown) => {
    const entries: Record<string, unknown> = { ...spec[dimension], [field]: next };
    if (dimension === 'presentation' && field === 'augmentationColor') {
      if (next === 'custom') entries.customAugmentationColor = spec.presentation?.customAugmentationColor ?? '#ffffff';
      else delete entries.customAugmentationColor;
    }
    const populated = Object.fromEntries(Object.entries(entries).filter(([, v]) => v !== undefined));
    const result = { ...spec, [dimension]: Object.keys(populated).length ? populated : undefined };
    onChange(Object.values(result).some(Boolean) ? result : undefined);
  };
  const row: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, margin: '6px 0' };
  const select: React.CSSProperties = { maxWidth: 150, color: 'inherit', background: 'transparent', border: '1px solid #888', borderRadius: 4, padding: '3px 6px' };
  return (
    <div>
      <p style={{ fontSize: 12, margin: '0 0 8px', opacity: 0.8 }}>
        Save preferences for an AR experience. AI-assisted options need a future personalization service.
      </p>
      <label style={row}>
        <span>Instruction language (AI)</span>
        <select style={select} value={spec.content?.language ?? 'original'} onChange={(e) => update('content', 'language', e.target.value === 'original' ? undefined : e.target.value)}>
          {['original', 'english', 'spanish', 'french', 'german', 'portuguese', 'luxembourgish', 'italian'].map((language) => <option key={language} value={language}>{language === 'original' ? 'Original' : language}</option>)}
        </select>
      </label>
      <label style={row}>
        <span>Simplify instructions (AI)</span>
        <input type="checkbox" checked={spec.content?.simplifyInstructions ?? false} onChange={(e) => update('content', 'simplifyInstructions', e.target.checked || undefined)} />
      </label>
      <label style={row}>
        <span>Instruction size</span>
        <select style={select} value={spec.presentation?.instructionScale ?? ''} onChange={(e) => update('presentation', 'instructionScale', e.target.value ? Number(e.target.value) : undefined)}>
          <option value="">Original</option><option value="1.25">Large (1.25×)</option><option value="1.5">Extra large (1.5×)</option>
        </select>
      </label>
      <label style={row}>
        <span>Instruction contrast</span>
        <select style={select} value={spec.presentation?.contrast ?? ''} onChange={(e) => update('presentation', 'contrast', e.target.value || undefined)}>
          <option value="">Original</option><option value="high">High contrast</option>
        </select>
      </label>
      <label style={row}>
        <span>Augmentation size</span>
        <select style={select} value={spec.presentation?.augmentationScale ?? ''} onChange={(e) => update('presentation', 'augmentationScale', e.target.value ? Number(e.target.value) : undefined)}>
          <option value="">Original</option><option value="1.25">Large (1.25?)</option><option value="1.5">Extra large (1.5?)</option>
        </select>
      </label>
      <label style={row}>
        <span>Augmentation colors</span>
        <select style={select} value={spec.presentation?.augmentationColor ?? ''} onChange={(e) => update('presentation', 'augmentationColor', e.target.value || undefined)}>
          <option value="">Original</option><option value="highContrast">High contrast</option><option value="custom">Custom color</option>
        </select>
      </label>
      {spec.presentation?.augmentationColor === 'custom' && (
        <label style={row}>
          <span>Custom augmentation color</span>
          <input type="color" value={spec.presentation.customAugmentationColor ?? '#ffffff'} onChange={(e) => update('presentation', 'customAugmentationColor', e.target.value)} />
        </label>
      )}
      <label style={row}>
        <span>Preferred interaction</span>
        <select style={select} value={spec.modality?.preferredInteraction ?? ''} onChange={(e) => update('modality', 'preferredInteraction', e.target.value || undefined)}>
          <option value="">Original</option><option value="click">Click</option><option value="voice">Voice</option><option value="detect">Object detection</option>
        </select>
      </label>
      <label style={row}>
        <span>Confirm each step</span>
        <input type="checkbox" checked={spec.behavior?.stepConfirmation ?? false} onChange={(e) => update('behavior', 'stepConfirmation', e.target.checked || undefined)} />
      </label>
      <label style={row}>
        <span>Offer audio instructions</span>
        <input type="checkbox" checked={spec.modality?.audioInstructions ?? false} onChange={(e) => update('modality', 'audioInstructions', e.target.checked || undefined)} />
      </label>
    </div>
  );
};
