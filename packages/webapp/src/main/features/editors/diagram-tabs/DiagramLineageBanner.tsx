import React, { useMemo } from 'react';
import { toast } from 'react-toastify';
import { Trans, useTranslation } from 'react-i18next';
import { ProjectDiagram, SupportedDiagramType, isUMLModel } from '../../../shared/types/project';
import { useAppDispatch, useAppSelector } from '../../../app/store/hooks';
import { openDiagramThunk, selectActiveDiagramType, selectProject } from '../../../app/store/workspaceSlice';
import { hashUmlModel } from '../../../shared/utils/lineageHash';

interface DiagramLineageBannerProps {
  activeDiagram: ProjectDiagram | undefined;
}

/**
 * Back-links from a derived diagram to its source: "Implementation of <lane>"
 * on an Agent diagram that a BPMN lane points to, otherwise "Derived from
 * <diagram>" for diagrams with `derivedFrom` (amber when the source changed
 * since the derivation).
 */
export const DiagramLineageBanner: React.FC<DiagramLineageBannerProps> = ({ activeDiagram }) => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const currentProject = useAppSelector(selectProject);
  const currentDiagramType = useAppSelector(selectActiveDiagramType);

  // The lane back-link and the "Derived from" badge reference the same
  // source, so only the lane link shows when both apply.
  const agentLaneRef = useMemo(() => {
    if (currentDiagramType !== 'AgentDiagram' || !activeDiagram) return null;
    const bpmnDiagrams = currentProject?.diagrams.BPMN ?? [];
    for (let i = 0; i < bpmnDiagrams.length; i++) {
      const model = bpmnDiagrams[i].model;
      if (!isUMLModel(model)) continue;
      const lane = Object.values(model.elements).find(
        (el) => el.type === 'BPMNSwimlane' && 'agentDiagramRef' in el && el.agentDiagramRef === activeDiagram.id,
      );
      if (lane) {
        return { diagramIndex: i, laneName: lane.name.trim() || t('editors.diagramTabs.lineage.unnamedLane') };
      }
    }
    return null;
  }, [activeDiagram, currentDiagramType, currentProject, t]);

  const lineage = activeDiagram?.derivedFrom;
  const source = useMemo(() => {
    if (!lineage) return null;
    const sourceDiagrams = currentProject?.diagrams[lineage.sourceDiagramType] ?? [];
    const index = sourceDiagrams.findIndex((d) => d.id === lineage.sourceDiagramId);
    if (index < 0) return { index, diagram: undefined, stale: false };
    const diagram = sourceDiagrams[index];
    const stale = isUMLModel(diagram.model) ? hashUmlModel(diagram.model) !== lineage.sourceModelHash : false;
    return { index, diagram, stale };
  }, [currentProject, lineage]);

  const openSource = async (diagramType: SupportedDiagramType, index: number) => {
    try {
      await dispatch(openDiagramThunk({ diagramType, index })).unwrap();
    } catch (err) {
      console.error('[lineage] opening the source diagram failed:', err);
      toast.error(t('editors.diagramTabs.lineage.openFailed'));
    }
  };

  if (agentLaneRef) {
    return (
      <div className="flex items-center gap-2 border-t border-border/40 bg-muted/30 px-3 py-1.5">
        <button
          type="button"
          className="text-[11px] font-medium text-brand hover:underline"
          onClick={() => void openSource('BPMN', agentLaneRef.diagramIndex)}
        >
          <Trans
            i18nKey="editors.diagramTabs.lineage.implementationOf"
            values={{ lane: agentLaneRef.laneName }}
            components={{ em: <em /> }}
          />
        </button>
      </div>
    );
  }

  if (!lineage || !source) return null;

  const typeLabel = t(`diagramTypes.${lineage.sourceDiagramType}`);

  if (!source.diagram) {
    return (
      <div className="border-t border-border/40 bg-muted/30 px-3 py-1.5">
        <span className="text-[11px] text-muted-foreground">
          {t('editors.diagramTabs.lineage.sourceDeleted', { type: typeLabel })}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-2 border-t border-border/40 px-3 py-1.5 ${
        source.stale ? 'bg-amber-100/60 dark:bg-amber-900/30' : 'bg-muted/30'
      }`}
      title={source.stale ? t('editors.diagramTabs.lineage.sourceChangedTitle') : undefined}
    >
      <button
        type="button"
        className="text-[11px] font-medium text-brand hover:underline"
        onClick={() => void openSource(lineage.sourceDiagramType, source.index)}
      >
        <Trans
          i18nKey="editors.diagramTabs.lineage.derivedFrom"
          values={{ title: source.diagram.title, type: typeLabel }}
          components={{ em: <em /> }}
        />
      </button>
      {source.stale && (
        <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
          {t('editors.diagramTabs.lineage.sourceChanged')}
        </span>
      )}
    </div>
  );
};
