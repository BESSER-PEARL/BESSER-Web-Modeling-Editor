import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface PaletteDropdownProps {
  palettes: string[][];
  value: number;
  onChange: (paletteIndex: number) => void;
}

const Swatches: React.FC<{ colors: string[] }> = ({ colors }) => (
  <span className="flex gap-0.5" aria-hidden="true">
    {colors.map((color, i) => (
      <span key={i} className="inline-block size-[18px] rounded-[3px] border border-border" style={{ background: color }} />
    ))}
  </span>
);

export const PaletteDropdown: React.FC<PaletteDropdownProps> = ({ palettes, value, onChange }) => {
  const { t } = useTranslation();
  const [selected, setSelected] = useState(value);

  return (
    <Select
      value={String(selected)}
      onValueChange={(next) => {
        const idx = Number(next);
        setSelected(idx);
        onChange(idx);
      }}
    >
      <SelectTrigger className="h-8 w-[180px] px-2.5" aria-label={t('editors.gui.colorPalette')}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {palettes.map((palette, idx) => (
          <SelectItem
            key={idx}
            value={String(idx)}
            aria-label={t('editors.gui.colorPaletteOption', { index: idx + 1 })}
          >
            <Swatches colors={palette} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
