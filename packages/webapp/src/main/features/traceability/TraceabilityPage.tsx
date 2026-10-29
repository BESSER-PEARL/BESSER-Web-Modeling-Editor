import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { ArrowLeft, Download, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useProject } from '../../app/hooks/useProject';
import { useAppDispatch } from '../../app/store/hooks';
import { setTraceabilityEnabledThunk } from '../../app/store/workspaceSlice';
import { useFileDownload } from '../../shared/services/file-download/useFileDownload';
import { globalConfirm } from '../../shared/services/confirm/globalConfirm';
import { indexTrace } from '../../shared/traceability/traceQueries';
import {
  deleteProjectTrace,
  isTraceabilityEnabled,
  replaceProjectTrace,
  traceFileProblem,
  useProjectTrace,
} from '../../shared/traceability/traceStore';
import type { TraceFile } from '../../shared/types/traceability';
import { CoverageView } from './CoverageView';
import { ElementsView } from './ElementsView';
import { TimelineView } from './TimelineView';

type Tab = 'timeline' | 'elements' | 'coverage';
const TABS: Tab[] = ['timeline', 'elements', 'coverage'];

/** The project's traces: what was modelled, by whom, and which code was generated from it. */
export const TraceabilityPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { currentProject } = useProject();
  const downloadFile = useFileDownload();
  const trace = useProjectTrace(currentProject?.id);
  const index = useMemo(() => (trace ? indexTrace(trace) : null), [trace]);
  const [tab, setTab] = useState<Tab>('timeline');
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  if (!currentProject || !trace || !index) {
    return <div className="p-6 text-sm text-muted-foreground">{t('traceability.noProject')}</div>;
  }
  const enabled = isTraceabilityEnabled(currentProject);
  const isEmpty = trace.operations.length === 0;

  const openElement = (artifactId: string) => {
    setSelectedElement(artifactId);
    setTab('elements');
  };

  const exportTrace = () => {
    const blob = new Blob([JSON.stringify(trace, null, 2)], { type: 'application/json' });
    downloadFile({ file: blob, filename: `${currentProject.name || 'project'}.trace.json` });
  };

  const importTrace = async (file: File) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      toast.error(t('traceability.errors.notATrace'));
      return;
    }
    const problem = traceFileProblem(parsed, currentProject.id);
    if (problem) {
      toast.error(problem);
      return;
    }
    if (!isEmpty) {
      const confirmed = await globalConfirm({
        title: t('traceability.import.confirmTitle'),
        description: t('traceability.import.confirmDescription'),
        confirmLabel: t('traceability.import.confirm'),
        variant: 'danger',
      });
      if (!confirmed) return;
    }
    replaceProjectTrace(currentProject.id, parsed as TraceFile);
    toast.success(t('traceability.import.done'));
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
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="gap-1">
        <ArrowLeft className="size-4" />
        {t('traceability.backToEditor')}
      </Button>
      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>{t('traceability.title')}</CardTitle>
              <CardDescription>{t('traceability.description')}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={exportTrace} disabled={isEmpty} className="gap-1">
                <Download className="size-4" />
                {t('traceability.export')}
              </Button>
              <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()} className="gap-1">
                <Upload className="size-4" />
                {t('traceability.import.button')}
              </Button>
              <Button variant="outline" size="sm" onClick={clearTrace} disabled={isEmpty} className="gap-1">
                <Trash2 className="size-4" />
                {t('traceability.clear.button')}
              </Button>
              <input
                ref={fileInput}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file) void importTrace(file);
                }}
              />
            </div>
          </div>
          <div className="flex items-start gap-2 rounded-md border border-border p-3">
            <Checkbox
              id="trace-enabled"
              checked={enabled}
              onCheckedChange={(checked) => void dispatch(setTraceabilityEnabledThunk(checked))}
              className="mt-0.5"
            />
            <div>
              <Label htmlFor="trace-enabled">{t('traceability.toggle.label')}</Label>
              <p className="text-xs text-muted-foreground">{t('traceability.toggle.help')}</p>
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
                  tab === value ? 'border-brand font-medium text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
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
              {tab === 'elements' && <ElementsView index={index} selectedId={selectedElement} onSelect={setSelectedElement} />}
              {tab === 'coverage' && <CoverageView index={index} onOpenElement={openElement} />}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
