/**
 * What is new on GitHub, drawn on the canvas before it is taken in: new and changed classes in
 * the editor's own notation, ringed in their author's colour, with removed ones marked. It sits
 * in an overlay like the marks a pull leaves, so the model does not change until the user says so.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApollonEditor, UMLDiagramType } from '@besser/wme';
import DOMPurify from 'dompurify';
import { Eye, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProject } from '../../../app/hooks/useProject';
import { OPEN_GITHUB_SAVE_EVENT, loadModelAtCommit } from '../../../shared/api/github';
import { reportError } from '../../../shared/services/errors/reportError';
import { readRepoModel } from '../../../shared/services/project-import/projectImport';
import { bareMemberName, elementLabel, classModelElements, elementRecords, type ClassModelElement } from '../../../shared/services/github/modelAttribution';
import { diffClassModels, idsToDraw, type ModelChanges } from '../../../shared/services/github/modelChanges';
import { getActiveDiagram, type BesserProject } from '../../../shared/types/project';
import { useGetLatest } from '../hooks/useGetLatest';
import { closeRepoChangePreview, useRepoChangePreviewOpen } from '../hooks/useRepoChangePreview';
import { useRepoSync } from '../hooks/useRepoSync';
import { teammateChange } from '../hooks/useTeammateChangeNotice';
import { Chip, MAX_LISTED_NAMES, authorColor, useElementBoxes } from './ModelAttributionLayer';

const REMOVED_COLOR = '#be123c';

interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}
type ApollonElement = { bounds?: Bounds; owner?: string | null; type?: string };
type ApollonModel = { elements?: Record<string, ApollonElement> };

interface Preview {
  changes: ModelChanges;
  /** Every element of the head, for labels. */
  elements: Map<string, ClassModelElement>;
  removedLabels: Map<string, string>;
  head: BesserProject;
  /** The new and changed classes as the editor draws them, and where in model coordinates. */
  drawing: { svg: string; clip: Bounds } | null;
  drawnClasses: { id: string; bounds: Bounds }[];
}

const activeModel = (project: BesserProject | null | undefined): ApollonModel | undefined =>
  (project ? getActiveDiagram(project, 'ClassDiagram')?.model : undefined) as ApollonModel | undefined;

const diagramById = (project: BesserProject, id: string | undefined) =>
  project.diagrams?.ClassDiagram?.find((diagram) => diagram.id === id) ?? project.diagrams?.ClassDiagram?.[0];

async function loadPreview(
  session: string,
  owner: string,
  repo: string,
  headSha: string,
  baseSha: string | undefined,
  modelPath: string | undefined,
  activeDiagramId: string | undefined,
): Promise<Preview> {
  const [headVersion, baseVersion] = await Promise.all([
    loadModelAtCommit(session, owner, repo, headSha, modelPath),
    // A base that held no model reads as an empty one: everything counts as new.
    baseSha ? loadModelAtCommit(session, owner, repo, baseSha, modelPath).catch(() => null) : null,
  ]);
  const head = readRepoModel(headVersion.project).project;
  const base = baseVersion ? readRepoModel(baseVersion.project).project : null;
  const changes = diffClassModels(base, head);
  const headModel = diagramById(head, activeDiagramId)?.model as ApollonModel | undefined;
  const baseModel = base ? diagramById(base, activeDiagramId)?.model : undefined;

  const include = idsToDraw(changes, baseModel, headModel);
  let drawing: Preview['drawing'] = null;
  if (include.length && headModel) {
    try {
      const { svg, clip } = await ApollonEditor.exportModelAsSvg(headModel as never, { include, margin: 0 });
      // Its <style> block would restyle the whole page once inlined: the wrapper below takes over from it.
      drawing = { svg: DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true }, FORBID_TAGS: ['style'] }), clip };
    } catch (error) {
      // The text in the bar still says what changed.
      console.warn('Could not draw the incoming classes', error);
    }
  }
  const before = base ? classModelElements(base) : new Map<string, ClassModelElement>();
  return {
    changes,
    head,
    elements: classModelElements(head),
    removedLabels: new Map(changes.removed.map((element) => [element.id, elementLabel(element, before)])),
    drawing,
    drawnClasses: include.flatMap((id) => {
      const bounds = headModel?.elements?.[id]?.bounds;
      return bounds ? [{ id, bounds }] : [];
    }),
  };
}

const listed = (names: string[]) => {
  const hidden = names.length - MAX_LISTED_NAMES;
  return { items: names.slice(0, MAX_LISTED_NAMES).join(', '), hidden };
};

export const RepoChangePreview: React.FC = () => {
  const { t } = useTranslation();
  const open = useRepoChangePreviewOpen();
  const { currentProject, switchDiagramType } = useProject();
  const sync = useRepoSync();
  const { link, status, state, hasLocalChanges, githubSession } = sync;
  const getLatest = useGetLatest({ pull: sync.pull, hasLocalChanges });
  const layer = useRef<HTMLDivElement>(null);

  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);

  const newCommits = state === 'behind' || state === 'diverged';
  const headSha = newCommits ? status?.head_sha : undefined;
  const projectId = currentProject?.id;

  // Nothing left to preview: taken in, reconnecting, or another project.
  useEffect(() => {
    if (open && !headSha && state !== 'checking') closeRepoChangePreview();
  }, [open, headSha, state]);
  useEffect(() => closeRepoChangePreview, [projectId]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRepoChangePreview();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const activeDiagramId = currentProject ? getActiveDiagram(currentProject, 'ClassDiagram')?.id : undefined;
  useEffect(() => {
    if (!open || !headSha || !link || !githubSession) {
      setPreview(null);
      return undefined;
    }
    let stale = false;
    loadPreview(githubSession, link.owner, link.repo, headSha, link.baseCommitSha, link.legacyFilePath, activeDiagramId)
      .then((loaded) => {
        if (stale) return;
        setPreview(loaded);
        const { added, changed, removed } = loaded.changes;
        if ((added.length || changed.length || removed.length) && currentProject?.currentDiagramType !== 'ClassDiagram') {
          void switchDiagramType(UMLDiagramType.ClassDiagram);
        }
      })
      .catch((error) => {
        if (stale) return;
        reportError(t('github.preview.failed', { defaultValue: 'Could not load the preview.' }), { error });
        closeRepoChangePreview();
      });
    return () => {
      stale = true;
    };
    // The project object changes on every edit; the preview depends only on these.
  }, [open, headSha, link?.owner, link?.repo, link?.baseCommitSha, githubSession, activeDiagramId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Any class on the canvas fixes where model coordinates fall on screen, through every pan and zoom.
  const localModel = activeModel(currentProject);
  const referenceId = useMemo(
    () => Object.entries(localModel?.elements ?? {}).find(([, element]) => element.bounds && !element.owner)?.[0],
    [localModel],
  );
  const removedIds = useMemo(() => (preview?.changes.removed ?? []).filter((element) => !element.ownerId).map((element) => element.id), [preview]);
  const tracked = useMemo(
    () => (open ? [...(referenceId ? [referenceId] : []), ...removedIds] : []),
    [open, referenceId, removedIds],
  );
  const boxes = useElementBoxes(tracked, layer);

  if (!open) return null;

  const referenceBox = referenceId ? boxes[referenceId] : undefined;
  const referenceBounds = referenceId ? localModel?.elements?.[referenceId]?.bounds : undefined;
  const scale = referenceBox && referenceBounds?.width ? referenceBox.width / referenceBounds.width : 0;
  const toScreen = (x: number, y: number) => ({
    left: (referenceBox?.left ?? 0) + (x - (referenceBounds?.x ?? 0)) * scale,
    top: (referenceBox?.top ?? 0) + (y - (referenceBounds?.y ?? 0)) * scale,
  });

  const records = preview ? elementRecords(preview.head) : new Map();
  const commitAuthor = status ? teammateChange(status.commits_since, undefined)?.author ?? '' : '';
  const authorOf = (id: string): string => records.get(id)?.addedBy ?? commitAuthor;

  // A new class's new members are part of it, as in the marks a pull leaves.
  const addedIds = new Set(preview?.changes.added.map((element) => element.id));
  const addedByAuthor = new Map<string, string[]>();
  for (const element of preview?.changes.added ?? []) {
    if (element.ownerId && addedIds.has(element.ownerId)) continue;
    const author = authorOf(element.id);
    addedByAuthor.set(author, [...(addedByAuthor.get(author) ?? []), elementLabel(element, preview!.elements)]);
  }
  const changedNames = (preview?.changes.changed ?? []).map((element) => {
    const label = elementLabel(element, preview!.elements);
    // A rename reads as one; a changed type or similar keeps the name alone.
    const before = bareMemberName(element.previousName);
    return before && before !== bareMemberName(element.name) ? `${before} → ${label}` : label;
  });
  const removedNames = (preview?.changes.removed ?? [])
    .filter((element) => !element.ownerId || !removedIds.includes(element.ownerId))
    .map((element) => preview!.removedLabels.get(element.id) ?? element.name);
  const nothingInClassDiagram = !!preview && !addedByAuthor.size && !changedNames.length && !removedNames.length;

  const takeIn = async () => {
    if (hasLocalChanges) {
      window.dispatchEvent(new CustomEvent(OPEN_GITHUB_SAVE_EVENT));
      return;
    }
    setBusy(true);
    try {
      await getLatest();
    } finally {
      setBusy(false);
    }
  };

  const line = (key: string, defaultValue: string, author: string, names: string[]) => {
    const { items, hidden } = listed(names);
    return (
      <p key={`${key}-${author}`} className="flex items-center gap-1.5 text-xs text-muted-foreground" title={names.join(', ')}>
        <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: authorColor(author) }} aria-hidden />
        <span className="truncate">
          {t(key, {
            defaultValue,
            author: `@${author}`,
            items: hidden > 0 ? t('github.attribution.more', { items, count: hidden }) : items,
          })}
        </span>
      </p>
    );
  };

  return (
    <div ref={layer} className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {preview?.drawing && scale > 0 && (
        <div className="absolute inset-0 duration-300 animate-in fade-in-0 motion-reduce:animate-none">
          {/* The editor's classes have no fill: without this, a class underneath shows through. */}
          {preview.drawnClasses.map(({ id, bounds }) => (
            <div
              key={id}
              className="absolute bg-background"
              style={{ ...toScreen(bounds.x, bounds.y), width: bounds.width * scale, height: bounds.height * scale }}
            />
          ))}
          <div
            data-testid="incoming-drawing"
            className="absolute origin-top-left [&_svg]:overflow-visible [&>svg]:block [&_text]:fill-[#212529] [&_text]:[font-family:'Helvetica_Neue',Helvetica,Arial,sans-serif] [&_text]:text-[16px] dark:[&_svg]:fill-[rgb(15,23,42)] dark:[&_text]:fill-white"
            style={{
              ...toScreen(preview.drawing.clip.x, preview.drawing.clip.y),
              width: preview.drawing.clip.width,
              height: preview.drawing.clip.height,
              transform: `scale(${scale})`,
            }}
            dangerouslySetInnerHTML={{ __html: preview.drawing.svg }}
          />
          {preview.drawnClasses.map(({ id, bounds }) => {
            const author = authorOf(id);
            const { left, top } = toScreen(bounds.x, bounds.y);
            return (
              <React.Fragment key={id}>
                <div
                  data-testid="incoming-ring"
                  className="absolute rounded-[2px] border-2 border-dashed"
                  style={{
                    left,
                    top,
                    width: bounds.width * scale,
                    height: bounds.height * scale,
                    borderColor: authorColor(author),
                    backgroundColor: `${authorColor(author)}14`,
                  }}
                />
                <Chip login={author} style={{ left, top: top - 26 }} />
              </React.Fragment>
            );
          })}
        </div>
      )}

      {removedIds.map((id) => {
        const box = boxes[id];
        if (!box) return null;
        return (
          <React.Fragment key={id}>
            <div
              data-testid="incoming-removed"
              className="absolute rounded-[2px] border-2 border-dashed duration-300 animate-in fade-in-0 motion-reduce:animate-none"
              style={{
                left: box.left,
                top: box.top,
                width: box.width,
                height: box.height,
                borderColor: REMOVED_COLOR,
                backgroundColor: `${REMOVED_COLOR}1f`,
              }}
            />
            <span
              className="absolute whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-medium leading-4 text-white shadow-elevation-1"
              style={{ left: box.left, top: box.top - 26, backgroundColor: REMOVED_COLOR }}
            >
              {t('github.preview.removed', { defaultValue: 'Removed' })}
            </span>
          </React.Fragment>
        );
      })}

      <div className="absolute inset-x-0 top-3 flex justify-center px-4">
        <div
          role="region"
          aria-label={t('github.preview.title', { defaultValue: "Preview of what's new on GitHub" })}
          className="pointer-events-auto flex max-w-2xl items-start gap-3 rounded-xl border border-border bg-background/95 px-4 py-2.5 text-sm shadow-elevation-2 backdrop-blur duration-200 animate-in fade-in-0 slide-in-from-top-1 motion-reduce:animate-none"
        >
          {preview ? (
            <Eye className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
          ) : (
            <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-muted-foreground" aria-hidden />
          )}
          <div className="min-w-0 flex-1">
            <p className="font-medium">{t('github.preview.title', { defaultValue: "Preview of what's new on GitHub" })}</p>
            {!preview && (
              <p className="text-xs text-muted-foreground">{t('github.preview.loading', { defaultValue: 'Reading the new version…' })}</p>
            )}
            {[...addedByAuthor].map(([author, names]) => line('github.attribution.added', '{{author}} added {{items}}', author, names))}
            {changedNames.length > 0 && line('github.preview.changed', '{{author}} changed {{items}}', commitAuthor, changedNames)}
            {removedNames.length > 0 && line('github.preview.removedLine', '{{author}} removed {{items}}', commitAuthor, removedNames)}
            {preview && (
              <p className="mt-1 text-xs text-muted-foreground">
                {nothingInClassDiagram
                  ? t('github.preview.nothing', { defaultValue: 'The class diagrams are the same. Other diagrams or the code may have changed.' })
                  : t('github.preview.hint', { defaultValue: 'Your model has not changed. Taking this in also brings any other diagrams and code.' })}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button size="sm" className="h-7 gap-1.5 px-2.5 text-xs" disabled={busy || !preview} onClick={() => void takeIn()}>
              {busy && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
              {hasLocalChanges
                ? t('github.teammate.saveAndMerge', { defaultValue: 'Save and merge' })
                : t('github.menu.getLatest', { defaultValue: 'Get latest' })}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-7"
              aria-label={t('github.preview.close', { defaultValue: 'Close the preview' })}
              onClick={closeRepoChangePreview}
            >
              <X className="size-3.5" aria-hidden />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
