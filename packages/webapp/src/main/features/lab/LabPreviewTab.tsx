import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, CircleAlert, ExternalLink, FileText, Loader2, RotateCcw, ShieldAlert, TriangleAlert } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import {
  getLabPreview,
  getLabPreviewLog,
  labRefusal,
  restartLabPreview,
  takeLabPreviewSlot,
  touchLabPreviewSlot,
  type LabPreviewLog,
  type LabPreviewService,
  type LabPreviewServiceName,
  type LabPreviewSlot,
  type LabPreviewView,
} from '../../shared/api/lab';
import { describeNetworkError, isNetworkError } from '../../shared/utils/describeNetworkError';
import { formatAgo } from './LabChangeList';

/** Poll interval while a service of the slot starts or the slot is prepared (D1 decision 11). */
export const PREVIEW_FAST_POLL_MS = 3_000;
/** Poll interval once every service has settled. */
export const PREVIEW_SLOW_POLL_MS = 15_000;
/** The tab keeps its slot by touching it; the server lets another change take a slot idle 10 minutes. */
export const PREVIEW_TOUCH_MS = 60_000;
/** Lines of a service's log the Show log dialog reads. */
export const PREVIEW_LOG_LINES = 200;
/**
 * The preview origin differs from the lab's, so `allow-same-origin` grants the preview only its own
 * storage. Never `allow-top-navigation`: the preview cannot navigate the lab page away (D1 decision 3).
 */
export const PREVIEW_IFRAME_SANDBOX = 'allow-scripts allow-same-origin allow-forms allow-downloads allow-popups allow-modals';

const SERVICE_ORDER: LabPreviewServiceName[] = ['backend', 'frontend', 'modeling_agent'];

const STATE_DOT: Record<LabPreviewService['state'], string> = {
  running: 'bg-success',
  starting: 'bg-warning animate-pulse',
  stopped: 'bg-muted-foreground/50',
  failed: 'bg-destructive',
};

export interface LabPreviewTabProps {
  /** The change the tab shows. */
  change: { changeId: string; title: string; owner: string };
  githubSession: string;
  /** The tab is selected and the document visible: only then does it take, read and touch its slot. */
  visible: boolean;
}

type Phase =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'off'; detail: string }
  | { kind: 'refused'; message: string }
  | { kind: 'ready' };

/** What the user reads for a failed request: plain copy when the server was not reached, else its refusal. */
function failureText(error: unknown): string {
  return isNetworkError(error) ? describeNetworkError(error) : labRefusal(error).message;
}

/**
 * The pool reports a slot being prepared (environments, then the services' start) as every service
 * `starting` with the step as the slot's and each service's detail (`preview.py` `_render`); a service the slot
 * does not run (the modeling agent, `stopped` with its reason) is left out.
 */
function isPreparing(slot: LabPreviewSlot): boolean {
  const run = slot.services.filter((service) => service.state !== 'stopped');
  return (
    slot.detail !== '' &&
    run.length > 0 &&
    run.every((service) => service.state === 'starting' && service.detail === slot.detail)
  );
}

/** `https:` is framed; `http:` (local mode) is only linked, since the editor CSP frames `https:` alone. */
function urlKind(url: string | null): 'frame' | 'link' | null {
  if (!url) return null;
  try {
    const { protocol } = new URL(url);
    if (protocol === 'https:') return 'frame';
    if (protocol === 'http:') return 'link';
  } catch {
    // not a URL: neither framed nor linked
  }
  console.warn('Lab preview: the slot URL is neither https: nor http:, so it is not shown');
  return null;
}

/** "backend", "editor", "modeling agent". */
function useServiceLabel() {
  const { t } = useTranslation();
  return (name: LabPreviewServiceName): string => {
    switch (name) {
      case 'backend':
        return t('lab.preview.service.backend', { defaultValue: 'backend' });
      case 'frontend':
        return t('lab.preview.service.frontend', { defaultValue: 'editor' });
      case 'modeling_agent':
        return t('lab.preview.service.modelingAgent', { defaultValue: 'modeling agent' });
    }
  };
}

function useStateLabel() {
  const { t } = useTranslation();
  return (state: LabPreviewService['state']): string => {
    switch (state) {
      case 'running':
        return t('lab.preview.state.running', { defaultValue: 'running' });
      case 'starting':
        return t('lab.preview.state.starting', { defaultValue: 'starting' });
      case 'stopped':
        return t('lab.preview.state.stopped', { defaultValue: 'stopped' });
      case 'failed':
        return t('lab.preview.state.failed', { defaultValue: 'failed' });
    }
  };
}

const ordered = (services: LabPreviewService[]) =>
  [...services].sort((a, b) => SERVICE_ORDER.indexOf(a.name) - SERVICE_ORDER.indexOf(b.name));

/** The slot `shown` with this change in place of its copy in `view`. */
function withSlot(view: LabPreviewView, shown: LabPreviewSlot): LabPreviewView {
  const others = view.slots.filter((slot) => slot.slot !== shown.slot);
  return { ...view, slots: [...others, shown].sort((a, b) => a.slot - b.slot) };
}

/**
 * The Try it tab of a change: a preview slot showing the change's own editor, backend and modeling
 * agent, framed from the slot's origin. While visible it takes a slot for the change, follows it
 * (every {@link PREVIEW_FAST_POLL_MS} while something starts, else {@link PREVIEW_SLOW_POLL_MS}) and
 * touches it every {@link PREVIEW_TOUCH_MS}; hidden or unmounted, it makes no request.
 */
export const LabPreviewTab: React.FC<LabPreviewTabProps> = (props) => (
  // A new change starts from a clean tab: no slot, no view of the previous one.
  <PreviewTab key={props.change.changeId} {...props} />
);

const PreviewTab: React.FC<LabPreviewTabProps> = ({ change, githubSession, visible }) => {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [view, setView] = useState<LabPreviewView | null>(null);
  /** The slot taken for this change; it may since show another change. */
  const [slotIndex, setSlotIndex] = useState<number | null>(null);
  const [reads, setReads] = useState(0);
  const [readError, setReadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [restarting, setRestarting] = useState(false);
  const [logOf, setLogOf] = useState<LabPreviewServiceName | null>(null);
  const alive = useRef(true);
  /** A take is in flight: a second effect run (React's strict mode) must not take twice. */
  const taking = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const take = useCallback(async () => {
    if (taking.current) return;
    taking.current = true;
    setPhase({ kind: 'loading' });
    try {
      const current = await getLabPreview(githubSession);
      if (!alive.current) return;
      if (!current.enabled) {
        setView(current);
        setPhase({ kind: 'off', detail: current.detail });
        return;
      }
      const slot = await takeLabPreviewSlot(githubSession, change.changeId);
      if (!alive.current) return;
      setView(withSlot(current, slot));
      setSlotIndex(slot.slot);
      setPhase({ kind: 'ready' });
    } catch (error) {
      if (alive.current) setPhase({ kind: 'refused', message: failureText(error) });
    } finally {
      taking.current = false;
    }
  }, [githubSession, change.changeId]);

  const read = useCallback(async () => {
    try {
      const current = await getLabPreview(githubSession);
      if (!alive.current) return;
      setView(current);
      setReadError(null);
    } catch (error) {
      if (alive.current) setReadError(failureText(error));
    } finally {
      if (alive.current) setReads((count) => count + 1);
    }
  }, [githubSession]);

  const mine = view?.slots.find((slot) => slot.changeId === change.changeId) ?? null;
  const held = view?.slots.find((slot) => slot.slot === slotIndex) ?? null;
  const shown = mine ?? held;
  const ownSlot = phase.kind === 'ready' && mine && mine.enabled ? mine.slot : null;
  const fast = mine !== null && (isPreparing(mine) || mine.services.some((service) => service.state === 'starting'));
  const delay = fast ? PREVIEW_FAST_POLL_MS : PREVIEW_SLOW_POLL_MS;

  // Take a slot the first time the tab is shown (and again after "Try again").
  useEffect(() => {
    if (visible && phase.kind === 'idle') void take();
  }, [visible, phase.kind, take]);

  // Follow the slot while visible; each finished read schedules the next.
  useEffect(() => {
    if (!visible || phase.kind !== 'ready') return undefined;
    const timer = window.setTimeout(() => void read(), delay);
    return () => window.clearTimeout(timer);
  }, [visible, phase.kind, delay, reads, read]);

  // Shown again after being hidden: the view is stale, read it at once.
  const wasVisible = useRef(visible);
  useEffect(() => {
    if (visible && !wasVisible.current && phase.kind === 'ready') void read();
    wasVisible.current = visible;
  }, [visible, phase.kind, read]);

  // Keep the slot while this change is in it and the tab is visible.
  useEffect(() => {
    if (!visible || ownSlot === null) return undefined;
    const timer = window.setInterval(() => {
      touchLabPreviewSlot(githubSession, ownSlot).catch((error: unknown) => {
        console.warn('Lab preview: could not touch slot', ownSlot, error);
      });
    }, PREVIEW_TOUCH_MS);
    return () => window.clearInterval(timer);
  }, [visible, ownSlot, githubSession]);

  const restart = async (slot: number, service?: LabPreviewServiceName) => {
    setRestarting(true);
    setActionError(null);
    try {
      const next = service ? await restartLabPreview(githubSession, slot, service) : await restartLabPreview(githubSession, slot);
      if (alive.current) setView(next);
    } catch (error) {
      if (alive.current) setActionError(failureText(error));
    } finally {
      if (alive.current) setRestarting(false);
    }
  };

  let body: React.ReactNode;
  if (phase.kind === 'idle' || phase.kind === 'loading') {
    body = (
      <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        {t('lab.preview.loading', { defaultValue: 'Opening the preview...' })}
      </p>
    );
  } else if (phase.kind === 'off') {
    body = (
      <div data-testid="lab-preview-off" className="rounded-2xl border border-border bg-card p-5 text-sm">
        <p className="font-medium text-foreground">
          {t('lab.preview.off', { defaultValue: 'The preview is switched off on this lab.' })}
        </p>
        {phase.detail && <p className="mt-1 text-muted-foreground">{phase.detail}</p>}
      </div>
    );
  } else if (phase.kind === 'refused') {
    body = (
      <Alert data-testid="lab-preview-refused">
        <CircleAlert aria-hidden />
        <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
          <span>{phase.message}</span>
          <Button variant="outline" size="xs" onClick={() => setPhase({ kind: 'idle' })}>
            {t('lab.preview.tryAgain', { defaultValue: 'Try again' })}
          </Button>
        </AlertDescription>
      </Alert>
    );
  } else if (!mine) {
    body = (
      <div data-testid="lab-preview-other" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-5 text-sm">
        <span className="text-foreground">
          {held?.changeId
            ? t('lab.preview.otherChange', {
                defaultValue: 'Slot {{slot}} shows {{title}} (@{{owner}}).',
                slot: held.slot + 1,
                title: held.title ?? held.changeId,
                owner: held.owner ?? '',
              })
            : t('lab.preview.noChange', {
                defaultValue: 'Slot {{slot}} shows no change.',
                slot: (slotIndex ?? 0) + 1,
              })}
        </span>
        <Button size="sm" onClick={() => void take()}>
          {t('lab.preview.takeSlot', { defaultValue: 'Try this change' })}
        </Button>
      </div>
    );
  } else {
    body = (
      <SlotBody
        slot={mine}
        title={change.title}
        restarting={restarting}
        onRestart={(service) => void restart(mine.slot, service)}
        onShowLog={setLogOf}
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3" data-testid="lab-preview-tab">
      <p
        data-testid="lab-preview-warning"
        className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-foreground"
      >
        <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden />
        {t('lab.preview.warning', {
          defaultValue:
            "The preview runs this change's code, which nobody has reviewed. Do not enter your own API keys or passwords in it.",
        })}
      </p>
      {phase.kind === 'ready' && mine && (
        <Strip
          slot={mine}
          restarting={restarting}
          onRestart={(service) => void restart(mine.slot, service)}
          onShowLog={setLogOf}
        />
      )}
      {shown && !shown.confined && phase.kind === 'ready' && (
        <p data-testid="lab-preview-unconfined" className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldAlert className="size-3.5 shrink-0" aria-hidden />
          {t('lab.preview.unconfined', { defaultValue: 'On this machine the preview runs without the sandbox.' })}
        </p>
      )}
      {readError && (
        <p role="status" className="text-xs text-destructive">
          {t('lab.preview.readError', { defaultValue: 'The preview status could not be read: {{error}}', error: readError })}
        </p>
      )}
      {actionError && (
        <Alert variant="destructive">
          <CircleAlert aria-hidden />
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      )}
      <div className="flex min-h-0 flex-1 flex-col">{body}</div>
      {mine && (
        <LogDialog
          githubSession={githubSession}
          slot={mine.slot}
          service={logOf}
          onClose={() => setLogOf(null)}
        />
      )}
    </div>
  );
};

/** "Slot 1 shows this change · started 2 minutes ago · backend running · ..." and the slot's actions. */
const Strip: React.FC<{
  slot: LabPreviewSlot;
  restarting: boolean;
  onRestart: (service?: LabPreviewServiceName) => void;
  onShowLog: (service: LabPreviewServiceName) => void;
}> = ({ slot, restarting, onRestart, onShowLog }) => {
  const { t, i18n } = useTranslation();
  const serviceLabel = useServiceLabel();
  const stateLabel = useStateLabel();
  const started = slot.startedAt !== null ? formatAgo(slot.startedAt, i18n.language) : null;
  const linkable = urlKind(slot.url) !== null;
  return (
    <div
      data-testid="lab-preview-strip"
      className="flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border border-border bg-card px-3 py-1.5"
    >
      <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <span className="font-medium text-foreground">
          {t('lab.preview.slotShows', { defaultValue: 'Slot {{slot}} shows this change', slot: slot.slot + 1 })}
        </span>
        {started && (
          <>
            <span aria-hidden className="text-muted-foreground/60">·</span>
            <span className="text-muted-foreground" title={started.exact}>
              {t('lab.preview.started', { defaultValue: 'started {{ago}}', ago: started.ago })}
            </span>
          </>
        )}
        {ordered(slot.services).map((service) => (
          <React.Fragment key={service.name}>
            <span aria-hidden className="text-muted-foreground/60">·</span>
            <span className="inline-flex items-center gap-1.5 text-muted-foreground" title={service.detail || undefined}>
              <span aria-hidden className={cn('size-2 rounded-full', STATE_DOT[service.state])} />
              {t('lab.preview.serviceState', {
                defaultValue: '{{service}} {{state}}',
                service: serviceLabel(service.name),
                state: stateLabel(service.state),
              })}
            </span>
          </React.Fragment>
        ))}
      </p>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {linkable && slot.url && (
          <Button asChild variant="ghost" size="xs">
            <a href={slot.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink aria-hidden />
              {t('lab.preview.openNewTab', { defaultValue: 'Open in a new tab' })}
            </a>
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="xs" disabled={restarting}>
              {restarting ? <Loader2 className="animate-spin" aria-hidden /> : <RotateCcw aria-hidden />}
              {t('lab.preview.restart', { defaultValue: 'Restart' })}
              <ChevronDown aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {SERVICE_ORDER.map((name) => (
              <DropdownMenuItem key={name} onSelect={() => onRestart(name)}>
                {t('lab.preview.restartService', { defaultValue: 'Restart the {{service}}', service: serviceLabel(name) })}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onRestart()}>
              {t('lab.preview.restartAll', { defaultValue: 'Restart all' })}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="xs">
              <FileText aria-hidden />
              {t('lab.preview.showLog', { defaultValue: 'Show log' })}
              <ChevronDown aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {SERVICE_ORDER.map((name) => (
              <DropdownMenuItem key={name} onSelect={() => onShowLog(name)}>
                {serviceLabel(name)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

/** The slot showing this change: preparation, failures, reasons a service is not running, and the preview itself. */
const SlotBody: React.FC<{
  slot: LabPreviewSlot;
  title: string;
  restarting: boolean;
  onRestart: (service: LabPreviewServiceName) => void;
  onShowLog: (service: LabPreviewServiceName) => void;
}> = ({ slot, title, restarting, onRestart, onShowLog }) => {
  const { t } = useTranslation();
  const serviceLabel = useServiceLabel();
  if (!slot.enabled) {
    return (
      <div data-testid="lab-preview-off" className="rounded-2xl border border-border bg-card p-5 text-sm">
        <p className="font-medium text-foreground">
          {t('lab.preview.off', { defaultValue: 'The preview is switched off on this lab.' })}
        </p>
        {slot.detail && <p className="mt-1 text-muted-foreground">{slot.detail}</p>}
      </div>
    );
  }
  if (isPreparing(slot)) {
    return (
      <div data-testid="lab-preview-preparing" role="status" className="rounded-2xl border border-border bg-card p-5 text-sm">
        <p className="flex items-center gap-2 font-medium text-foreground">
          <Loader2 className="size-4 animate-spin text-brand" aria-hidden />
          {t('lab.preview.preparing', { defaultValue: "Preparing this change's environment (first time only)..." })}
        </p>
        <p className="mt-1 pl-6 text-muted-foreground">{slot.detail}</p>
      </div>
    );
  }

  const services = ordered(slot.services);
  const failed = services.filter((service) => service.state === 'failed');
  const stopped = services.filter((service) => service.state === 'stopped' && service.detail);
  const editor = services.find((service) => service.name === 'frontend');
  const kind = urlKind(slot.url);

  let preview: React.ReactNode = null;
  if (kind === 'link' && slot.url) {
    preview = (
      <div data-testid="lab-preview-http" className="rounded-2xl border border-border bg-card p-5 text-sm">
        <a
          href={slot.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 font-medium text-primary underline-offset-2 hover:underline"
        >
          {t('lab.preview.openPreview', { defaultValue: 'Open the preview' })}
          <ExternalLink className="size-3.5" aria-hidden />
        </a>
        <p className="mt-1 text-muted-foreground">
          {t('lab.preview.httpReason', {
            defaultValue: 'This editor can frame only https: pages, so the preview opens in a new tab.',
          })}
        </p>
      </div>
    );
  } else if (kind === 'frame' && slot.url && editor?.state === 'running') {
    preview = (
      <iframe
        src={slot.url}
        title={t('lab.preview.frameTitle', { defaultValue: 'Preview of {{title}}', title })}
        sandbox={PREVIEW_IFRAME_SANDBOX}
        className="min-h-[480px] w-full flex-1 rounded-xl border border-border bg-white"
      />
    );
  } else if (kind === 'frame' && editor?.state === 'starting') {
    preview = (
      <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        {t('lab.preview.editorStarting', { defaultValue: "The preview's editor is starting..." })}
      </p>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {failed.map((service) => (
        <div
          key={service.name}
          data-testid={`lab-preview-failed-${service.name}`}
          className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium text-foreground">
              {t('lab.preview.failed', {
                defaultValue: 'The {{service}} failed: {{detail}}',
                service: serviceLabel(service.name),
                detail: service.detail,
              })}
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" size="xs" onClick={() => onShowLog(service.name)}>
                <FileText aria-hidden />
                {t('lab.preview.showLog', { defaultValue: 'Show log' })}
              </Button>
              <Button variant="outline" size="xs" disabled={restarting} onClick={() => onRestart(service.name)}>
                <RotateCcw aria-hidden />
                {t('lab.preview.restartService', { defaultValue: 'Restart the {{service}}', service: serviceLabel(service.name) })}
              </Button>
            </div>
          </div>
          {service.logTail.length > 0 && (
            <pre className="mt-3 max-h-60 overflow-auto rounded-lg bg-muted/60 p-3 font-mono text-xs leading-relaxed text-foreground">
              {service.logTail.join('\n')}
            </pre>
          )}
        </div>
      ))}
      {stopped.map((service) => (
        <p key={service.name} data-testid={`lab-preview-stopped-${service.name}`} className="text-sm text-muted-foreground">
          {t('lab.preview.stopped', {
            defaultValue: 'The {{service}} is not running: {{detail}}',
            service: serviceLabel(service.name),
            detail: service.detail,
          })}
        </p>
      ))}
      {preview}
    </div>
  );
};

/** The last {@link PREVIEW_LOG_LINES} lines of one service's log, read when the dialog opens. */
const LogDialog: React.FC<{
  githubSession: string;
  slot: number;
  service: LabPreviewServiceName | null;
  onClose: () => void;
}> = ({ githubSession, slot, service, onClose }) => {
  const { t } = useTranslation();
  const serviceLabel = useServiceLabel();
  const [log, setLog] = useState<LabPreviewLog | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!service) return undefined;
    let current = true;
    setLog(null);
    setError(null);
    getLabPreviewLog(githubSession, slot, service, PREVIEW_LOG_LINES)
      .then((result) => current && setLog(result))
      .catch((failure: unknown) => current && setError(failureText(failure)));
    return () => {
      current = false;
    };
  }, [githubSession, slot, service]);

  return (
    <Dialog open={service !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {service
              ? t('lab.preview.logTitle', { defaultValue: 'Log of the {{service}}', service: serviceLabel(service) })
              : null}
          </DialogTitle>
          <DialogDescription>
            {log?.truncated
              ? t('lab.preview.logTruncated', {
                  defaultValue: 'Only the last {{lines}} lines are shown.',
                  lines: PREVIEW_LOG_LINES,
                })
              : t('lab.preview.logRedacted', { defaultValue: 'Secrets in the log are redacted.' })}
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : log === null ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            {t('lab.preview.logLoading', { defaultValue: 'Reading the log...' })}
          </p>
        ) : (
          <pre
            data-testid="lab-preview-log"
            className="max-h-[60vh] overflow-auto rounded-lg bg-muted/60 p-3 font-mono text-xs leading-relaxed text-foreground"
          >
            {log.lines.length > 0 ? log.lines.join('\n') : t('lab.preview.logEmpty', { defaultValue: 'The log is empty.' })}
          </pre>
        )}
      </DialogContent>
    </Dialog>
  );
};
