import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useProject } from '../../app/hooks/useProject';
import { useAppDispatch } from '../../app/store/hooks';
import { setTraceabilityEnabledThunk } from '../../app/store/workspaceSlice';
import { globalConfirm } from '../../shared/services/confirm/globalConfirm';
import { indexTrace } from '../../shared/traceability/traceQueries';
import { deleteProjectTrace, isTraceabilityEnabled, useProjectTrace } from '../../shared/traceability/traceStore';
import { CoverageView } from './CoverageView';
import { ElementsView } from './ElementsView';
import { LineageView } from './LineageView';
import { TimelineView } from './TimelineView';

type Tab = 'timeline' | 'elements' | 'coverage' | 'lineage';
const TABS: Tab[] = ['timeline', 'elements', 'coverage', 'lineage'];

/** The project's traces: what was modeled, by whom, and which code was generated from it. */
export const TraceabilityPage: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { currentProject } = useProject();
  const trace = useProjectTrace(currentProject?.id);
  const index = useMemo(() => (trace ? indexTrace(trace) : null), [trace]);
  const [tab, setTab] = useState<Tab>('timeline');
  const [selectedElement, setSelectedElement] = useState<string | null>(null);

  if (!currentProject) {
    return <div className="p-6 text-sm text-muted-foreground">{t('traceability.noProject')}</div>;
  }
  if (!trace || !index) {
    return <div className="p-6 text-sm text-muted-foreground">{t('traceability.loading')}</div>;
  }
  const enabled = isTraceabilityEnabled(currentProject);
  const isEmpty = trace.operations.length === 0;

  const openElement = (artifactId: string) => {
    setSelectedElement(artifactId);
    setTab('elements');
  };

  const showLineage = (artifactId: string) => {
    setSelectedElement(artifactId);
    setTab('lineage');
  };

  const clearTrace = async () => {
    const confirmed = await globalConfirm({
      title: t('traceability.clear.confirmTitle'),
      description: t('traceability.clear.confirmDescription'),
      confirmLabel: t('traceability.clear.confirm'),
      variant: 'danger',
    });
    if (confirmed) deleteProjectTrace(currentProject.id);
  };

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-6xl space-y-4 p-6">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <CardTitle>{t('traceability.title')}</CardTitle>
                <CardDescription>{t('traceability.description')}</CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="outline" size="sm" onClick={clearTrace} disabled={isEmpty} className="gap-1">
                  <Trash2 className="size-4" />
                  {t('traceability.clear.button')}
                </Button>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="trace-enabled"
                    checked={enabled}
                    onCheckedChange={(checked) => void dispatch(setTraceabilityEnabledThunk(checked))}
                  />
                  <Label htmlFor="trace-enabled">{t('traceability.toggle.label')}</Label>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div role="tablist" className="flex gap-1 border-b border-border">
              {TABS.map((value) => (
                <button
                  key={value}
                  role="tab"
                  type="button"
                  aria-selected={tab === value}
                  onClick={() => setTab(value)}
                  className={`-mb-px border-b-2 px-3 py-2 text-sm transition-colors ${
                    tab === value
                      ? 'border-brand font-medium text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t(`traceability.tabs.${value}`)}
                </button>
              ))}
            </div>
            {isEmpty ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                {enabled ? t('traceability.emptyEnabled') : t('traceability.emptyDisabled')}
              </p>
            ) : (
              <>
                {tab === 'timeline' && <TimelineView index={index} onOpenElement={openElement} />}
                {tab === 'elements' && (
                  <ElementsView
                    index={index}
                    selectedId={selectedElement}
                    onSelect={setSelectedElement}
                    onShowLineage={showLineage}
                  />
                )}
                {tab === 'coverage' && <CoverageView index={index} onOpenElement={openElement} />}
                {tab === 'lineage' && (
                  <LineageView
                    index={index}
                    rootId={selectedElement}
                    onRootChange={setSelectedElement}
                    onOpenElement={openElement}
                  />
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
