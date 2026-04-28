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
  AssociationEndpointRole,
  ClassRepresentation,
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
  PortSideName,
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
  /** Class names appearing on the source side (any relationship sharing this name). */
  sourceClassNames: string[];
  /** Class names appearing on the target side. */
  targetClassNames: string[];
}

/** Walk ClassInheritance relationships to build a parent→[direct subclasses]
 *  index. Returns class *names* (the rest of the panel keys by name too). */
function buildSubclassIndex(model: UMLModel): Map<string, string[]> {
  const elements = model.elements ?? {};
  const idToName = new Map<string, string>();
  for (const [eid, el] of Object.entries(elements)) {
    if ((el as any)?.owner !== null) continue;
    const name = (el as any)?.name;
    if (typeof name === 'string' && name.trim() !== '') idToName.set(eid, name);
  }
  const childrenByParent = new Map<string, string[]>();
  for (const rel of Object.values(model.relationships ?? {})) {
    if ((rel as any)?.type !== 'ClassInheritance') continue;
    // For inheritance: source = child, target = parent (matches the
    // generator script's convention; same idiom the backend uses).
    const childId = (rel as any)?.source?.element;
    const parentId = (rel as any)?.target?.element;
    const childName = idToName.get(childId);
    const parentName = idToName.get(parentId);
    if (!childName || !parentName) continue;
    const list = childrenByParent.get(parentName) ?? [];
    if (!list.includes(childName)) list.push(childName);
    childrenByParent.set(parentName, list);
  }
  return childrenByParent;
}

/** Compute the transitive set of descendants for a class name. */
function descendantsOf(parentName: string, index: Map<string, string[]>): string[] {
  const out = new Set<string>();
  const queue = [...(index.get(parentName) ?? [])];
  while (queue.length > 0) {
    const next = queue.shift()!;
    if (out.has(next)) continue;
    out.add(next);
    queue.push(...(index.get(next) ?? []));
  }
  return Array.from(out);
}

function extractAssociations(model: UMLModel): AssociationInfo[] {
  const elements = model.elements ?? {};
  const resolveClassName = (elementId: string | undefined): string | undefined => {
    if (!elementId) return undefined;
    const el = elements[elementId];
    if (!el || typeof (el as any).name !== 'string') return undefined;
    return (el as any).name;
  };
  const byName = new Map<
    string,
    { all: Set<string>; sources: Set<string>; targets: Set<string> }
  >();
  for (const rel of Object.values(model.relationships ?? {})) {
    if (typeof rel?.name !== 'string' || rel.name.trim() === '') continue;
    const slot =
      byName.get(rel.name) ??
      { all: new Set<string>(), sources: new Set<string>(), targets: new Set<string>() };
    const sourceName = resolveClassName((rel as any)?.source?.element);
    const targetName = resolveClassName((rel as any)?.target?.element);
    if (sourceName) {
      slot.all.add(sourceName);
      slot.sources.add(sourceName);
    }
    if (targetName) {
      slot.all.add(targetName);
      slot.targets.add(targetName);
    }
    byName.set(rel.name, slot);
  }
  return Array.from(byName.entries())
    .map(([name, slot]) => ({
      name,
      endpointClassNames: Array.from(slot.all),
      sourceClassNames: Array.from(slot.sources),
      targetClassNames: Array.from(slot.targets),
    }))
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

/** Pill-shaped segmented control. Used for representation / endpoint role. */
const SegmentedControl = <T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: Array<{ value: T; label: string; description?: string }>;
  onChange: (v: T) => void;
  ariaLabel: string;
}) => (
  <div role="radiogroup" aria-label={ariaLabel} className="inline-flex rounded-md border border-input bg-background p-0.5">
    {options.map((opt) => {
      const active = opt.value === value;
      return (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={active}
          onClick={() => onChange(opt.value)}
          title={opt.description}
          className={`px-3 py-1 text-xs font-medium transition-colors rounded ${
            active
              ? 'bg-brand text-brand-foreground shadow-sm'
              : 'text-muted-foreground hover:bg-muted/50'
          }`}
        >
          {opt.label}
        </button>
      );
    })}
  </div>
);

/** Map an override to its mutually-exclusive representation mode. */
function getRepresentation(o: PlatformClassOverride): ClassRepresentation {
  if (o.isPort) return 'port';
  if (o.isConnectionClass) return 'connection';
  if (o.isContainer) return 'container';
  return 'node';
}

/** Build the patch that switches a class to a given representation, clearing
 *  the other two flags and resetting `portSide` when leaving Port mode. */
function representationPatch(rep: ClassRepresentation): Partial<PlatformClassOverride> {
  return {
    isContainer: rep === 'container' ? true : undefined,
    isPort: rep === 'port' ? true : undefined,
    isConnectionClass: rep === 'connection' ? true : undefined,
    portSide: rep === 'port' ? 'auto' : undefined,
  };
}

/** Map an override to its endpoint role. */
function getEndpointRole(o: PlatformAssociationOverride): AssociationEndpointRole {
  if (o.isSourceEndpoint) return 'source';
  if (o.isTargetEndpoint) return 'target';
  return 'normal';
}

function endpointRolePatch(role: AssociationEndpointRole): Partial<PlatformAssociationOverride> {
  return {
    isSourceEndpoint: role === 'source' ? true : undefined,
    isTargetEndpoint: role === 'target' ? true : undefined,
  };
}

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

/** 4-way side picker for the default xyflow connection handles. Undefined
 *  means "all four sides (default)"; an explicit list — possibly empty —
 *  restricts which sides show handles. */
type ConnectionSide = 'top' | 'right' | 'bottom' | 'left';
const ALL_SIDES: ConnectionSide[] = ['top', 'right', 'bottom', 'left'];

const ConnectionPointsField: React.FC<{
  value?: ConnectionSide[];
  onChange: (v: ConnectionSide[] | undefined) => void;
}> = ({ value, onChange }) => {
  const isDefault = value === undefined;
  const sides = value ?? ALL_SIDES;
  const togglesEnabled = !isDefault;

  const setSide = (side: ConnectionSide, checked: boolean) => {
    const current = sides.filter((s) => s !== side);
    const next = checked ? [...current, side] : current;
    // Sort to keep persisted JSON deterministic
    const sorted = ALL_SIDES.filter((s) => next.includes(s));
    onChange(sorted);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">
          Connection points
        </Label>
        <button
          type="button"
          onClick={() => onChange(isDefault ? [] : undefined)}
          className="text-[10px] text-muted-foreground hover:text-foreground"
        >
          {isDefault ? 'Customize' : 'Reset to default'}
        </button>
      </div>
      <div className="grid grid-cols-4 gap-1">
        {ALL_SIDES.map((side) => {
          const checked = isDefault || sides.includes(side);
          return (
            <button
              key={side}
              type="button"
              disabled={!togglesEnabled}
              onClick={() => setSide(side, !checked)}
              className={`rounded border px-2 py-1 text-[11px] capitalize transition-colors ${
                checked
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-input bg-background text-muted-foreground'
              } ${!togglesEnabled ? 'opacity-60 cursor-not-allowed' : 'hover:border-primary/60'}`}
            >
              {side}
            </button>
          );
        })}
      </div>
      {!isDefault && sides.length === 0 && (
        <p className="text-[10px] italic text-muted-foreground">
          No connection handles will be rendered on this class.
        </p>
      )}
    </div>
  );
};

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
        <CollapsibleContent className="border-t bg-muted/10 px-6 py-4 space-y-4">
          {/* Representation: mutually-exclusive runtime rendering mode */}
          <section className="rounded-md border border-muted bg-muted/20 p-3 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label className="text-sm font-semibold text-foreground">Representation</Label>
                <p className="text-xs text-muted-foreground">
                  How instances of this class render in the generated editor.
                </p>
              </div>
              <SegmentedControl<ClassRepresentation>
                ariaLabel={`Representation for ${name}`}
                value={getRepresentation(override)}
                options={[
                  { value: 'node', label: 'Node', description: 'Standalone box on the canvas (default)' },
                  { value: 'container', label: 'Container', description: 'Hosts other nodes via container associations' },
                  { value: 'port', label: 'Port', description: 'Renders as a handle on its owning equipment' },
                  { value: 'connection', label: 'Connection', description: 'Renders as an edge between two ports' },
                ]}
                onChange={(rep) => onPatch(representationPatch(rep))}
              />
            </div>
            {override.isContainer && (
              <p className="rounded-md border border-brand/30 bg-brand/5 px-2 py-1.5 text-[11px] text-brand-dark dark:text-brand">
                Tip: open each relationship below and turn on{' '}
                <span className="font-semibold">Container association</span> for the ones whose
                targets should nest inside this container at runtime.
              </p>
            )}
            {override.isPort && (
              <div className="space-y-2">
                <p className="rounded-md border border-brand/30 bg-brand/5 px-2 py-1.5 text-[11px] text-brand-dark dark:text-brand">
                  Instances of this class render as graphical handles on their owning
                  equipment node — not as standalone nodes.
                </p>
                <SelectField
                  label="Anchor side"
                  value={override.portSide}
                  options={[
                    { value: 'auto', label: 'Auto (use direction attribute)' },
                    { value: 'top', label: 'Top' },
                    { value: 'right', label: 'Right' },
                    { value: 'bottom', label: 'Bottom' },
                    { value: 'left', label: 'Left' },
                  ]}
                  onChange={(v) => onPatch({ portSide: v as PortSideName | undefined })}
                />
              </div>
            )}
            {override.isConnectionClass && (
              <p className="rounded-md border border-brand/30 bg-brand/5 px-2 py-1.5 text-[11px] text-brand-dark dark:text-brand">
                Instances of this class render as edges between two ports. Mark exactly one
                outgoing association as <span className="font-semibold">Source endpoint</span> and
                another as <span className="font-semibold">Target endpoint</span> (target classes
                must be Ports).
              </p>
            )}
          </section>

          {/* Edge styling — only meaningful for connection classes. Mirrors
              the same controls available on associations so the user can
              theme edges drawn from this connection class. */}
          {override.isConnectionClass && (
            <div className="grid gap-6 lg:grid-cols-3">
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
          )}

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Layout */}
            <section className="space-y-3">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-brand">Layout</h4>
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
              <ConnectionPointsField
                value={override.connectionPoints}
                onChange={(v) => onPatch({ connectionPoints: v })}
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
  /** True when at least one source class of this association is flagged as
   *  a connection-class — gates the "Endpoint role" control. */
  hasConnectionSource: boolean;
  /** True when at least one target class of this association is flagged as
   *  a port — used in the helper text. */
  hasPortTarget: boolean;
  onPatch: (patch: Partial<PlatformAssociationOverride>) => void;
}> = ({ name, override, hasContainerEndpoint, hasConnectionSource, hasPortTarget, onPatch }) => {
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

          {/* Endpoint role: only meaningful when the source class is a
              connection-class. We surface the control regardless so the user
              can self-correct, but show a warning if it's set on an
              association whose source isn't a connection-class. */}
          <div
            className={`rounded-md border p-3 space-y-2 ${
              hasConnectionSource ? 'border-brand/30 bg-brand/5' : 'border-muted bg-muted/20'
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1">
                <Label className="text-sm font-semibold text-foreground">Endpoint role</Label>
                <p className="text-xs text-muted-foreground">
                  {hasConnectionSource
                    ? hasPortTarget
                      ? 'Designate this association as the source-port or target-port endpoint of its connection-class.'
                      : 'Source class is a connection — but the target class is not a Port. Mark the target class as a Port for this endpoint to work at runtime.'
                    : 'No effect: only honoured when the source class is a Connection.'}
                </p>
              </div>
              <SegmentedControl<AssociationEndpointRole>
                ariaLabel={`Endpoint role for ${name}`}
                value={getEndpointRole(override)}
                options={[
                  { value: 'normal', label: 'Normal' },
                  { value: 'source', label: 'Source' },
                  { value: 'target', label: 'Target' },
                ]}
                onChange={(role) => onPatch(endpointRolePatch(role))}
              />
            </div>
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
  const subclassIndex = useMemo(
    () => (isUMLModel(classDiagramModel) ? buildSubclassIndex(classDiagramModel) : new Map<string, string[]>()),
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

  const connectionClassNames = useMemo(() => {
    const set = new Set<string>();
    for (const [className, override] of Object.entries(customization.classOverrides)) {
      if (override.isConnectionClass) set.add(className);
    }
    return set;
  }, [customization.classOverrides]);

  const portClassNames = useMemo(() => {
    const set = new Set<string>();
    for (const [className, override] of Object.entries(customization.classOverrides)) {
      if (override.isPort) set.add(className);
    }
    return set;
  }, [customization.classOverrides]);

  /** Validation problems for connection-class wiring. Surfaced as a banner so
   *  the user can fix the configuration before generating the editor. */
  const validationIssues = useMemo<string[]>(() => {
    const issues: string[] = [];
    // For each connection-class, ensure it has at least one source-endpoint
    // and one target-endpoint association whose source is the class itself
    // and whose target is a port-class.
    for (const connClass of connectionClassNames) {
      const candidateSources: string[] = [];
      const candidateTargets: string[] = [];
      for (const assoc of associations) {
        if (!assoc.sourceClassNames.includes(connClass)) continue;
        const ov = customization.associationOverrides[assoc.name];
        if (ov?.isSourceEndpoint) candidateSources.push(assoc.name);
        if (ov?.isTargetEndpoint) candidateTargets.push(assoc.name);
      }
      if (candidateSources.length === 0) {
        issues.push(`Connection class "${connClass}" has no association marked as Source endpoint.`);
      } else if (candidateSources.length > 1) {
        issues.push(
          `Connection class "${connClass}" has multiple Source endpoint associations: ${candidateSources.join(', ')}.`,
        );
      }
      if (candidateTargets.length === 0) {
        issues.push(`Connection class "${connClass}" has no association marked as Target endpoint.`);
      } else if (candidateTargets.length > 1) {
        issues.push(
          `Connection class "${connClass}" has multiple Target endpoint associations: ${candidateTargets.join(', ')}.`,
        );
      }
      // Ensure the targets of each endpoint association are port-classes.
      for (const endpointAssoc of [...candidateSources, ...candidateTargets]) {
        const a = associations.find((x) => x.name === endpointAssoc);
        if (!a) continue;
        const nonPortTargets = a.targetClassNames.filter((t) => !portClassNames.has(t));
        if (nonPortTargets.length > 0) {
          issues.push(
            `Endpoint association "${endpointAssoc}" targets non-Port class(es): ${nonPortTargets.join(', ')}.`,
          );
        }
      }
    }
    // Endpoint flags set on associations whose source class isn't a connection-class.
    for (const [assocName, ov] of Object.entries(customization.associationOverrides)) {
      if (!ov.isSourceEndpoint && !ov.isTargetEndpoint) continue;
      const a = associations.find((x) => x.name === assocName);
      if (!a) continue;
      const validSources = a.sourceClassNames.filter((s) => connectionClassNames.has(s));
      if (validSources.length === 0) {
        issues.push(
          `Association "${assocName}" is marked as an endpoint but its source class is not a Connection.`,
        );
      }
    }
    return issues;
  }, [associations, customization.associationOverrides, connectionClassNames, portClassNames]);

  const persist = useCallback(
    (next: PlatformCustomizationData) => {
      dispatch(updateDiagramModelThunk({ model: next }));
    },
    [dispatch],
  );

  const patchClass = useCallback(
    (className: string, patch: Partial<PlatformClassOverride>) => {
      const nextClassOverrides = { ...customization.classOverrides };
      const apply = (name: string, p: Partial<PlatformClassOverride>) => {
        const existing = nextClassOverrides[name] ?? {};
        const merged = compact({ ...existing, ...p });
        if (Object.keys(merged).length === 0) {
          delete nextClassOverrides[name];
        } else {
          nextClassOverrides[name] = merged;
        }
      };
      apply(className, patch);
      // Propagate representation mode (Connection / Port / Container) to
      // descendants. Without this, switching a base class to Connection
      // wouldn't visibly update its subclasses in the panel even though
      // the runtime resolves the inheritance.
      const switchesRepresentation =
        'isPort' in patch || 'isConnectionClass' in patch || 'isContainer' in patch;
      if (switchesRepresentation) {
        for (const sub of descendantsOf(className, subclassIndex)) {
          apply(sub, {
            isPort: patch.isPort,
            isConnectionClass: patch.isConnectionClass,
            isContainer: patch.isContainer,
            portSide: patch.portSide,
          });
        }
      }
      persist({ ...customization, classOverrides: nextClassOverrides });
    },
    [customization, persist, subclassIndex],
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

          {validationIssues.length > 0 && (
            <div className="flex items-start gap-3 rounded-md border border-amber-500/50 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-100">
              <AlertTriangle className="mt-0.5 size-5 flex-shrink-0" />
              <div className="space-y-1">
                <div className="font-semibold">
                  Connection wiring needs attention ({validationIssues.length})
                </div>
                <ul className="list-disc space-y-0.5 pl-5 text-xs text-amber-800 dark:text-amber-200">
                  {validationIssues.map((msg, i) => (
                    <li key={i}>{msg}</li>
                  ))}
                </ul>
              </div>
            </div>
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
                    const hasConnectionSource = assoc.sourceClassNames.some((n) =>
                      connectionClassNames.has(n),
                    );
                    const hasPortTarget = assoc.targetClassNames.some((n) =>
                      portClassNames.has(n),
                    );
                    return (
                      <AssociationRow
                        key={assoc.name}
                        name={assoc.name}
                        override={customization.associationOverrides[assoc.name] ?? {}}
                        hasContainerEndpoint={hasContainerEndpoint}
                        hasConnectionSource={hasConnectionSource}
                        hasPortTarget={hasPortTarget}
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
