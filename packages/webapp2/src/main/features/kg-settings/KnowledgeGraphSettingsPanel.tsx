import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useProject } from '../../app/hooks/useProject';
import { ProjectStorageRepository } from '../../shared/services/storage/ProjectStorageRepository';
import {
  DEFAULT_KG_HARD_LIMIT,
  DEFAULT_KG_LAYOUT,
  DEFAULT_KG_SOFT_LIMIT,
  getActiveDiagram,
  getKgHardLimit,
  getKgLayout,
  getKgSoftLimit,
  isKnowledgeGraphData,
} from '../../shared/types/project';
import type { KnowledgeGraphData, KnowledgeGraphLayout } from '../../shared/types/project';

const MIN = 1;
const MAX = 10000;

/** KG-specific settings page. Two limits:
 *  - Soft: how many nodes are auto-shown on import / reseed.
 *  - Hard: absolute ceiling; user can't exceed it without raising the limit. */
export const KnowledgeGraphSettingsPanel: React.FC = () => {
  const { currentProject } = useProject();
  const navigate = useNavigate();

  const kgDiagram = currentProject ? getActiveDiagram(currentProject, 'KnowledgeGraphDiagram') : undefined;
  const storedModel = useMemo<KnowledgeGraphData | null>(() => {
    const m = kgDiagram?.model;
    return isKnowledgeGraphData(m) ? m : null;
  }, [kgDiagram?.model]);

  const storedSoft = storedModel?.settings?.softLimit ?? storedModel?.settings?.maxVisibleNodes;
  const storedHard = storedModel?.settings?.hardLimit;
  const storedLayout = storedModel?.settings?.layout;

  const [softInput, setSoftInput] = useState<string>(storedSoft != null ? String(storedSoft) : '');
  const [hardInput, setHardInput] = useState<string>(storedHard != null ? String(storedHard) : '');
  const [layoutInput, setLayoutInput] = useState<KnowledgeGraphLayout>(storedLayout ?? DEFAULT_KG_LAYOUT);

  useEffect(() => {
    setSoftInput(storedSoft != null ? String(storedSoft) : '');
    setHardInput(storedHard != null ? String(storedHard) : '');
    setLayoutInput(storedLayout ?? DEFAULT_KG_LAYOUT);
  }, [storedSoft, storedHard, storedLayout]);

  const parseOrDefault = (s: string, fallback: number): number => {
    const t = s.trim();
    if (t === '') return fallback;
    const n = Number(t);
    return Number.isInteger(n) ? n : NaN;
  };
  const softVal = parseOrDefault(softInput, DEFAULT_KG_SOFT_LIMIT);
  const hardVal = parseOrDefault(hardInput, DEFAULT_KG_HARD_LIMIT);

  const softValid = Number.isFinite(softVal) && softVal >= MIN && softVal <= MAX;
  const hardValid = Number.isFinite(hardVal) && hardVal >= MIN && hardVal <= MAX;
  const orderValid = softVal <= hardVal;

  const appliedStoredLayout = getKgLayout(storedModel?.settings);
  const isDirty =
    (softInput.trim() === '' ? storedSoft != null : softVal !== storedSoft) ||
    (hardInput.trim() === '' ? storedHard != null : hardVal !== storedHard) ||
    layoutInput !== appliedStoredLayout;
  const canSave = isDirty && softValid && hardValid && orderValid;

  const save = () => {
    if (!currentProject) return;
    const project = ProjectStorageRepository.loadProject(currentProject.id);
    if (!project) return;
    const active = getActiveDiagram(project, 'KnowledgeGraphDiagram');
    if (!active || !isKnowledgeGraphData(active.model)) return;

    const nextSettings = { ...(active.model.settings ?? {}) };
    if (softInput.trim() === '') {
      delete (nextSettings as any).softLimit;
    } else {
      nextSettings.softLimit = softVal;
    }
    if (hardInput.trim() === '') {
      delete (nextSettings as any).hardLimit;
    } else {
      nextSettings.hardLimit = hardVal;
    }
    if (layoutInput === DEFAULT_KG_LAYOUT) {
      delete (nextSettings as any).layout;
    } else {
      nextSettings.layout = layoutInput;
    }
    // Clear the legacy field once either of the new ones is written.
    delete (nextSettings as any).maxVisibleNodes;

    // If the layout algorithm changed, wipe persisted node positions so the
    // editor re-runs the newly-chosen layout on its next sync pass (which
    // fires as soon as the user navigates back to the editor).
    const layoutChanged = layoutInput !== appliedStoredLayout;
    const nextNodes = layoutChanged
      ? active.model.nodes.map((n) => {
          const { position: _discarded, ...rest } = n;
          return rest;
        })
      : active.model.nodes;

    const nextModel: KnowledgeGraphData = { ...active.model, nodes: nextNodes, settings: nextSettings };
    const ok = ProjectStorageRepository.updateDiagram(project.id, 'KnowledgeGraphDiagram', {
      ...active,
      model: nextModel,
      lastUpdate: new Date().toISOString(),
    });
    if (ok) toast.success('KG settings saved.');
    else toast.error('Failed to save KG settings.');
  };

  const resetToDefault = () => {
    setSoftInput('');
    setHardInput('');
    setLayoutInput(DEFAULT_KG_LAYOUT);
  };

  if (!currentProject || !kgDiagram) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <Card>
          <CardHeader>
            <CardTitle>Knowledge Graph Settings</CardTitle>
            <CardDescription>No Knowledge Graph diagram is active.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => navigate('/')}>
              <ArrowLeft className="mr-2 size-4" />
              Back to editor
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalNodes = storedModel?.nodes.length ?? 0;
  const appliedSoft = getKgSoftLimit(storedModel?.settings);
  const appliedHard = getKgHardLimit(storedModel?.settings);

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="gap-1">
          <ArrowLeft className="size-4" />
          Back to editor
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Knowledge Graph Settings</CardTitle>
          <CardDescription>
            Preferences scoped to the active KG diagram ({kgDiagram.title}). Changes are saved into
            the project and round-trip with export/import.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <section className="space-y-2">
            <Label htmlFor="kg-soft-limit">Soft limit — auto-shown on import</Label>
            <div className="flex items-center gap-2">
              <Input
                id="kg-soft-limit"
                type="number"
                min={MIN}
                max={MAX}
                step={1}
                placeholder={`${DEFAULT_KG_SOFT_LIMIT} (default)`}
                value={softInput}
                onChange={(e) => setSoftInput(e.target.value)}
                className="w-40"
              />
              <span className="text-xs text-muted-foreground">
                When you load an ontology, this many nodes appear by default. You can enable more
                via the node list, up to the hard limit.
              </span>
            </div>
            {softInput.trim() !== '' && !softValid && (
              <p className="text-xs text-destructive">Enter an integer between {MIN} and {MAX}.</p>
            )}
          </section>

          <section className="space-y-2">
            <Label htmlFor="kg-hard-limit">Hard limit — absolute ceiling</Label>
            <div className="flex items-center gap-2">
              <Input
                id="kg-hard-limit"
                type="number"
                min={MIN}
                max={MAX}
                step={1}
                placeholder={`${DEFAULT_KG_HARD_LIMIT} (default)`}
                value={hardInput}
                onChange={(e) => setHardInput(e.target.value)}
                className="w-40"
              />
              <span className="text-xs text-muted-foreground">
                The maximum number of nodes that can be visible at the same time. Attempting to
                exceed it shows an explanatory toast.
              </span>
            </div>
            {hardInput.trim() !== '' && !hardValid && (
              <p className="text-xs text-destructive">Enter an integer between {MIN} and {MAX}.</p>
            )}
            {softValid && hardValid && !orderValid && (
              <p className="text-xs text-destructive">
                Soft limit ({softVal}) must be less than or equal to the hard limit ({hardVal}).
              </p>
            )}
          </section>

          <section className="space-y-2">
            <Label htmlFor="kg-layout">Layout</Label>
            <div className="flex items-center gap-2">
              <select
                id="kg-layout"
                value={layoutInput}
                onChange={(e) => setLayoutInput(e.target.value as KnowledgeGraphLayout)}
                className="h-8 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="concentric">Concentric (default) — high-degree nodes in the center</option>
                <option value="fcose">fCoSE — force-directed, organic clusters (slower)</option>
                <option value="grid">Grid — deterministic rows and columns</option>
              </select>
            </div>
            <p className="text-xs text-muted-foreground">
              Changing the layout re-positions all currently visible nodes. After the layout
              runs, you can drag nodes individually and those positions are preserved.
            </p>
          </section>

          <p className="text-xs text-muted-foreground">
            Diagram currently has {totalNodes} node{totalNodes === 1 ? '' : 's'} · applied soft
            limit {appliedSoft} · applied hard limit {appliedHard} · applied layout{' '}
            <code className="rounded bg-muted px-1 py-0.5">{appliedStoredLayout}</code>.
          </p>

          <Separator />

          <div className="flex items-center gap-2">
            <Button onClick={save} disabled={!canSave}>
              Save
            </Button>
            <Button
              variant="outline"
              onClick={resetToDefault}
              disabled={
                storedSoft == null &&
                storedHard == null &&
                storedLayout == null &&
                softInput.trim() === '' &&
                hardInput.trim() === '' &&
                layoutInput === DEFAULT_KG_LAYOUT
              }
            >
              Reset to defaults
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
