import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { CircleAlert, FileText, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { inputBaseClass } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  createLabChange,
  createLabNote,
  deleteLabNote,
  getLabMemory,
  updateLabNote,
  type LabChangeKind,
  type LabMemoryResponse,
  type LabNote,
  type LabNoteInput,
  type LabRepoKey,
} from '../../shared/api/lab';
import { globalConfirm } from '../../shared/services/confirm/globalConfirm';
import { reportError } from '../../shared/services/errors/reportError';
import type { LabStartState } from '../../shared/services/labSession';
import { describeNetworkError } from '../../shared/utils/describeNetworkError';

type NoteKind = LabNote['kind'];

const NOTE_KINDS: NoteKind[] = ['decision', 'mistake', 'convention'];
const REPO_KEYS: LabRepoKey[] = ['besser', 'frontend', 'modeling_agent'];
const CHANGE_KINDS: LabChangeKind[] = [
  'generator',
  'metamodel',
  'diagram_type',
  'editor_element',
  'backend',
  'agent',
  'bugfix',
  'other',
];

const isRepoKey = (repo: string): repo is LabRepoKey => (REPO_KEYS as string[]).includes(repo);

const EMPTY_NOTE: LabNoteInput = { kind: 'decision', title: '', body: '', repos: [], changeKinds: [], docsTarget: '' };

const toInput = (note: LabNote): LabNoteInput => ({
  kind: note.kind,
  title: note.title,
  body: note.body,
  repos: note.repos.filter(isRepoKey),
  changeKinds: note.changeKinds,
  docsTarget: note.docsTarget,
});

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; memory: LabMemoryResponse }
  | { status: 'failed'; error: string };

/** Which note the form edits: a new one, or the note with this id. */
type Editing = { id: string | null; draft: LabNoteInput } | null;

function useNoteKindLabel() {
  const { t } = useTranslation();
  return (kind: NoteKind): string => {
    switch (kind) {
      case 'decision':
        return t('lab.memory.kind.decision', { defaultValue: 'Decision' });
      case 'mistake':
        return t('lab.memory.kind.mistake', { defaultValue: 'Agent mistake' });
      case 'convention':
        return t('lab.memory.kind.convention', { defaultValue: 'Convention' });
    }
  };
}

const Chip: React.FC<{ className?: string; children: React.ReactNode }> = ({ className, children }) => (
  <span
    className={cn(
      'inline-flex shrink-0 items-center whitespace-nowrap rounded-full border border-border bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground',
      className,
    )}
  >
    {children}
  </span>
);

/** A group of checkboxes over a fixed list of values. */
function CheckboxGroup<V extends string>({
  legend,
  values,
  selected,
  label,
  onChange,
}: {
  legend: string;
  values: V[];
  selected: V[];
  label: (value: V) => string;
  onChange: (next: V[]) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1 text-xs text-muted-foreground">{legend}</legend>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {values.map((value) => (
          <label key={value} className="flex items-center gap-1.5 text-sm text-foreground">
            <input
              type="checkbox"
              className="size-4 accent-[hsl(var(--brand))]"
              checked={selected.includes(value)}
              onChange={(event) =>
                onChange(
                  event.target.checked
                    ? values.filter((v) => v === value || selected.includes(v))
                    : selected.filter((v) => v !== value),
                )
              }
            />
            {label(value)}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** The form that writes a new note or edits one. */
const NoteForm: React.FC<{
  initial: LabNoteInput;
  onSave: (draft: LabNoteInput) => Promise<void>;
  onCancel: () => void;
}> = ({ initial, onSave, onCancel }) => {
  const { t } = useTranslation();
  const kindLabel = useNoteKindLabel();
  const [draft, setDraft] = useState<LabNoteInput>(initial);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const set = <K extends keyof LabNoteInput>(key: K, value: LabNoteInput[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));
  const canSave = draft.title.trim() !== '' && draft.body.trim() !== '' && !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setFailure(null);
    try {
      await onSave({
        ...draft,
        title: draft.title.trim(),
        body: draft.body.trim(),
        docsTarget: draft.docsTarget.trim(),
      });
    } catch (error) {
      setFailure(describeNetworkError(error));
      setSaving(false);
    }
  };

  return (
    <form
      data-testid="lab-memory-form"
      className="flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {t('lab.memory.form.kind', { defaultValue: 'Kind' })}
          <select
            value={draft.kind}
            onChange={(event) => set('kind', event.target.value as NoteKind)}
            className={cn(inputBaseClass, 'h-9 w-44 py-1')}
          >
            {NOTE_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {kindLabel(kind)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-0 flex-1 basis-64 flex-col gap-1 text-xs text-muted-foreground">
          {t('lab.memory.form.title', { defaultValue: 'Title' })}
          <input
            value={draft.title}
            onChange={(event) => set('title', event.target.value)}
            className={cn(inputBaseClass, 'h-9 py-1')}
          />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        {t('lab.memory.form.body', { defaultValue: 'Body' })}
        <Textarea
          rows={4}
          value={draft.body}
          onChange={(event) => set('body', event.target.value)}
          className="text-sm"
        />
      </label>
      <CheckboxGroup
        legend={t('lab.memory.form.repos', { defaultValue: 'Repositories (none: every repository)' })}
        values={REPO_KEYS}
        selected={draft.repos ?? []}
        label={(repo) => t(`lab.repos.${repo}`, { defaultValue: repo })}
        onChange={(repos) => set('repos', repos)}
      />
      <CheckboxGroup
        legend={t('lab.memory.form.changeKinds', { defaultValue: 'Kinds of change (none: every kind)' })}
        values={CHANGE_KINDS}
        selected={draft.changeKinds ?? []}
        label={(kind) => t(`lab.kinds.${kind}`, { defaultValue: kind.replace('_', ' ') })}
        onChange={(changeKinds) => set('changeKinds', changeKinds)}
      />
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        {t('lab.memory.form.docsTarget', {
          defaultValue: 'Docs target (the CLAUDE.md or skill it belongs in, if any)',
        })}
        <input
          value={draft.docsTarget}
          onChange={(event) => set('docsTarget', event.target.value)}
          placeholder="CLAUDE.md"
          className={cn(inputBaseClass, 'h-9 py-1 font-mono')}
        />
      </label>
      {failure && (
        <Alert variant="destructive">
          <CircleAlert aria-hidden />
          <AlertDescription>{failure}</AlertDescription>
        </Alert>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          {t('lab.memory.form.cancel', { defaultValue: 'Cancel' })}
        </Button>
        <Button type="submit" size="sm" disabled={!canSave}>
          {saving && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {t('lab.memory.form.save', { defaultValue: 'Save' })}
        </Button>
      </div>
    </form>
  );
};

const NoteRow: React.FC<{
  note: LabNote;
  onEdit: () => void;
  onDelete: () => void;
  onMoveToDocs: () => void;
  moving: boolean;
}> = ({ note, onEdit, onDelete, onMoveToDocs, moving }) => {
  const { t } = useTranslation();
  const kindLabel = useNoteKindLabel();
  return (
    <li data-testid="lab-memory-note" className="flex flex-col gap-2 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <Chip
          className={
            note.kind === 'mistake'
              ? 'border-warning/40 bg-warning/10 text-warning'
              : 'border-brand/30 bg-brand/10 text-primary'
          }
        >
          {kindLabel(note.kind)}
        </Chip>
        <span className="min-w-0 flex-1 basis-56 font-medium text-foreground">{note.title}</span>
        {note.stale && (
          <Chip className="border-warning/40 bg-warning/10 text-warning">
            <span data-testid="lab-memory-stale">
              {t('lab.memory.stale', { defaultValue: 'Not read for a long time' })}
            </span>
          </Chip>
        )}
      </div>
      <p className="whitespace-pre-line text-sm text-muted-foreground">{note.body}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {note.repos.length === 0 ? (
          <Chip>{t('lab.memory.everyRepo', { defaultValue: 'Every repository' })}</Chip>
        ) : (
          note.repos.map((repo) => <Chip key={repo}>{t(`lab.repos.${repo}`, { defaultValue: repo })}</Chip>)
        )}
        {note.changeKinds.length === 0 ? (
          <Chip className="font-mono">{t('lab.memory.everyKind', { defaultValue: 'Every kind' })}</Chip>
        ) : (
          note.changeKinds.map((kind) => (
            <Chip key={kind} className="font-mono">
              {t(`lab.kinds.${kind}`, { defaultValue: kind.replace('_', ' ') })}
            </Chip>
          ))
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {note.approvedBy && (
          <span>{t('lab.memory.approvedBy', { defaultValue: 'Approved by @{{login}}', login: note.approvedBy })}</span>
        )}
        <span className="tabular-nums">
          {note.reads === 0
            ? t('lab.memory.neverRead', { defaultValue: 'Never read' })
            : t('lab.memory.reads', { defaultValue: 'Read {{count}} times', defaultValue_one: 'Read once', count: note.reads })}
        </span>
        {note.docsTarget && (
          <span>{t('lab.memory.belongsIn', { defaultValue: 'Belongs in {{target}}', target: note.docsTarget })}</span>
        )}
        <span className="ml-auto flex items-center gap-1">
          {note.docsTarget && (
            <Button variant="outline" size="xs" onClick={onMoveToDocs} disabled={moving}>
              {moving ? <Loader2 className="animate-spin" aria-hidden /> : <FileText aria-hidden />}
              {t('lab.memory.moveToDocs', { defaultValue: 'Move to docs' })}
            </Button>
          )}
          <Button variant="ghost" size="xs" onClick={onEdit}>
            <Pencil aria-hidden />
            {t('lab.memory.edit', { defaultValue: 'Edit' })}
          </Button>
          <Button variant="ghost" size="xs" onClick={onDelete} className="text-destructive hover:text-destructive">
            <Trash2 aria-hidden />
            {t('lab.memory.delete', { defaultValue: 'Delete' })}
          </Button>
        </span>
      </div>
    </li>
  );
};

/**
 * The team's notes the lab agent reads (D3 decisions 9 and 10): list, write, edit and delete them;
 * a note that belongs in the docs offers "Move to docs", which starts a change that puts it there.
 */
export const LabMemoryPanel: React.FC<{ githubSession: string }> = ({ githubSession }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [editing, setEditing] = useState<Editing>(null);
  const [moving, setMoving] = useState<string | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    getLabMemory(githubSession).then(
      (memory) => !cancelled && setState({ status: 'ready', memory }),
      (error: unknown) => !cancelled && setState({ status: 'failed', error: describeNetworkError(error) }),
    );
    return () => {
      cancelled = true;
    };
  }, [githubSession]);

  useEffect(() => load(), [load]);

  const setNotes = (update: (notes: LabNote[]) => LabNote[]) =>
    setState((s) =>
      s.status === 'ready' ? { status: 'ready', memory: { ...s.memory, notes: update(s.memory.notes) } } : s,
    );

  const save = async (id: string | null, draft: LabNoteInput) => {
    if (id === null) {
      const created = await createLabNote(githubSession, draft);
      setNotes((notes) => [...notes, created]);
    } else {
      const updated = await updateLabNote(githubSession, id, draft);
      setNotes((notes) => notes.map((n) => (n.id === id ? updated : n)));
    }
    setEditing(null);
  };

  const remove = async (note: LabNote) => {
    const confirmed = await globalConfirm({
      title: t('lab.memory.deleteTitle', { defaultValue: 'Delete the note ‘{{title}}’?', title: note.title }),
      description: t('lab.memory.deleteBody', {
        defaultValue: 'The lab agent no longer reads it. This cannot be undone.',
      }),
      confirmLabel: t('lab.memory.delete', { defaultValue: 'Delete' }),
      variant: 'danger',
    });
    if (!confirmed) return;
    try {
      await deleteLabNote(githubSession, note.id);
      setNotes((notes) => notes.filter((n) => n.id !== note.id));
    } catch (error) {
      reportError(
        t('lab.memory.deleteFailed', {
          defaultValue: 'The note could not be deleted: {{error}}',
          error: describeNetworkError(error),
        }),
        { error },
      );
    }
  };

  const moveToDocs = async (note: LabNote) => {
    setMoving(note.id);
    try {
      const change = await createLabChange(githubSession);
      const labStart: LabStartState = {
        message: t('lab.memory.moveMessage', {
          defaultValue:
            'Put this team note into {{target}}, written the way that file states its other rules, so the agent no longer needs the note.\n\n{{title}}\n\n{{body}}',
          target: note.docsTarget,
          title: note.title,
          body: note.body,
        }),
      };
      navigate(`/c/${change.changeId}`, { state: { labStart } });
    } catch (error) {
      reportError(
        t('lab.memory.moveFailed', {
          defaultValue: 'The change could not be started: {{error}}',
          error: describeNetworkError(error),
        }),
        { error },
      );
      setMoving(null);
    }
  };

  let body: React.ReactNode;
  if (state.status === 'loading') {
    body = (
      <div data-testid="lab-memory-loading" className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        {t('lab.memory.loading', { defaultValue: 'Reading the team notes…' })}
      </div>
    );
  } else if (state.status === 'failed') {
    body = (
      <Alert variant="destructive" data-testid="lab-memory-error">
        <CircleAlert aria-hidden />
        <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
          {t('lab.memory.error', { defaultValue: 'The team notes could not be read: {{error}}', error: state.error })}
          <Button variant="outline" size="xs" onClick={load}>
            {t('lab.memory.retry', { defaultValue: 'Try again' })}
          </Button>
        </AlertDescription>
      </Alert>
    );
  } else if (!state.memory.enabled) {
    body = (
      <Alert variant="warning" data-testid="lab-memory-disabled">
        <CircleAlert aria-hidden />
        <AlertDescription>
          {t('lab.memory.disabled', { defaultValue: 'Team notes are off: {{reason}}', reason: state.memory.reason })}
        </AlertDescription>
      </Alert>
    );
  } else {
    const { notes } = state.memory;
    body = (
      <>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-[60ch] text-sm text-muted-foreground">
            {t('lab.memory.intro', {
              defaultValue:
                'Decisions, recurring agent mistakes and conventions the lab agent reads when they apply to a change. A rule of the codebase belongs in the docs: move it there.',
            })}
          </p>
          {editing?.id !== null && (
            <Button variant="outline" size="sm" onClick={() => setEditing({ id: null, draft: EMPTY_NOTE })}>
              <Plus className="size-4" aria-hidden />
              {t('lab.memory.new', { defaultValue: 'New note' })}
            </Button>
          )}
        </div>
        {editing?.id === null && (
          <NoteForm initial={editing.draft} onSave={(draft) => save(null, draft)} onCancel={() => setEditing(null)} />
        )}
        {notes.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            {t('lab.memory.empty', { defaultValue: 'No team notes yet. Approve one from a run, or write one.' })}
          </p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {notes.map((note) =>
              editing?.id === note.id ? (
                <li key={note.id} className="p-3">
                  <NoteForm
                    initial={editing.draft}
                    onSave={(draft) => save(note.id, draft)}
                    onCancel={() => setEditing(null)}
                  />
                </li>
              ) : (
                <NoteRow
                  key={note.id}
                  note={note}
                  moving={moving === note.id}
                  onEdit={() => setEditing({ id: note.id, draft: toInput(note) })}
                  onDelete={() => void remove(note)}
                  onMoveToDocs={() => void moveToDocs(note)}
                />
              ),
            )}
          </ul>
        )}
      </>
    );
  }

  return (
    <div data-testid="lab-memory-panel" className="flex flex-col gap-3">
      {body}
    </div>
  );
};
