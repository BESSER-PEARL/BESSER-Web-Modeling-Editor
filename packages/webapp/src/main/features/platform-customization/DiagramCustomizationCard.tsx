/**
 * DiagramCustomizationCard
 * ------------------------
 * Preset buttons ("Light theme", "Dark theme") that bulk-fill class and
 * association overrides in one click.
 *
 * Grid / background / theme / edge-routing are no longer set here — they live
 * in the generated platform's runtime Settings popover so the operator can
 * change them without regenerating.  The `PlatformDiagramOverride` fields are
 * still persisted (to seed the runtime defaults) but have no UI binding here.
 */

import React from 'react';
import { Palette, Sparkles, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type {
  PlatformAssociationOverride,
  PlatformClassOverride,
  PlatformCustomizationData,
  PlatformDiagramOverride,
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
  onApplyPreset,
}) => {
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
            title="Apply the Light theme preset to all classes and associations"
          >
            <Sparkles className="size-3.5" /> Light theme
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onApplyPreset('dark')}
            title="Apply the Dark theme preset to all classes and associations"
          >
            <Moon className="size-3.5" /> Dark theme
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">
          Use the preset buttons above to bulk-apply a color scheme to all classes and associations.
          Grid, background, theme, and edge-routing defaults can be changed at runtime inside the
          generated platform via the Settings menu.
        </p>
      </CardContent>
    </Card>
  );
};

// ---------------------------------------------------------------------------
// Preset application
// ---------------------------------------------------------------------------

/** Build the customization payload for a named preset, applied to *all* class
 * and association names extracted from the referenced ClassDiagram. Existing
 * per-class / per-association overrides are merged on top, so the user keeps
 * their explicit edits.
 *
 * Diagram-level fields (theme, backgroundColor, gridSize, etc.) are included
 * so they seed the runtime Settings popover defaults — but no BESSER UI binds
 * to them directly any more. */
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
