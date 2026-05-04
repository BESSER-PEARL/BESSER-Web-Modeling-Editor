/**
 * DiagramCustomizationCard
 * ------------------------
 * Diagram-level overrides: background color, grid visibility / size, snap-to-grid,
 * theme. Two preset buttons ("Light theme", "Dark theme") bulk-fill class /
 * association overrides + the diagram-level theme in one click.
 */

import React from 'react';
import { Palette, Sparkles, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type {
  PlatformAssociationOverride,
  PlatformClassOverride,
  PlatformCustomizationData,
  PlatformDiagramOverride,
  ThemeName,
} from '../../shared/types/project';

export type Preset = 'light' | 'dark';

interface DiagramCustomizationCardProps {
  classNames: string[];
  associationNames: string[];
  customization: PlatformCustomizationData;
  onPatch: (patch: Partial<PlatformDiagramOverride>) => void;
  onApplyPreset: (preset: Preset) => void;
}

export const DiagramCustomizationCard: React.FC<DiagramCustomizationCardProps> = ({
  customization,
  onPatch,
  onApplyPreset,
}) => {
  const diagram = customization.diagramCustomization ?? {};

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Palette className="size-4 text-brand" />
          Diagram
        </CardTitle>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onApplyPreset('light')}
            title="Apply the Light theme preset"
          >
            <Sparkles className="size-3.5" /> Light theme
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onApplyPreset('dark')}
            title="Apply the Dark theme preset"
          >
            <Moon className="size-3.5" /> Dark theme
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <ThemeRow
          value={diagram.theme}
          onChange={(v) => onPatch({ theme: v })}
        />
        <BgColorRow
          value={diagram.backgroundColor}
          onChange={(v) => onPatch({ backgroundColor: v })}
        />
        <SwitchRow
          label="Grid visible"
          checked={diagram.gridVisible !== false}
          onChange={(v) => onPatch({ gridVisible: v })}
        />
        <SwitchRow
          label="Snap to grid"
          checked={!!diagram.snapToGrid}
          onChange={(v) => onPatch({ snapToGrid: v })}
        />
        <SliderRow
          label="Grid size"
          value={diagram.gridSize ?? 24}
          min={8}
          max={64}
          step={2}
          unit="px"
          onChange={(v) => onPatch({ gridSize: v })}
        />
      </CardContent>
    </Card>
  );
};

const ThemeRow: React.FC<{
  value?: ThemeName;
  onChange: (v: ThemeName | undefined) => void;
}> = ({ value, onChange }) => (
  <div className="flex flex-col gap-1.5">
    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Theme</Label>
    <Select
      value={value ?? 'auto'}
      onValueChange={(v) => onChange(v === 'auto' ? undefined : (v as ThemeName))}
    >
      <SelectTrigger className="h-8 text-sm">
        <SelectValue placeholder="Auto" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="auto">Auto (follow OS)</SelectItem>
        <SelectItem value="light">Light</SelectItem>
        <SelectItem value="dark">Dark</SelectItem>
      </SelectContent>
    </Select>
  </div>
);

const BgColorRow: React.FC<{ value?: string; onChange: (v: string | undefined) => void }> = ({
  value,
  onChange,
}) => (
  <div className="flex flex-col gap-1.5">
    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Background</Label>
    <div className="flex items-center gap-2">
      <input
        type="color"
        className="h-8 w-12 cursor-pointer rounded-md border border-input bg-background"
        value={/^#[0-9a-fA-F]{6}$/.test(value ?? '') ? value! : '#fafafa'}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Background color"
      />
      <button
        type="button"
        className="text-xs text-muted-foreground hover:text-foreground"
        onClick={() => onChange(undefined)}
        title="Reset to theme default"
      >
        clear
      </button>
    </div>
  </div>
);

const SwitchRow: React.FC<{
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}> = ({ label, checked, onChange }) => (
  <div className="flex items-center justify-between gap-3">
    <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
    <Switch checked={checked} onCheckedChange={onChange} />
  </div>
);

const SliderRow: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (v: number) => void;
}> = ({ label, value, min, max, step, unit, onChange }) => (
  <div className="col-span-full flex flex-col gap-1.5">
    <div className="flex items-center justify-between">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      <span className="text-xs tabular-nums text-muted-foreground">
        {value}
        {unit}
      </span>
    </div>
    <Slider
      value={[value]}
      min={min}
      max={max}
      step={step}
      onValueChange={(arr: number[]) => onChange(arr[0])}
      aria-label={label}
    />
  </div>
);

// ---------------------------------------------------------------------------
// Preset application
// ---------------------------------------------------------------------------

/** Build the customization payload for a named preset, applied to *all* class
 * and association names extracted from the referenced ClassDiagram. Existing
 * per-class / per-association overrides are merged on top, so the user keeps
 * their explicit edits. */
export function buildPresetCustomization(
  preset: Preset,
  classNames: string[],
  associationNames: string[],
  current: PlatformCustomizationData,
): PlatformCustomizationData {
  const isDark = preset === 'dark';
  const baseClass: PlatformClassOverride = isDark
    ? {
        nodeShape: 'rounded_rect',
        fillColor: '#1f2937',
        borderColor: '#60a5fa',
        borderWidth: 2,
        borderStyle: 'solid',
        borderRadius: 12,
        fontSize: 13,
        fontWeight: 'bold',
        fontColor: '#f1f5f9',
      }
    : {
        nodeShape: 'rounded_rect',
        fillColor: '#ffffff',
        borderColor: '#0d9488',
        borderWidth: 2,
        borderStyle: 'solid',
        borderRadius: 12,
        fontSize: 13,
        fontWeight: 'bold',
        fontColor: '#0f172a',
      };

  const baseAssoc: PlatformAssociationOverride = isDark
    ? {
        edgeColor: '#94a3b8',
        lineWidth: 2,
        lineStyle: 'solid',
        targetArrowStyle: 'filled_triangle',
        labelVisible: true,
        labelFontSize: 11,
        labelFontColor: '#cbd5e1',
      }
    : {
        edgeColor: '#475569',
        lineWidth: 2,
        lineStyle: 'solid',
        targetArrowStyle: 'filled_triangle',
        labelVisible: true,
        labelFontSize: 11,
        labelFontColor: '#475569',
      };

  const diagram: PlatformDiagramOverride = isDark
    ? { theme: 'dark', gridVisible: true, gridSize: 24, snapToGrid: false, backgroundColor: '#0f172a' }
    : { theme: 'light', gridVisible: true, gridSize: 24, snapToGrid: false, backgroundColor: '#fafafa' };

  const classOverrides = { ...current.classOverrides };
  for (const name of classNames) {
    classOverrides[name] = { ...baseClass, ...current.classOverrides[name] };
  }
  const associationOverrides = { ...current.associationOverrides };
  for (const name of associationNames) {
    associationOverrides[name] = { ...baseAssoc, ...current.associationOverrides[name] };
  }

  return {
    ...current,
    classOverrides,
    associationOverrides,
    diagramCustomization: { ...current.diagramCustomization, ...diagram },
  };
}
