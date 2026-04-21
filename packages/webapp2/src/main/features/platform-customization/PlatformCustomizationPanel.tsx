/**
 * PlatformCustomizationPanel
 * ==========================
 *
 * A form-based editor (not a canvas) that sits alongside the UML, GUI and
 * Quantum editors. It reads the project's active ClassDiagram, lists every
 * class and association it finds, and lets the user attach overrides used by
 * the Python `PlatformGenerator`:
 *
 *   - per-class: `container` flag and default instance size (width x height)
 *   - per-association: edge color (any CSS color string)
 *
 * Saving is immediate: every field change dispatches `updateDiagramModelThunk`
 * which persists to `ProjectStorageRepository`.
 */

import React, { useCallback, useMemo } from 'react';
import { AlertTriangle, Sliders } from 'lucide-react';
import type { UMLModel } from '@besser/wme';
import { useAppDispatch, useAppSelector } from '../../app/store/hooks';
import {
  selectActiveDiagramIndex,
  selectDiagramsForActiveType,
  selectProject,
  updateDiagramModelThunk,
} from '../../app/store/workspaceSlice';
import {
  createEmptyPlatformCustomizationData,
  getReferencedDiagram,
  isPlatformCustomizationData,
  isUMLModel,
  PlatformAssociationOverride,
  PlatformClassOverride,
  PlatformCustomizationData,
  ProjectDiagram,
} from '../../shared/types/project';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/** Extract the list of top-level class names from a ClassDiagram UMLModel. */
function extractClassNames(model: UMLModel): string[] {
  const names = new Set<string>();
  for (const el of Object.values(model.elements ?? {})) {
    // Top-level classifiers have no owner; attributes/methods have an owner id.
    if ((el as any)?.owner === null && typeof el?.name === 'string' && el.name.trim() !== '') {
      names.add(el.name);
    }
  }
  return Array.from(names).sort();
}

/** Extract association names (UMLRelationship.name) that are non-empty. */
function extractAssociationNames(model: UMLModel): string[] {
  const names = new Set<string>();
  for (const rel of Object.values(model.relationships ?? {})) {
    if (typeof rel?.name === 'string' && rel.name.trim() !== '') {
      names.add(rel.name);
    }
  }
  return Array.from(names).sort();
}

/** Read-only status banner when no ClassDiagram is available. */
const EmptyState: React.FC<{ title: string; message: string }> = ({ title, message }) => (
  <div className="flex items-start gap-3 rounded-md border border-amber-500/50 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-100">
    <AlertTriangle className="mt-0.5 size-5 flex-shrink-0" />
    <div>
      <div className="font-semibold">{title}</div>
      <div className="text-xs text-amber-800 dark:text-amber-200">{message}</div>
    </div>
  </div>
);

export const PlatformCustomizationPanel: React.FC = () => {
  const dispatch = useAppDispatch();
  const project = useAppSelector(selectProject);
  const diagrams = useAppSelector(selectDiagramsForActiveType);
  const activeIndex = useAppSelector(selectActiveDiagramIndex);

  const safeIndex = diagrams.length > 0 ? Math.min(activeIndex, diagrams.length - 1) : 0;
  const activeDiagram: ProjectDiagram | undefined = diagrams[safeIndex];

  // Look up the referenced ClassDiagram (falls back to the project's active one).
  const referencedClassDiagram = useMemo(() => {
    if (!project) return undefined;
    return getReferencedDiagram(project, activeDiagram, 'ClassDiagram');
  }, [project, activeDiagram]);

  const classDiagramModel = referencedClassDiagram?.model;
  const classNames = useMemo(
    () => (isUMLModel(classDiagramModel) ? extractClassNames(classDiagramModel) : []),
    [classDiagramModel],
  );
  const associationNames = useMemo(
    () => (isUMLModel(classDiagramModel) ? extractAssociationNames(classDiagramModel) : []),
    [classDiagramModel],
  );

  // Always render from a canonical, non-null customization payload.
  const customization: PlatformCustomizationData = useMemo(() => {
    const raw = activeDiagram?.model;
    if (isPlatformCustomizationData(raw)) return raw;
    return createEmptyPlatformCustomizationData();
  }, [activeDiagram?.model]);

  const persist = useCallback(
    (next: PlatformCustomizationData) => {
      dispatch(updateDiagramModelThunk({ model: next }));
    },
    [dispatch],
  );

  const updateClassOverride = useCallback(
    (className: string, patch: Partial<PlatformClassOverride>) => {
      const existing = customization.classOverrides[className] ?? {};
      const merged: PlatformClassOverride = { ...existing, ...patch };
      // Clean up empty overrides so the persisted JSON stays tidy.
      const cleaned: PlatformClassOverride = {};
      if (merged.isContainer) cleaned.isContainer = true;
      if (typeof merged.defaultWidth === 'number' && merged.defaultWidth > 0) {
        cleaned.defaultWidth = merged.defaultWidth;
      }
      if (typeof merged.defaultHeight === 'number' && merged.defaultHeight > 0) {
        cleaned.defaultHeight = merged.defaultHeight;
      }
      const nextClassOverrides = { ...customization.classOverrides };
      if (Object.keys(cleaned).length === 0) {
        delete nextClassOverrides[className];
      } else {
        nextClassOverrides[className] = cleaned;
      }
      persist({ ...customization, classOverrides: nextClassOverrides });
    },
    [customization, persist],
  );

  const updateAssociationOverride = useCallback(
    (associationName: string, patch: Partial<PlatformAssociationOverride>) => {
      const existing = customization.associationOverrides[associationName] ?? {};
      const merged: PlatformAssociationOverride = { ...existing, ...patch };
      const cleaned: PlatformAssociationOverride = {};
      if (typeof merged.edgeColor === 'string' && merged.edgeColor.trim() !== '') {
        cleaned.edgeColor = merged.edgeColor.trim();
      }
      const nextAssociationOverrides = { ...customization.associationOverrides };
      if (Object.keys(cleaned).length === 0) {
        delete nextAssociationOverrides[associationName];
      } else {
        nextAssociationOverrides[associationName] = cleaned;
      }
      persist({ ...customization, associationOverrides: nextAssociationOverrides });
    },
    [customization, persist],
  );

  const parseIntOrUndef = (value: string): number | undefined => {
    const trimmed = value.trim();
    if (trimmed === '') return undefined;
    const n = Number.parseInt(trimmed, 10);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      <div className="border-b bg-card/60 px-6 py-4 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <Sliders className="size-5 text-brand" />
          <h2 className="text-lg font-semibold text-foreground">Platform Customization</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Overrides applied when the <span className="font-semibold">Platform</span> generator
          turns your class diagram into a standalone instance editor.
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

          {/* --- Per-class overrides --- */}
          {classNames.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Classes</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-4 gap-y-2 border-b bg-muted/40 px-6 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <div>Class</div>
                  <div className="min-w-[88px] text-center">Container</div>
                  <div className="min-w-[96px]">Width (px)</div>
                  <div className="min-w-[96px]">Height (px)</div>
                </div>
                <ul className="divide-y">
                  {classNames.map((name) => {
                    const override = customization.classOverrides[name] ?? {};
                    const widthId = `pc-width-${name}`;
                    const heightId = `pc-height-${name}`;
                    const containerId = `pc-container-${name}`;
                    return (
                      <li
                        key={name}
                        className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-4 gap-y-1 px-6 py-3"
                      >
                        <div>
                          <Label htmlFor={containerId} className="text-sm font-semibold">
                            {name}
                          </Label>
                        </div>
                        <div className="flex min-w-[88px] justify-center">
                          <input
                            id={containerId}
                            type="checkbox"
                            className="size-4 cursor-pointer accent-brand"
                            checked={!!override.isContainer}
                            onChange={(e) =>
                              updateClassOverride(name, { isContainer: e.target.checked })
                            }
                            aria-label={`${name} is a container`}
                          />
                        </div>
                        <div className="min-w-[96px]">
                          <Input
                            id={widthId}
                            type="number"
                            min={1}
                            placeholder="auto"
                            className="h-8 text-sm"
                            value={override.defaultWidth ?? ''}
                            onChange={(e) =>
                              updateClassOverride(name, { defaultWidth: parseIntOrUndef(e.target.value) })
                            }
                            aria-label={`${name} default width`}
                          />
                        </div>
                        <div className="min-w-[96px]">
                          <Input
                            id={heightId}
                            type="number"
                            min={1}
                            placeholder="auto"
                            className="h-8 text-sm"
                            value={override.defaultHeight ?? ''}
                            onChange={(e) =>
                              updateClassOverride(name, { defaultHeight: parseIntOrUndef(e.target.value) })
                            }
                            aria-label={`${name} default height`}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* --- Per-association overrides --- */}
          {associationNames.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Associations</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 gap-y-2 border-b bg-muted/40 px-6 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <div>Association</div>
                  <div className="min-w-[64px]">Color</div>
                  <div className="min-w-[128px]">CSS value</div>
                </div>
                <ul className="divide-y">
                  {associationNames.map((name) => {
                    const override = customization.associationOverrides[name] ?? {};
                    const colorId = `pc-color-${name}`;
                    const textId = `pc-color-text-${name}`;
                    const colorValue = override.edgeColor ?? '';
                    return (
                      <li
                        key={name}
                        className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 gap-y-1 px-6 py-3"
                      >
                        <div>
                          <Label htmlFor={colorId} className="text-sm font-semibold">
                            {name}
                          </Label>
                        </div>
                        <div className="flex min-w-[64px]">
                          <input
                            id={colorId}
                            type="color"
                            className="h-8 w-12 cursor-pointer rounded-md border border-input bg-background"
                            value={/^#[0-9a-fA-F]{6}$/.test(colorValue) ? colorValue : '#3b82f6'}
                            onChange={(e) =>
                              updateAssociationOverride(name, { edgeColor: e.target.value })
                            }
                            aria-label={`${name} edge color`}
                          />
                        </div>
                        <div className="min-w-[128px]">
                          <Input
                            id={textId}
                            type="text"
                            placeholder="#22c55e or hsl(...)"
                            className="h-8 text-sm"
                            value={colorValue}
                            onChange={(e) =>
                              updateAssociationOverride(name, {
                                edgeColor: e.target.value === '' ? undefined : e.target.value,
                              })
                            }
                            aria-label={`${name} edge color value`}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          )}

          {associationNames.length === 0 && classNames.length > 0 && (
            <p className="text-center text-xs italic text-muted-foreground">
              No associations to customize. Add some in the Class Diagram — then come back here
              to set edge colors.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlatformCustomizationPanel;
