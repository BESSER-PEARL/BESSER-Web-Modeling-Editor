/**
 * What is new on GitHub, drawn on the canvas before it is taken in: new and changed classes in the
 * editor's own notation, with what is new on them ringed in their author's colour and removed ones
 * marked. It sits in an overlay like the marks a pull leaves, so the model does not change until
 * the user says so.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UMLDiagramType } from '@besser/wme';
import { Eye, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProject } from '../../../app/hooks/useProject';
import { OPEN_GITHUB_SAVE_EVENT } from '../../../shared/api/github';
import { reportError } from '../../../shared/services/errors/reportError';
import { elementLabel, elementRecords, relationshipLabel } from '../../../shared/services/github/modelAttribution';
import { hasModelChanges, renameLabel, soleAuthor } from '../../../shared/services/github/modelChanges';
import {
  loadRepoChangePreview,
  type Bounds,
  type RepoChangePreviewData,
} from '../../../shared/services/github/repoChangePreview';
import { getActiveDiagram, type BesserProject } from '../../../shared/types/project';
import { useGetLatest } from '../hooks/useGetLatest';
import { closeRepoChangePreview, useRepoChangePreviewOpen } from '../hooks/useRepoChangePreview';
import { useRepoSync, type RepoSyncState } from '../hooks/useRepoSync';
import { AuthorLine, Chip, RelationshipMark, authorColor, joinNames, useElementBoxes } from './ModelAttributionLayer';

const REMOVED_COLOR = '#be123c';
const NO_AUTHOR_COLOR = 'hsl(var(--brand))';

// States in which nothing is left to preview. A check still running, or one that failed, is not one of them.
const NOTHING_TO_PREVIEW = new Set<RepoSyncState>(['in-sync', 'local-changes', 'unlinked', 'signed-out', 'reconnect', 'missing', 'not-in-tab']);

type ToScreen = (x: number, y: number) => { left: number; top: number };

const activeClassDiagram = (project: BesserProject | null | undefined) =>
  project ? getActiveDiagram(project, 'ClassDiagram') : undefined;

/** The incoming classes over the canvas. */
const IncomingDrawing: React.FC<{
  drawing: NonNullable<RepoChangePreviewData['drawing']>;
  classes: { id: string; bounds: Bounds; whole: boolean; author: string | null }[];
  rows: { id: string; bounds: Bounds; author: string | null }[];
  relationships: { id: string; points: { x: number; y: number }[]; author: string | null }[];
  scale: number;
  toScreen: ToScreen;
}> = ({ drawing, classes, rows, relationships, scale, toScreen }) => (
  <div className="absolute inset-0 duration-300 animate-in fade-in-0 motion-reduce:animate-none">
    {/* The editor's classes have no fill: without this, a class underneath shows through. */}
    {classes.map(({ id, bounds }) => (
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
        ...toScreen(drawing.clip.x, drawing.clip.y),
        width: drawing.clip.width,
        height: drawing.clip.height,
        transform: `scale(${scale})`,
      }}
      // Sanitised in loadRepoChangePreview: the model comes from a file anyone with write access can edit.
      dangerouslySetInnerHTML={{ __html: drawing.svg }}
    />
    {[...classes.filter(({ whole }) => whole), ...rows.map((row) => ({ ...row, whole: false }))].map(({ id, bounds, author, whole }) => {
      const { left, top } = toScreen(bounds.x, bounds.y);
      const width = bounds.width * scale;
      const color = author ? authorColor(author) : NO_AUTHOR_COLOR;
      return (
        <React.Fragment key={id}>
          <div
            data-testid={whole ? 'incoming-ring' : 'incoming-row'}
            className="absolute rounded-[2px] border-2 border-dashed"
            style={{
              left,
              top,
              width,
              height: bounds.height * scale,
              borderColor: color,
              backgroundColor: author ? `${color}14` : undefined,
            }}
          />
          {author && (
            <Chip
              label={`@${author}`}
              color={color}
              // As in the marks a pull leaves: above a class, beside a row.
              style={whole ? { left, top: top - 26 } : { left: left + width + 6, top }}
            />
          )}
        </React.Fragment>
      );
    })}
    {relationships.map(({ id, points, author }) => (
      <React.Fragment key={id}>
        <RelationshipMark
          testId="incoming-relationship"
          color={author ? authorColor(author) : NO_AUTHOR_COLOR}
          label={author && `@${author}`}
          points={points.map(({ x, y }) => {
            const { left, top } = toScreen(x, y);
            return { x: left, y: top };
          })}
        />
      </React.Fragment>
    ))}
  </div>
);

export const RepoChangePreview: React.FC = () => {
  const { t } = useTranslation();
  const open = useRepoChangePreviewOpen();
  const { currentProject, switchDiagramType } = useProject();
  const sync = useRepoSync();
  const { link, status, state, hasLocalChanges, githubSession } = sync;
  const [busy, setBusy] = useState(false);
  const getLatest = useGetLatest({ pull: sync.pull, hasLocalChanges, setBusy });
  const layer = useRef<HTMLDivElement>(null);

  const [preview, setPreview] = useState<RepoChangePreviewData | null>(null);

  const newCommits = state === 'behind' || state === 'diverged';
  const headSha = newCommits ? status?.head_sha : undefined;
  const projectId = currentProject?.id;

  useEffect(() => {
    if (open && NOTHING_TO_PREVIEW.has(state)) closeRepoChangePreview();
  }, [open, state]);
  useEffect(() => closeRepoChangePreview, [projectId]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      // A dialog above the preview owns Escape.
      if (document.querySelector('[role="dialog"][data-state="open"]')) return;
      closeRepoChangePreview();
    };
    // Capture: the canvas handles Escape itself, and a dialog closes before a later listener can see it open.
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open]);

  const activeDiagramId = activeClassDiagram(currentProject)?.id;
  useEffect(() => {
    if (!open || !headSha || !link || !githubSession) {
      setPreview(null);
      return undefined;
    }
    let stale = false;
    const target = { owner: link.owner, repo: link.repo, headSha, baseSha: link.baseCommitSha, modelPath: link.legacyFilePath };
    loadRepoChangePreview(githubSession, target, activeDiagramId)
      .then((loaded) => {
        if (stale) return;
        setPreview(loaded);
        if (hasModelChanges(loaded.changes) && currentProject?.currentDiagramType !== 'ClassDiagram') {
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
  }, [open, headSha, link?.owner, link?.repo, link?.baseCommitSha, link?.legacyFilePath, githubSession, activeDiagramId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Any class on the canvas fixes where model coordinates fall on screen, through every pan and zoom.
  const localElements = (activeClassDiagram(currentProject)?.model as { elements?: Record<string, { bounds?: Bounds; owner?: string | null }> } | undefined)?.elements;
  const referenceId = useMemo(
    () => Object.entries(localElements ?? {}).find(([, element]) => element.bounds && !element.owner)?.[0],
    [localElements],
  );
  const removedIds = useMemo(() => (preview?.changes.removed ?? []).filter((element) => !element.ownerId).map((element) => element.id), [preview]);
  const tracked = useMemo(
    () => (open ? [...(referenceId ? [referenceId] : []), ...removedIds] : []),
    [open, referenceId, removedIds],
  );
  const boxes = useElementBoxes(tracked, layer);

  if (!open) return null;

  const referenceBox = referenceId ? boxes[referenceId] : undefined;
  const referenceBounds = referenceId ? localElements?.[referenceId]?.bounds : undefined;
  const scale = referenceBox && referenceBounds?.width ? referenceBox.width / referenceBounds.width : 0;
  const toScreen: ToScreen = (x, y) => ({
    left: (referenceBox?.left ?? 0) + (x - (referenceBounds?.x ?? 0)) * scale,
    top: (referenceBox?.top ?? 0) + (y - (referenceBounds?.y ?? 0)) * scale,
  });

  const records = preview ? elementRecords(preview.head) : new Map<string, { addedBy: string }>();
  const onlyAuthor = status ? soleAuthor(status.commits_since) : null;
  const addedIds = new Set(preview?.changes.added.map((element) => element.id));

  // A new class is its adder's. On an existing class, its original adder is not who changed it.
  const authorOfClass = (id: string): string | null => {
    if (addedIds.has(id)) return records.get(id)?.addedBy ?? onlyAuthor;
    const newMember = preview?.changes.added.find((element) => element.ownerId === id);
    return (newMember && records.get(newMember.id)?.addedBy) ?? onlyAuthor;
  };

  // A new class's new members are part of it, as in the marks a pull leaves.
  const addedByAuthor = new Map<string, string[]>();
  const addedByNobody: string[] = [];
  for (const element of preview?.changes.added ?? []) {
    if (element.ownerId && addedIds.has(element.ownerId)) continue;
    const label = elementLabel(element, preview!.elements);
    const author = records.get(element.id)?.addedBy ?? onlyAuthor;
    if (author) addedByAuthor.set(author, [...(addedByAuthor.get(author) ?? []), label]);
    else addedByNobody.push(label);
  }
  for (const relationship of preview?.changes.addedRelationships ?? []) {
    const label = relationshipLabel(relationship, preview!.elements);
    const author = records.get(relationship.id)?.addedBy ?? onlyAuthor;
    if (author) addedByAuthor.set(author, [...(addedByAuthor.get(author) ?? []), label]);
    else addedByNobody.push(label);
  }
  const changedNames = (preview?.changes.changed ?? []).map((element) =>
    renameLabel(elementLabel(element, preview!.elements), element.previousName, element.name),
  );
  const removedNames = (preview?.changes.removed ?? [])
    .filter((element) => !element.ownerId || !removedIds.includes(element.ownerId))
    .map((element) => preview!.removedLabels.get(element.id) ?? element.name);

  const takeIn = () => {
    if (hasLocalChanges) window.dispatchEvent(new CustomEvent(OPEN_GITHUB_SAVE_EVENT));
    else void getLatest();
  };

  const changeLine = (kind: 'changed' | 'removed', names: string[]) => {
    if (!names.length) return null;
    const items = joinNames(t, names);
    if (onlyAuthor) {
      return (
        <AuthorLine
          author={onlyAuthor}
          title={names.join(', ')}
          text={kind === 'changed'
            ? t('github.preview.changed', { defaultValue: '{{author}} changed {{items}}', author: `@${onlyAuthor}`, items })
            : t('github.preview.removedLine', { defaultValue: '{{author}} removed {{items}}', author: `@${onlyAuthor}`, items })}
        />
      );
    }
    return (
      <p className="truncate text-xs text-muted-foreground" title={names.join(', ')}>
        {kind === 'changed'
          ? t('github.preview.changedSeveral', { defaultValue: 'Changed: {{items}}', items })
          : t('github.preview.removedSeveral', { defaultValue: 'Removed: {{items}}', items })}
      </p>
    );
  };

  return (
    <div ref={layer} className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {preview?.drawing && scale > 0 && (
        <IncomingDrawing
          drawing={preview.drawing}
          scale={scale}
          toScreen={toScreen}
          classes={preview.drawnClasses.map((drawn) => ({ ...drawn, author: authorOfClass(drawn.id) }))}
          rows={preview.drawnRows.map((row) => ({
            ...row,
            // A changed row's record is its original adder's, who did not change it.
            author: (addedIds.has(row.id) ? records.get(row.id)?.addedBy : undefined) ?? onlyAuthor,
          }))}
          relationships={preview.drawnRelationships.map((relationship) => ({
            ...relationship,
            author: records.get(relationship.id)?.addedBy ?? onlyAuthor,
          }))}
        />
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
            <Chip
              label={t('github.preview.removed', { defaultValue: 'Removed' })}
              color={REMOVED_COLOR}
              style={{ left: box.left, top: box.top - 26 }}
            />
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
            {[...addedByAuthor].map(([author, names]) => (
              <AuthorLine
                key={author}
                author={author}
                title={names.join(', ')}
                text={t('github.attribution.added', { author: `@${author}`, items: joinNames(t, names) })}
              />
            ))}
            {addedByNobody.length > 0 && (
              <p className="truncate text-xs text-muted-foreground" title={addedByNobody.join(', ')}>
                {t('github.preview.addedSeveral', { defaultValue: 'Added: {{items}}', items: joinNames(t, addedByNobody) })}
              </p>
            )}
            {changeLine('changed', changedNames)}
            {changeLine('removed', removedNames)}
            {preview && preview.changes.relationshipsRemoved > 0 && (
              <p className="text-xs text-muted-foreground">
                {t('github.preview.relationshipsRemoved', { defaultValue: '{{count}} relationships removed', count: preview.changes.relationshipsRemoved })}
              </p>
            )}
            {preview && (
              <p className="mt-1 text-xs text-muted-foreground">
                {!hasModelChanges(preview.changes)
                  ? t('github.preview.nothing', { defaultValue: 'The class diagrams are the same. Other diagrams or the code may have changed.' })
                  : preview.drawing && !referenceId
                    ? t('github.preview.notDrawn', { defaultValue: 'This diagram is empty here, so the changes are listed but not drawn.' })
                    : t('github.preview.hint', { defaultValue: 'Your model has not changed yet. Other diagrams and the code come along with it.' })}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button size="sm" className="h-7 gap-1.5 px-2.5 text-xs" disabled={busy || !preview} onClick={takeIn}>
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
