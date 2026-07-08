import React, { type ReactNode, useEffect, useMemo, useState } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { BookOpen, ExternalLink, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { besserWMERepositoryLink } from '../constants/application-constants';

type GuideSectionId = 'class' | 'object' | 'state' | 'agent' | 'gui' | 'quantum' | 'nn';

interface GuideDetail {
  /** i18n key resolved with t() at render time (also used as a stable React key). */
  titleKey: string;
  /** Rich body rendered via <Trans>; technical code tokens stay literal. */
  body: ReactNode;
  image?: {
    src: string;
    /** i18n key for the alt text. */
    altKey: string;
    heightClass?: string;
  };
}

interface GuideSection {
  id: GuideSectionId;
  /** i18n key resolved with t() at render time. */
  labelKey: string;
  /** i18n key resolved with t() at render time. */
  summaryKey: string;
  details: GuideDetail[];
}

interface HelpGuideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const sharedLinkClass = 'font-medium text-brand underline-offset-4 hover:underline';
const DOCS_URL = 'https://besser.readthedocs.io/en/latest/';

/** Tag → element map shared by every guide body rendered through <Trans>. */
const bodyComponents = {
  p: <p />,
  code: <code />,
  ul: <ul className="list-disc space-y-1 pl-5" />,
  li: <li />,
  strong: <strong />,
};

/** Body components plus the fixed-href B-OCL documentation link. */
const oclBodyComponents = {
  ...bodyComponents,
  boclLink: (
    <a
      href="https://b-ocl-interpreter.readthedocs.io/en/latest/"
      target="_blank"
      rel="noopener noreferrer"
      className={sharedLinkClass}
    />
  ),
};

/** Wraps a translated rich body so paragraphs/lists get consistent spacing. */
const Body: React.FC<{ i18nKey: string; components?: Record<string, ReactNode> }> = ({
  i18nKey,
  components = bodyComponents,
}) => (
  <div className="space-y-2">
    <Trans i18nKey={i18nKey} components={components} />
  </div>
);

const sections: GuideSection[] = [
  {
    id: 'class',
    labelKey: 'dialogs.guide.class.label',
    summaryKey: 'dialogs.guide.class.summary',
    details: [
      {
        titleKey: 'dialogs.guide.class.addClass.title',
        body: <Body i18nKey="dialogs.guide.class.addClass.body" />,
        image: { src: '/images/help/help-create-element.png', altKey: 'dialogs.guide.class.addClass.alt' },
      },
      {
        titleKey: 'dialogs.guide.class.addAssociation.title',
        body: <Body i18nKey="dialogs.guide.class.addAssociation.body" />,
        image: { src: '/images/help/help-create-relationship.jpg', altKey: 'dialogs.guide.class.addAssociation.alt' },
      },
      {
        titleKey: 'dialogs.guide.class.editClass.title',
        body: <Body i18nKey="dialogs.guide.class.editClass.body" />,
        image: { src: '/images/help/help-update-element.jpg', altKey: 'dialogs.guide.class.editClass.alt' },
      },
      {
        titleKey: 'dialogs.guide.class.editAssociation.title',
        body: <Body i18nKey="dialogs.guide.class.editAssociation.body" />,
        image: { src: '/images/help/help-update-asso.jpg', altKey: 'dialogs.guide.class.editAssociation.alt' },
      },
      {
        titleKey: 'dialogs.guide.class.deleteMove.title',
        body: <Body i18nKey="dialogs.guide.class.deleteMove.body" />,
        image: { src: '/images/help/help-move-element.jpg', altKey: 'dialogs.guide.class.deleteMove.alt' },
      },
      {
        titleKey: 'dialogs.guide.class.oclConstraint.title',
        body: <Body i18nKey="dialogs.guide.class.oclConstraint.body" components={oclBodyComponents} />,
        image: { src: '/images/help/help-ocl-constraint.png', altKey: 'dialogs.guide.class.oclConstraint.alt' },
      },
      {
        titleKey: 'dialogs.guide.class.associationClass.title',
        body: <Body i18nKey="dialogs.guide.class.associationClass.body" />,
        image: { src: '/images/help/help-association-class.png', altKey: 'dialogs.guide.class.associationClass.alt' },
      },
    ],
  },
  {
    id: 'object',
    labelKey: 'dialogs.guide.object.label',
    summaryKey: 'dialogs.guide.object.summary',
    details: [
      {
        titleKey: 'dialogs.guide.object.about.title',
        body: <Body i18nKey="dialogs.guide.object.about.body" />,
      },
      {
        titleKey: 'dialogs.guide.object.addObject.title',
        body: <Body i18nKey="dialogs.guide.object.addObject.body" />,
        image: { src: '/images/help/object/help-create-object.png', altKey: 'dialogs.guide.object.addObject.alt' },
      },
      {
        titleKey: 'dialogs.guide.object.editObject.title',
        body: <Body i18nKey="dialogs.guide.object.editObject.body" />,
        image: { src: '/images/help/object/help-update-object.png', altKey: 'dialogs.guide.object.editObject.alt' },
      },
      {
        titleKey: 'dialogs.guide.object.addLink.title',
        body: <Body i18nKey="dialogs.guide.object.addLink.body" />,
        image: { src: '/images/help/object/help-create-object-link.png', altKey: 'dialogs.guide.object.addLink.alt' },
      },
      {
        titleKey: 'dialogs.guide.object.editLink.title',
        body: <Body i18nKey="dialogs.guide.object.editLink.body" />,
        image: { src: '/images/help/object/help-update-object-link.png', altKey: 'dialogs.guide.object.editLink.alt' },
      },
      {
        titleKey: 'dialogs.guide.object.deleteMove.title',
        body: <Body i18nKey="dialogs.guide.object.deleteMove.body" />,
      },
    ],
  },
  {
    id: 'state',
    labelKey: 'dialogs.guide.state.label',
    summaryKey: 'dialogs.guide.state.summary',
    details: [
      {
        titleKey: 'dialogs.guide.state.about.title',
        body: <Body i18nKey="dialogs.guide.state.about.body" />,
      },
      {
        titleKey: 'dialogs.guide.state.initialFinal.title',
        body: <Body i18nKey="dialogs.guide.state.initialFinal.body" />,
        image: { src: '/images/help/statemachine/help-initial-final-states.png', altKey: 'dialogs.guide.state.initialFinal.alt' },
      },
      {
        titleKey: 'dialogs.guide.state.editState.title',
        body: <Body i18nKey="dialogs.guide.state.editState.body" />,
        image: { src: '/images/help/statemachine/help-update-state.png', altKey: 'dialogs.guide.state.editState.alt' },
      },
      {
        titleKey: 'dialogs.guide.state.codeBlock.title',
        body: <Body i18nKey="dialogs.guide.state.codeBlock.body" />,
        image: { src: '/images/help/statemachine/help-code-block.png', altKey: 'dialogs.guide.state.codeBlock.alt' },
      },
      {
        titleKey: 'dialogs.guide.state.bestPractices.title',
        body: <Body i18nKey="dialogs.guide.state.bestPractices.body" />,
      },
    ],
  },
  {
    id: 'agent',
    labelKey: 'dialogs.guide.agent.label',
    summaryKey: 'dialogs.guide.agent.summary',
    details: [
      {
        titleKey: 'dialogs.guide.agent.about.title',
        body: <Body i18nKey="dialogs.guide.agent.about.body" />,
      },
      {
        titleKey: 'dialogs.guide.agent.addState.title',
        body: <Body i18nKey="dialogs.guide.agent.addState.body" />,
        image: { src: '/images/help/agent/help-agent-state.png', altKey: 'dialogs.guide.agent.addState.alt', heightClass: 'max-h-80' },
      },
      {
        titleKey: 'dialogs.guide.agent.editBody.title',
        body: <Body i18nKey="dialogs.guide.agent.editBody.body" />,
        image: { src: '/images/help/agent/help-agent-body.png', altKey: 'dialogs.guide.agent.editBody.alt', heightClass: 'max-h-80' },
      },
      {
        titleKey: 'dialogs.guide.agent.addTransition.title',
        body: <Body i18nKey="dialogs.guide.agent.addTransition.body" />,
        image: { src: '/images/help/agent/help-agent-transition.png', altKey: 'dialogs.guide.agent.addTransition.alt', heightClass: 'max-h-80' },
      },
      {
        titleKey: 'dialogs.guide.agent.transitionCondition.title',
        body: <Body i18nKey="dialogs.guide.agent.transitionCondition.body" />,
        image: { src: '/images/help/agent/help-agent-transition-body.png', altKey: 'dialogs.guide.agent.transitionCondition.alt', heightClass: 'max-h-80' },
      },
      {
        titleKey: 'dialogs.guide.agent.initialState.title',
        body: <Body i18nKey="dialogs.guide.agent.initialState.body" />,
        image: { src: '/images/help/agent/help-agent-initial-state.png', altKey: 'dialogs.guide.agent.initialState.alt', heightClass: 'max-h-80' },
      },
      {
        titleKey: 'dialogs.guide.agent.defineIntents.title',
        body: <Body i18nKey="dialogs.guide.agent.defineIntents.body" />,
        image: { src: '/images/help/agent/help-agent-intent.png', altKey: 'dialogs.guide.agent.defineIntents.alt', heightClass: 'max-h-80' },
      },
      {
        titleKey: 'dialogs.guide.agent.customization.title',
        body: <Body i18nKey="dialogs.guide.agent.customization.body" />,
        image: { src: '/images/help/agent/help-agent-configuration.png', altKey: 'dialogs.guide.agent.customization.alt', heightClass: 'max-h-80' },
      },
    ],
  },
  {
    id: 'gui',
    labelKey: 'dialogs.guide.gui.label',
    summaryKey: 'dialogs.guide.gui.summary',
    details: [
      {
        titleKey: 'dialogs.guide.gui.coreWorkflow.title',
        body: <Body i18nKey="dialogs.guide.gui.coreWorkflow.body" />,
      },
    ],
  },
  {
    id: 'quantum',
    labelKey: 'dialogs.guide.quantum.label',
    summaryKey: 'dialogs.guide.quantum.summary',
    details: [
      {
        titleKey: 'dialogs.guide.quantum.coreWorkflow.title',
        body: <Body i18nKey="dialogs.guide.quantum.coreWorkflow.body" />,
      },
    ],
  },
  {
    id: 'nn',
    labelKey: 'dialogs.guide.nn.label',
    summaryKey: 'dialogs.guide.nn.summary',
    details: [
      {
        titleKey: 'dialogs.guide.nn.coreWorkflow.title',
        body: <Body i18nKey="dialogs.guide.nn.coreWorkflow.body" />,
        image: { src: '/images/help/nn/help-nn-overview.png', altKey: 'dialogs.guide.nn.coreWorkflow.alt' },
      },
      {
        titleKey: 'dialogs.guide.nn.containerLayers.title',
        body: <Body i18nKey="dialogs.guide.nn.containerLayers.body" />,
        image: { src: '/images/help/nn/help-nn-palette.png', altKey: 'dialogs.guide.nn.containerLayers.alt' },
      },
      {
        titleKey: 'dialogs.guide.nn.connect.title',
        body: <Body i18nKey="dialogs.guide.nn.connect.body" />,
        image: { src: '/images/help/nn/help-nn-connect.png', altKey: 'dialogs.guide.nn.connect.alt' },
      },
      {
        titleKey: 'dialogs.guide.nn.editAttributes.title',
        body: <Body i18nKey="dialogs.guide.nn.editAttributes.body" />,
        image: { src: '/images/help/nn/help-nn-edit-popup.png', altKey: 'dialogs.guide.nn.editAttributes.alt' },
      },
      {
        titleKey: 'dialogs.guide.nn.datasets.title',
        body: <Body i18nKey="dialogs.guide.nn.datasets.body" />,
        image: { src: '/images/help/nn/help-nn-datasets.png', altKey: 'dialogs.guide.nn.datasets.alt' },
      },
      {
        titleKey: 'dialogs.guide.nn.configuration.title',
        body: <Body i18nKey="dialogs.guide.nn.configuration.body" />,
        image: { src: '/images/help/nn/help-nn-configuration.png', altKey: 'dialogs.guide.nn.configuration.alt' },
      },
      {
        titleKey: 'dialogs.guide.nn.reference.title',
        body: <Body i18nKey="dialogs.guide.nn.reference.body" />,
        image: { src: '/images/help/nn/help-nn-reference.png', altKey: 'dialogs.guide.nn.reference.alt' },
      },
      {
        titleKey: 'dialogs.guide.nn.validateGenerate.title',
        body: <Body i18nKey="dialogs.guide.nn.validateGenerate.body" />,
        image: { src: '/images/help/nn/help-nn-generate.png', altKey: 'dialogs.guide.nn.validateGenerate.alt' },
      },
    ],
  },
];

export const HelpGuideDialog: React.FC<HelpGuideDialogProps> = ({ open, onOpenChange }) => {
  const { t } = useTranslation();
  const [activeSection, setActiveSection] = useState<GuideSectionId>('class');

  const openExternalUrl = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  useEffect(() => {
    if (open) {
      setActiveSection('class');
    }
  }, [open]);

  const selectedSection = useMemo(
    () => sections.find((section) => section.id === activeSection) ?? sections[0],
    [activeSection],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!flex !gap-0 h-[92vh] w-[96vw] max-w-[1500px] flex-col overflow-hidden p-0">
        <DialogHeader className="border-b border-border/70 px-6 pt-6">
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="size-5 text-brand" />
            {t('dialogs.guide.title')}
          </DialogTitle>
          <DialogDescription>{t('dialogs.guide.description')}</DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 grid-cols-[240px_minmax(0,1fr)] overflow-hidden">
          <aside className="min-h-0 space-y-2 overflow-y-auto border-r border-border/70 p-4">
            <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {t('dialogs.guide.diagramTypesHeading')}
            </p>
            {sections.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveSection(section.id)}
                className={cn(
                  'flex w-full items-center rounded-md border px-3 py-2 text-left text-sm transition',
                  section.id === activeSection
                    ? 'border-brand/30 bg-brand/10 font-semibold text-foreground'
                    : 'border-border/70 bg-background text-muted-foreground hover:border-brand/30 hover:text-foreground',
                )}
              >
                {t(section.labelKey)}
              </button>
            ))}
          </aside>

          <div className="min-h-0 overflow-y-auto p-4 sm:p-6">
            <div className="mb-4 flex items-center gap-2">
              <Layers className="size-4 text-brand" />
              <h3 className="text-base font-semibold">{t(selectedSection.labelKey)}</h3>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">{t(selectedSection.summaryKey)}</p>

            <div className="overflow-x-auto rounded-lg border border-border/70">
              <table className="w-full min-w-[760px] table-fixed">
                <tbody>
                  {selectedSection.details.map((detail) => (
                    <tr key={detail.titleKey} className="align-top border-b border-border/60 last:border-b-0">
                      <th className="w-44 bg-muted/20 px-3 py-3 text-left text-sm font-semibold text-foreground">
                        {t(detail.titleKey)}
                      </th>
                      <td className="px-3 py-3 text-sm leading-relaxed text-muted-foreground">
                        <div className="space-y-2">{detail.body}</div>
                      </td>
                      <td className="w-72 px-3 py-3">
                        {detail.image ? (
                          // TODO: Convert help images to WebP format for smaller file sizes (#31)
                          <img
                            src={detail.image.src}
                            alt={t(detail.image.altKey)}
                            loading="lazy"
                            className={cn(
                              'max-h-56 w-full rounded-md border border-border/60 object-contain',
                              detail.image.heightClass,
                            )}
                          />
                        ) : (
                          <div className="rounded-md border border-dashed border-border/60 px-3 py-2 text-xs text-muted-foreground">
                            {t('dialogs.guide.noImage')}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-border/70 px-6 py-4">
          <Button variant="outline" onClick={() => openExternalUrl(DOCS_URL)} className="gap-2">
            {t('dialogs.guide.openDocs')}
            <ExternalLink className="size-3.5" />
          </Button>
          <Button variant="outline" onClick={() => openExternalUrl(besserWMERepositoryLink)} className="gap-2">
            {t('dialogs.guide.openWmeRepo')}
            <ExternalLink className="size-3.5" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
