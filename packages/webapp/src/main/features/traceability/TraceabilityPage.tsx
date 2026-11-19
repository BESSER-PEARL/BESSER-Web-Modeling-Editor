import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CircleOff, GitBranch, Loader2, SearchX, Trash2, X } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useProject } from '../../app/hooks/useProject';
import { useAppDispatch } from '../../app/store/hooks';
import { setTraceabilityEnabledThunk } from '../../app/store/workspaceSlice';
import { globalConfirm } from '../../shared/services/confirm/globalConfirm';
import { lineageOf } from '../../shared/traceability/lineage';
import { indexTrace, resolveArtifactId } from '../../shared/traceability/traceQueries';
import { clearTraceLoadProblem, useTraceLoadProblem } from '../../shared/traceability/traceLoadStatus';
import { deleteProjectTrace, isTraceabilityEnabled, loadProjectTrace, useProjectTrace } from '../../shared/traceability/traceStore';
import { traceSummary } from '../../shared/traceability/traceSummary';
import { CoverageView } from './CoverageView';
import { ElementsView } from './ElementsView';
import { LineageView } from './LineageView';
import { RequirementsView } from './RequirementsView';
import { TimelineView } from './TimelineView';
import { TraceSummaryHeader } from './TraceSummaryHeader';
import { PageTabs, TabPanel } from './components/PageTabs';
import { TRACEABILITY_TABS } from './navigation';
import { useTraceabilityUrlState } from './useTraceabilityUrlState';

const TABS_ID = 'traceability';

/** The project's traces: what was modeled, by whom, and which code was generated from it. */
export const TraceabilityPage: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { currentProject } = useProject();
  const projectId = currentProject?.id;
  const trace = useProjectTrace(projectId);
  const loadProblem = useTraceLoadProblem(projectId);
  const index = useMemo(() => (trace ? indexTrace(trace) : null), [trace]);
  // The whole project's lineage, as it is now: the header's figures, the Lineage view and its picker share it.
  const projectLineage = useMemo(() => (index ? lineageOf(index, null, { history: false }) : null), [index]);
  const summary = useMemo(() => (index && projectLineage ? traceSummary(index, projectLineage) : null), [index, projectLineage]);
  const url = useTraceabilityUrlState(projectId);

  if (!currentProject) {
    return <CenteredNote>{t('traceability.noProject')}</CenteredNote>;
  }
  if (!trace || !index || !projectLineage || !summary) {
    return (
      <CenteredNote>
        <Loader2 className="size-4 animate-spin" aria-hidden />
        {t('traceability.loading')}
      </CenteredNote>
    );
  }
  const enabled = isTraceabilityEnabled(currentProject);
  const isEmpty = trace.operations.length === 0;
  // Ids from the URL: a trace artifact id or an editor element id; one the trace does not hold is ignored.
  const root = resolveArtifactId(index, url.root);
  const element = resolveArtifactId(index, url.element);
  const unknownIds = [url.root && !root ? url.root : null, url.element && !element ? url.element : null].filter(Boolean);

  const openElement = (artifactId: string) => url.navigate({ tab: 'elements', element: artifactId });
  const selectElement = (artifactId: string) => url.navigate({ element: artifactId }, { replace: true });
  const showLineage = (artifactId: string | null) => url.navigate({ tab: 'lineage', root: artifactId });
  const dismissUnknown = () =>
    url.navigate({ root: url.root && !root ? null : url.root, element: url.element && !element ? null : url.element }, { replace: true });

  const clearTrace = async () => {
    const confirmed = await globalConfirm({
      title: t('traceability.clear.confirmTitle'),
      description: t('traceability.clear.confirmDescription'),
      confirmLabel: t('traceability.clear.confirm'),
      variant: 'danger',
    });
    if (confirmed) {
      deleteProjectTrace(currentProject.id);
      clearTraceLoadProblem(currentProject.id);
      // Start the empty trace now: the page would otherwise wait for one that nothing loads.
      void loadProjectTrace(currentProject.id);
    }
  };
  const setEnabled = (checked: boolean) => void dispatch(setTraceabilityEnabledThunk(checked));

  return (
    <div className="h-full overflow-auto">
      <header className="border-b border-border/40 px-6 py-5 sm:px-10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand ring-1 ring-brand/15">
              <GitBranch className="size-4" aria-hidden />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold tracking-tight">{t('traceability.title')}</h1>
              <p className="text-sm text-muted-foreground">{t('traceability.description')}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5">
              <Checkbox id="trace-enabled" checked={enabled} onCheckedChange={(checked) => setEnabled(checked === true)} />
              <Label htmlFor="trace-enabled" className="text-sm font-normal">{t('traceability.toggle.label')}</Label>
              <span
                className={`ml-1 rounded-full px-2 py-px text-[10px] font-semibold uppercase tracking-wide ${
                  enabled ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground'
                }`}
              >
                {t(enabled ? 'traceability.toggle.on' : 'traceability.toggle.off')}
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={clearTrace} disabled={isEmpty && !loadProblem} className="gap-1">
              <Trash2 className="size-4" />
              {t('traceability.clear.button')}
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-4 px-6 pb-5 pt-6 sm:px-10">
        {loadProblem && (
          <Alert variant="destructive">
            <AlertTitle>{t('traceability.loadError.title')}</AlertTitle>
            <AlertDescription>{t(`traceability.loadError.${loadProblem}`)}</AlertDescription>
          </Alert>
        )}
        {!enabled && !isEmpty && (
          <Alert variant="warning" className="flex flex-wrap items-center gap-3 [&>svg~*]:pl-0">
            <CircleOff className="!static size-4 shrink-0 text-warning" aria-hidden />
            <div className="min-w-0 flex-1">
              <AlertTitle>{t('traceability.recordingOff.title')}</AlertTitle>
              <AlertDescription>{t('traceability.recordingOff.description')}</AlertDescription>
            </div>
            <Button size="sm" variant="outline" className="bg-background" onClick={() => setEnabled(true)}>
              {t('traceability.recordingOff.turnOn')}
            </Button>
          </Alert>
        )}
        {unknownIds.length > 0 && (
          <Alert variant="info" className="flex items-center gap-3 [&>svg~*]:pl-0">
            <SearchX className="!static size-4 shrink-0 text-info" aria-hidden />
            <AlertDescription className="min-w-0 flex-1">{t('traceability.unknownTarget')}</AlertDescription>
            <Button size="icon" variant="ghost" className="size-7" onClick={dismissUnknown} aria-label={t('traceability.dismiss')}>
              <X className="size-4" />
            </Button>
          </Alert>
        )}

        {!isEmpty && <TraceSummaryHeader summary={summary} onShowOutOfDate={() => url.setTab('coverage')} />}
      </div>

      {/* The tabs stay in reach while a long timeline or matrix scrolls. */}
      <div className="sticky top-0 z-10 border-b border-border bg-background">
        <PageTabs
          id={TABS_ID}
          tabs={TRACEABILITY_TABS}
          value={url.tab}
          onChange={url.setTab}
          label={(value) => t(`traceability.tabs.${value}`)}
          ariaLabel={t('traceability.tabs.label')}
          className="mx-auto max-w-7xl border-b-0 px-3 [scrollbar-width:none] sm:px-7 [&::-webkit-scrollbar]:hidden"
        />
      </div>

      <div className="mx-auto max-w-7xl px-6 pb-10 pt-5 sm:px-10">
        <TabPanel id={TABS_ID} value={url.tab}>
          {isEmpty ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-14 text-center">
              <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground" aria-hidden>
                {enabled ? <GitBranch className="size-5" /> : <CircleOff className="size-5" />}
              </span>
              <p className="max-w-md text-sm text-muted-foreground">
                {enabled ? t('traceability.emptyEnabled') : t('traceability.emptyDisabled')}
              </p>
            </div>
          ) : (
            <>
              {url.tab === 'timeline' && <TimelineView index={index} onOpenElement={openElement} />}
              {url.tab === 'elements' && (
                <ElementsView index={index} selectedId={element} onSelect={selectElement} onShowLineage={showLineage} />
              )}
              {url.tab === 'coverage' && <CoverageView index={index} onOpenElement={openElement} highlightId={element} />}
              {url.tab === 'lineage' && (
                <LineageView
                  index={index}
                  projectLineage={projectLineage}
                  rootId={root}
                  onRootChange={showLineage}
                  onOpenElement={openElement}
                />
              )}
              {url.tab === 'requirements' && (
                <RequirementsView index={index} onOpenElement={openElement} onShowLineage={showLineage} />
              )}
            </>
          )}
        </TabPanel>
      </div>
    </div>
  );
};

const CenteredNote: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex h-full items-center justify-center gap-2 p-8 text-sm text-muted-foreground">{children}</div>
);
