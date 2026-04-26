/**
 * PlatformCustomizationPanel
 * ==========================
 *
 * Form-based editor for the visual overrides consumed by the BESSER
 * `PlatformGenerator`. Reads class / association names from the referenced
 * ClassDiagram and exposes:
 *
 *   - per-class: container flag, default size, node shape, fill / border /
 *     font, label position
 *   - per-association: edge color, line width / style, source + target arrow
 *     style, label visibility / size / color
 *   - diagram-level: background color, grid visible / size, snap-to-grid,
 *     theme — plus two presets that bulk-fill class & association overrides
 *
 * Each class / association row is a Collapsible. Edits dispatch
 * `updateDiagramModelThunk` immediately and persist to ProjectStorageRepository.
 */

import React, { useCallback, useMemo } from 'react';
import { AlertTriangle, ChevronDown, Eye, EyeOff, Sliders } from 'lucide-react';
import type { UMLModel } from '@besser/wme';
import { useAppDispatch, useAppSelector } from '../../app/store/hooks';
import {
  selectActiveDiagramIndex,
  selectDiagramsForActiveType,
  selectProject,
  updateDiagramModelThunk,
} from '../../app/store/workspaceSlice';
import {
  ArrowStyleName,
  createEmptyPlatformCustomizationData,
  FontWeightName,
  getReferencedDiagram,
  isPlatformCustomizationData,
  isUMLModel,
  LabelPositionName,
  LineStyleName,
  NodeShape,
  PlatformAssociationOverride,
  PlatformClassOverride,
  PlatformCustomizationData,
  PlatformDiagramOverride,
  ProjectDiagram,
} from '../../shared/types/project';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  buildPresetCustomization,
  DiagramCustomizationCard,
  Preset,
} from './DiagramCustomizationCard';
import { ClassNodePreview, EdgeStylePreview } from './nodePreview';
import { COLOR_SWATCHES, hasLowContrast } from './colorSwatches';

// ---------------------------------------------------------------------------
// Class / association extraction
// ---------------------------------------------------------------------------

interface ClassInfo {
  name: string;
  /** Raw SVG markup attached to the class via the metadata icon picker, if any. */
  icon?: string;
}

function extractClasses(model: UMLModel): ClassInfo[] {
  const byName = new Map<string, ClassInfo>();
  for (const el of Object.values(model.elements ?? {})) {
    if ((el as any)?.owner !== null) continue;
    if (typeof el?.name !== 'string' || el.name.trim() === '') continue;
    const icon = typeof (el as any)?.icon === 'string' ? (el as any).icon : undefined;
    // Last write wins if the diagram somehow has two classes with the same name —
    // the platform generator keys overrides by name anyway, so this matches its
    // semantics.
    byName.set(el.name, { name: el.name, icon });
  }
  return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name));
}

interface AssociationInfo {
  name: string;
  /** Union of class names that participate in any same-named relationship. */
  endpointClassNames: string[];
}

function extractAssociations(model: UMLModel): AssociationInfo[] {
  const elements = model.elements ?? {};
  const resolveClassName = (elementId: string | undefined): string | undefined => {
    if (!elementId) return undefined;
    const el = elements[elementId];
    if (!el || typeof (el as any).name !== 'string') return undefined;
    return (el as any).name;
  };
  const byName = new Map<string, Set<string>>();
  for (const rel of Object.values(model.relationships ?? {})) {
    if (typeof rel?.name !== 'string' || rel.name.trim() === '') continue;
    const set = byName.get(rel.name) ?? new Set<string>();
    const sourceName = resolveClassName((rel as any)?.source?.element);
    const targetName = resolveClassName((rel as any)?.target?.element);
    if (sourceName) set.add(sourceName);
    if (targetName) set.add(targetName);
    byName.set(rel.name, set);
  }
  return Array.from(byName.entries())
    .map(([name, set]) => ({ name, endpointClassNames: Array.from(set) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

const EmptyState: React.FC<{ title: string; message: string }> = ({ title, message }) => (
  <div className="flex items-start gap-3 rounded-md border border-amber-500/50 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-100">
    <AlertTriangle className="mt-0.5 size-5 flex-shrink-0" />
    <div>
      <div className="font-semibold">{title}</div>
      <div className="text-xs text-amber-800 dark:text-amber-200">{message}</div>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Reusable controls
// ---------------------------------------------------------------------------

const ColorPicker: React.FC<{
  value?: string;
  onChange: (v: string | undefined) => void;
  label?: string;
}> = ({ value, onChange, label }) => (
  <div className="flex items-center gap-2">
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label ?? 'Pick color'}
          className="size-7 rounded-md border border-input shadow-sm"
          style={{ backgroundColor: value ?? 'transparent' }}
          title={value ?? 'No color set'}
        />
      </PopoverTrigger>
      <PopoverContent className="w-56">
        <div className="grid grid-cols-4 gap-2">
          {COLOR_SWATCHES.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => onChange(s.value)}
              className="flex h-8 items-center justify-center rounded border border-input transition-transform hover:scale-105"
              style={{ backgroundColor: s.value }}
              title={s.name}
              aria-label={s.name}
            />
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <input
            type="color"
            className="h-8 w-12 cursor-pointer rounded-md border border-input bg-background"
            value={/^#[0-9a-fA-F]{6}$/.test(value ?? '') ? value! : '#3b82f6'}
            onChange={(e) => onChange(e.target.value)}
          />
          <Input
            type="text"
            placeholder="#22c55e or hsl(...)"
            className="h-8 text-xs"
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value === '' ? undefined : e.target.value)}
          />
        </div>
        <button
          type="button"
          className="mt-3 w-full text-xs text-muted-foreground hover:text-foreground"
          onClick={() => onChange(undefined)}
        >
          Clear
        </button>
      </PopoverContent>
    </Popover>
  </div>
);

const SliderField: React.FC<{
  label: string;
  value: number | undefined;
  defaultValue: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number | undefined) => void;
}> = ({ label, value, defaultValue, min, max, step = 1, unit, onChange }) => {
  const v = value ?? defaultValue;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
        <span className="text-xs tabular-nums text-muted-foreground">
          {v}
          {unit}
          {value === undefined && <span className="ml-1 italic">(default)</span>}
        </span>
      </div>
      <Slider
        value={[v]}
        min={min}
        max={max}
        step={step}
        onValueChange={(arr: number[]) => onChange(arr[0])}
        aria-label={label}
      />
    </div>
  );
};

const SelectField: React.FC<{
  label: string;
  value: string | undefined;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  onChange: (v: string | undefined) => void;
}> = ({ label, value, options, placeholder = 'Default', onChange }) => (
  <div className="flex flex-col gap-1.5">
    <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
    <Select
      value={value ?? '__default__'}
      onValueChange={(v) => onChange(v === '__default__' ? undefined : v)}
    >
      <SelectTrigger className="h-8 text-sm">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__default__">Default</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
);

const ColorField: React.FC<{
  label: string;
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  contrastAgainst?: string;
}> = ({ label, value, onChange, contrastAgainst }) => {
  const lowContrast = contrastAgainst ? hasLowContrast(value, contrastAgainst) : false;
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
        {label}
        {lowContrast && (
          <span title="Low contrast (< 3.0)">
            <AlertTriangle className="size-3 text-amber-500" />
          </span>
        )}
      </Label>
      <ColorPicker value={value} onChange={onChange} label={label} />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Per-class card row
// ---------------------------------------------------------------------------

const ClassRow: React.FC<{
  name: string;
  icon?: string;
  override: PlatformClassOverride;
  onPatch: (patch: Partial<PlatformClassOverride>) => void;
}> = ({ name, icon, override, onPatch }) => {
  const [open, setOpen] = React.useState(false);
  return (
    <li>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="grid w-full grid-cols-[1fr_96px_24px] items-center gap-4 px-6 py-3 text-left transition-colors hover:bg-muted/40"
          >
            <div className="flex items-center gap-3">
              <ChevronDown
                className={`size-4 text-muted-foreground transition-transform ${
                  open ? 'rotate-0' : '-rotate-90'
                }`}
              />
              <span className="text-sm font-semibold">{name}</span>
              <span className="text-xs text-muted-foreground">
                {Object.keys(override).length} override
                {Object.keys(override).length === 1 ? '' : 's'}
              </span>
            </div>
            <div className="h-12 w-24 overflow-hidden rounded border bg-muted/20 p-0.5">
              <ClassNodePreview override={override} icon={icon} label={name.slice(0, 2)} />
            </div>
            <span /> {/* spacer */}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="border-t bg-muted/10 px-6 py-4">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Layout */}
            <section className="space-y-3">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-brand">Layout</h4>
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Container
                </Label>
                <Switch
                  checked={!!override.isContainer}
                  onCheckedChange={(v: boolean) => onPatch({ isContainer: v || undefined })}
                />
              </div>
              {override.isContainer && (
                <p className="rounded-md border border-brand/30 bg-brand/5 px-2 py-1.5 text-[11px] text-brand-dark dark:text-brand">
                  Tip: open each relationship below and turn on{' '}
                  <span className="font-semibold">Container association</span> for the ones whose
                  targets should nest inside this container at runtime.
                </p>
              )}
              <div className="flex items-center justify-between">
                <Label
                  className="text-xs uppercase tracking-wider text-muted-foreground"
                  title="Show drag handles on instances so the user can resize the node"
                >
                  Resizable
                </Label>
                <Switch
                  checked={!!override.isResizable}
                  onCheckedChange={(v: boolean) => onPatch({ isResizable: v || undefined })}
                />
              </div>
              <NumberField
                label="Width (px)"
                value={override.defaultWidth}
                onChange={(v) => onPatch({ defaultWidth: v })}
              />
              <NumberField
                label="Height (px)"
                value={override.defaultHeight}
                onChange={(v) => onPatch({ defaultHeight: v })}
              />
              <SelectField
                label="Shape"
                value={override.nodeShape}
                options={[
                  { value: 'rectangle', label: 'Rectangle' },
                  { value: 'rounded_rect', label: 'Rounded rectangle' },
                  { value: 'ellipse', label: 'Ellipse' },
                  { value: 'diamond', label: 'Diamond' },
                  { value: 'hexagon', label: 'Hexagon' },
                ]}
                onChange={(v) => onPatch({ nodeShape: v as NodeShape | undefined })}
              />
              <SelectField
                label="Label position"
                value={override.labelPosition}
                options={[
                  { value: 'top', label: 'Top' },
                  { value: 'inside', label: 'Inside' },
                  { value: 'bottom', label: 'Bottom' },
                ]}
                onChange={(v) => onPatch({ labelPosition: v as LabelPositionName | undefined })}
              />
            </section>

            {/* Appearance */}
            <section className="space-y-3">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-brand">Appearance</h4>
              <ColorField
                label="Fill"
                value={override.fillColor}
                onChange={(v) => onPatch({ fillColor: v })}
                contrastAgainst={override.fontColor}
              />
              <ColorField
                label="Border"
                value={override.borderColor}
                onChange={(v) => onPatch({ borderColor: v })}
              />
              <SliderField
                label="Border width"
                value={override.borderWidth}
                defaultValue={2}
                min={0}
                max={8}
                unit="px"
                onChange={(v) => onPatch({ borderWidth: v })}
              />
              <SelectField
                label="Border style"
                value={override.borderStyle}
                options={[
                  { value: 'solid', label: 'Solid' },
                  { value: 'dashed', label: 'Dashed' },
                  { value: 'dotted', label: 'Dotted' },
                ]}
                onChange={(v) => onPatch({ borderStyle: v as LineStyleName | undefined })}
              />
              <SliderField
                label="Border radius"
                value={override.borderRadius}
                defaultValue={8}
                min={0}
                max={32}
                unit="px"
                onChange={(v) => onPatch({ borderRadius: v })}
              />
            </section>

            {/* Typography */}
            <section className="space-y-3">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-brand">Typography</h4>
              <SliderField
                label="Font size"
                value={override.fontSize}
                defaultValue={14}
                min={8}
                max={24}
                unit="px"
                onChange={(v) => onPatch({ fontSize: v })}
              />
              <SelectField
                label="Font weight"
                value={override.fontWeight}
                options={[
                  { value: 'normal', label: 'Normal' },
                  { value: 'bold', label: 'Bold' },
                ]}
                onChange={(v) => onPatch({ fontWeight: v as FontWeightName | undefined })}
              />
              <ColorField
                label="Font color"
                value={override.fontColor}
                onChange={(v) => onPatch({ fontColor: v })}
                contrastAgainst={override.fillColor}
              />
            </section>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </li>
  );
};

// ---------------------------------------------------------------------------
// Per-association card row
// ---------------------------------------------------------------------------

const AssociationRow: React.FC<{
  name: string;
  override: PlatformAssociationOverride;
  /** True when at least one endpoint class is flagged as a container — used
   * to surface the "Container association" toggle without disabling other
   * associations the user might want to keep as ordinary edges. */
  hasContainerEndpoint: boolean;
  onPatch: (patch: Partial<PlatformAssociationOverride>) => void;
}> = ({ name, override, hasContainerEndpoint, onPatch }) => {
  const [open, setOpen] = React.useState(false);
  return (
    <li>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="grid w-full grid-cols-[1fr_96px_24px] items-center gap-4 px-6 py-3 text-left transition-colors hover:bg-muted/40"
          >
            <div className="flex items-center gap-3">
              <ChevronDown
                className={`size-4 text-muted-foreground transition-transform ${
                  open ? 'rotate-0' : '-rotate-90'
                }`}
              />
              <span className="text-sm font-semibold">{name}</span>
              <span className="text-xs text-muted-foreground">
                {Object.keys(override).length} override
                {Object.keys(override).length === 1 ? '' : 's'}
              </span>
            </div>
            <div className="h-12 w-24 overflow-hidden rounded border bg-muted/20 p-0.5">
              <EdgeStylePreview override={override} />
            </div>
            <span />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="border-t bg-muted/10 px-6 py-4 space-y-4">
          {/* Container behaviour: when on, dropping a target instance inside a
              container source instance auto-creates this association and
              visually nests the child node. */}
          <div
            className={`flex items-start justify-between gap-3 rounded-md border p-3 ${
              hasContainerEndpoint
                ? 'border-brand/30 bg-brand/5'
                : 'border-muted bg-muted/20'
            }`}
          >
            <div className="space-y-1">
              <Label className="text-sm font-semibold text-foreground">
                Container association
              </Label>
              <p className="text-xs text-muted-foreground">
                {hasContainerEndpoint
                  ? 'When enabled, dropping a target instance inside a container source instance auto-creates this link and nests the child visually. The edge is hidden because the nesting already conveys it.'
                  : 'Enable on a container class first; this toggle is only honoured when the source of this association is a container.'}
              </p>
            </div>
            <Switch
              checked={!!override.isContainerAssociation}
              onCheckedChange={(v: boolean) =>
                onPatch({ isContainerAssociation: v ? true : undefined })
              }
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Line */}
            <section className="space-y-3">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-brand">Line</h4>
              <ColorField
                label="Color"
                value={override.edgeColor}
                onChange={(v) => onPatch({ edgeColor: v })}
              />
              <SliderField
                label="Width"
                value={override.lineWidth}
                defaultValue={2}
                min={1}
                max={6}
                unit="px"
                onChange={(v) => onPatch({ lineWidth: v })}
              />
              <SelectField
                label="Style"
                value={override.lineStyle}
                options={[
                  { value: 'solid', label: 'Solid' },
                  { value: 'dashed', label: 'Dashed' },
                  { value: 'dotted', label: 'Dotted' },
                ]}
                onChange={(v) => onPatch({ lineStyle: v as LineStyleName | undefined })}
              />
            </section>

            {/* Arrows */}
            <section className="space-y-3">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-brand">Arrows</h4>
              <SelectField
                label="Source arrow"
                value={override.sourceArrowStyle}
                options={ARROW_OPTIONS}
                onChange={(v) => onPatch({ sourceArrowStyle: v as ArrowStyleName | undefined })}
              />
              <SelectField
                label="Target arrow"
                value={override.targetArrowStyle}
                options={ARROW_OPTIONS}
                onChange={(v) => onPatch({ targetArrowStyle: v as ArrowStyleName | undefined })}
              />
            </section>

            {/* Label */}
            <section className="space-y-3">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-brand">Label</h4>
              <div className="flex items-center justify-between gap-2">
                <Label className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
                  {override.labelVisible === false ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  Visible
                </Label>
                <Switch
                  checked={override.labelVisible !== false}
                  onCheckedChange={(v: boolean) => onPatch({ labelVisible: v ? undefined : false })}
                />
              </div>
              <SliderField
                label="Font size"
                value={override.labelFontSize}
                defaultValue={11}
                min={8}
                max={18}
                unit="px"
                onChange={(v) => onPatch({ labelFontSize: v })}
              />
              <ColorField
                label="Font color"
                value={override.labelFontColor}
                onChange={(v) => onPatch({ labelFontColor: v })}
              />
            </section>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </li>
  );
};

const ARROW_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'filled_triangle', label: 'Filled triangle ▶' },
  { value: 'open_triangle', label: 'Open triangle' },
  { value: 'diamond', label: 'Diamond ◆' },
  { value: 'open_diamond', label: 'Open diamond ◇' },
  { value: 'circle', label: 'Circle ●' },
];

const NumberField: React.FC<{
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
}> = ({ label, value, onChange }) => (
  <div className="flex flex-col gap-1.5">
    <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
    <Input
      type="number"
      min={1}
      placeholder="auto"
      className="h-8 text-sm"
      value={value ?? ''}
      onChange={(e) => {
        const trimmed = e.target.value.trim();
        if (trimmed === '') return onChange(undefined);
        const n = Number.parseInt(trimmed, 10);
        onChange(Number.isFinite(n) && n > 0 ? n : undefined);
      }}
    />
  </div>
);

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

/** Strip undefined values out of a patch so persisted JSON stays tidy. */
function compact<T extends Record<string, any>>(obj: T): T {
  const out: any = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null && v !== '' && v !== false) out[k] = v;
    if (k === 'isContainer' && v === true) out[k] = true;
    if (k === 'labelVisible' && v === false) out[k] = false;
  }
  return out as T;
}

export const PlatformCustomizationPanel: React.FC = () => {
  const dispatch = useAppDispatch();
  const project = useAppSelector(selectProject);
  const diagrams = useAppSelector(selectDiagramsForActiveType);
  const activeIndex = useAppSelector(selectActiveDiagramIndex);

  const safeIndex = diagrams.length > 0 ? Math.min(activeIndex, diagrams.length - 1) : 0;
  const activeDiagram: ProjectDiagram | undefined = diagrams[safeIndex];

  const referencedClassDiagram = useMemo(() => {
    if (!project) return undefined;
    return getReferencedDiagram(project, activeDiagram, 'ClassDiagram');
  }, [project, activeDiagram]);

  const classDiagramModel = referencedClassDiagram?.model;
  const classes = useMemo(
    () => (isUMLModel(classDiagramModel) ? extractClasses(classDiagramModel) : []),
    [classDiagramModel],
  );
  const classNames = useMemo(() => classes.map((c) => c.name), [classes]);
  const associations = useMemo(
    () => (isUMLModel(classDiagramModel) ? extractAssociations(classDiagramModel) : []),
    [classDiagramModel],
  );
  const associationNames = useMemo(() => associations.map((a) => a.name), [associations]);

  const customization: PlatformCustomizationData = useMemo(() => {
    const raw = activeDiagram?.model;
    if (isPlatformCustomizationData(raw)) return raw;
    return createEmptyPlatformCustomizationData();
  }, [activeDiagram?.model]);

  const containerClassNames = useMemo(() => {
    const set = new Set<string>();
    for (const [className, override] of Object.entries(customization.classOverrides)) {
      if (override.isContainer) set.add(className);
    }
    return set;
  }, [customization.classOverrides]);

  const persist = useCallback(
    (next: PlatformCustomizationData) => {
      dispatch(updateDiagramModelThunk({ model: next }));
    },
    [dispatch],
  );

  const patchClass = useCallback(
    (className: string, patch: Partial<PlatformClassOverride>) => {
      const existing = customization.classOverrides[className] ?? {};
      const merged = compact({ ...existing, ...patch });
      const nextClassOverrides = { ...customization.classOverrides };
      if (Object.keys(merged).length === 0) {
        delete nextClassOverrides[className];
      } else {
        nextClassOverrides[className] = merged;
      }
      persist({ ...customization, classOverrides: nextClassOverrides });
    },
    [customization, persist],
  );

  const patchAssociation = useCallback(
    (associationName: string, patch: Partial<PlatformAssociationOverride>) => {
      const existing = customization.associationOverrides[associationName] ?? {};
      const merged = compact({ ...existing, ...patch });
      const nextAssociationOverrides = { ...customization.associationOverrides };
      if (Object.keys(merged).length === 0) {
        delete nextAssociationOverrides[associationName];
      } else {
        nextAssociationOverrides[associationName] = merged;
      }
      persist({ ...customization, associationOverrides: nextAssociationOverrides });
    },
    [customization, persist],
  );

  const patchDiagram = useCallback(
    (patch: Partial<PlatformDiagramOverride>) => {
      const existing = customization.diagramCustomization ?? {};
      const merged = compact({ ...existing, ...patch });
      const next = { ...customization };
      if (Object.keys(merged).length === 0) {
        delete next.diagramCustomization;
      } else {
        next.diagramCustomization = merged;
      }
      persist(next);
    },
    [customization, persist],
  );

  const applyPreset = useCallback(
    (preset: Preset) => {
      persist(buildPresetCustomization(preset, classNames, associationNames, customization));
    },
    [classNames, associationNames, customization, persist],
  );

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      <div className="border-b bg-card/60 px-6 py-4 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <Sliders className="size-5 text-brand" />
          <h2 className="text-lg font-semibold text-foreground">Platform Customization</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Visual overrides applied when the{' '}
          <span className="font-semibold">Platform</span> generator turns your class diagram into a
          standalone instance editor.
        </p>
        {referencedClassDiagram && (
          <p className="mt-1 text-[11px] text-muted-foreground">
            Reading from: <span className="font-semibold">{referencedClassDiagram.title}</span>
          </p>
        )}
      </div>

      <div className="scrollbar-thin flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto flex max-w-4xl flex-col gap-6">
          {!project && (
            <EmptyState
              title="No project loaded"
              message="Create or open a project to customize the platform generator."
            />
          )}

          {project && !isUMLModel(classDiagramModel) && (
            <EmptyState
              title="No Class Diagram available"
              message="Create a class diagram first; this panel lists its classes and associations."
            />
          )}

          {isUMLModel(classDiagramModel) && classNames.length === 0 && (
            <EmptyState
              title="Class Diagram is empty"
              message="Add at least one class in the referenced Class Diagram."
            />
          )}

          {isUMLModel(classDiagramModel) && (
            <DiagramCustomizationCard
              classNames={classNames}
              associationNames={associationNames}
              customization={customization}
              onPatch={patchDiagram}
              onApplyPreset={applyPreset}
            />
          )}

          {classNames.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Classes</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y">
                  {classes.map((cls) => (
                    <ClassRow
                      key={cls.name}
                      name={cls.name}
                      icon={cls.icon}
                      override={customization.classOverrides[cls.name] ?? {}}
                      onPatch={(patch) => patchClass(cls.name, patch)}
                    />
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {associationNames.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Associations</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y">
                  {associations.map((assoc) => {
                    const hasContainerEndpoint = assoc.endpointClassNames.some((n) =>
                      containerClassNames.has(n),
                    );
                    return (
                      <AssociationRow
                        key={assoc.name}
                        name={assoc.name}
                        override={customization.associationOverrides[assoc.name] ?? {}}
                        hasContainerEndpoint={hasContainerEndpoint}
                        onPatch={(patch) => patchAssociation(assoc.name, patch)}
                      />
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          )}

          {associationNames.length === 0 && classNames.length > 0 && (
            <p className="text-center text-xs italic text-muted-foreground">
              No associations to customize. Add some in the Class Diagram — then come back here to
              set edge colors and arrows.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlatformCustomizationPanel;
