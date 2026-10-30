import React, { useMemo, useState } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { GraduationCap, Layers, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

type TutorialId = 'personalization';
type SectionId = 'agent' | 'gui';

interface TutorialStep {
  titleKey: string;
  bodyKey: string;
  /** Branch of the tutorial; steps without a section are shared by all branches. */
  section?: SectionId;
  image?: {
    src: string;
    altKey: string;
  };
}

interface Tutorial {
  id: TutorialId;
  labelKey: string;
  summaryKey: string;
  steps: TutorialStep[];
}

const P = 'tutorials.personalization';

const tutorials: Tutorial[] = [
  {
    id: 'personalization',
    labelKey: `${P}.label`,
    summaryKey: `${P}.summary`,
    steps: [
      { titleKey: `${P}.modelUsers.title`, bodyKey: `${P}.modelUsers.body` },
      {
        titleKey: `${P}.defineSpecs.title`,
        bodyKey: `${P}.defineSpecs.body`,
        image: { src: '/images/help/tutorials/help-tutorials-user-diagram.png', altKey: `${P}.defineSpecs.imageAlt` },
      },
      {
        section: 'agent',
        titleKey: `${P}.createVariants.title`,
        bodyKey: `${P}.createVariants.body`,
        image: { src: '/images/help/tutorials/help-tutorials-agent-variants.png', altKey: `${P}.createVariants.imageAlt` },
      },
      { section: 'agent', titleKey: `${P}.agentRecommendation.title`, bodyKey: `${P}.agentRecommendation.body` },
      {
        section: 'gui',
        titleKey: `${P}.gui.base.title`,
        bodyKey: `${P}.gui.base.body`,
        image: { src: '/images/help/tutorials/help-tutorials-gui-original.png', altKey: `${P}.gui.base.imageAlt` },
      },
      { section: 'gui', titleKey: `${P}.gui.rules.title`, bodyKey: `${P}.gui.rules.body` },
      { section: 'gui', titleKey: `${P}.gui.apply.title`, bodyKey: `${P}.gui.apply.body` },
      {
        section: 'gui',
        titleKey: `${P}.gui.result.title`,
        bodyKey: `${P}.gui.result.body`,
        image: { src: '/images/help/tutorials/help-tutorials-gui-adapted.png', altKey: `${P}.gui.result.imageAlt` },
      },
    ],
  },
];

const sections: SectionId[] = ['agent', 'gui'];

const bodyComponents = {
  p: <p />,
  ul: <ul className="list-disc space-y-1 pl-5" />,
  li: <li />,
  strong: <strong />,
  code: <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono" />,
};

export const TutorialsPage: React.FC = () => {
  const { t } = useTranslation();
  const [activeTutorial, setActiveTutorial] = useState<TutorialId>('personalization');

  const selectedTutorial = useMemo(
    () => tutorials.find((tut) => tut.id === activeTutorial) ?? tutorials[0],
    [activeTutorial],
  );

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      {/* Header */}
      <header className="shrink-0 border-b border-border/70 bg-card px-6 py-4">
        <div className="flex items-center gap-3">
          <GraduationCap className="size-6 text-brand" />
          <div>
            <h1 className="text-lg font-semibold">{t('tutorials.pageTitle')}</h1>
            <p className="text-sm text-muted-foreground">{t('tutorials.pageDescription')}</p>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="grid min-h-0 flex-1 grid-cols-[240px_minmax(0,1fr)] overflow-hidden">
        {/* Sidebar */}
        <aside className="min-h-0 space-y-2 overflow-y-auto border-r border-border/70 bg-card p-4">
          <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {t('tutorials.listHeading')}
          </p>
          {tutorials.map((tut) => (
            <button
              key={tut.id}
              type="button"
              onClick={() => setActiveTutorial(tut.id)}
              className={cn(
                'flex w-full items-center rounded-md border px-3 py-2 text-left text-sm transition',
                tut.id === activeTutorial
                  ? 'border-brand/30 bg-brand/10 font-semibold text-foreground'
                  : 'border-border/70 bg-background text-muted-foreground hover:border-brand/30 hover:text-foreground',
              )}
            >
              {t(tut.labelKey)}
            </button>
          ))}
        </aside>

        {/* Main content */}
        <main className="min-h-0 overflow-y-auto p-6">
          <div className="mx-auto max-w-5xl">
            <div className="mb-2 flex items-center gap-2">
              <Layers className="size-4 text-brand" />
              <h2 className="text-base font-semibold">{t(selectedTutorial.labelKey)}</h2>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">{t(selectedTutorial.summaryKey)}</p>
            <div className="mb-6 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">{t('tutorials.personalization.jumpTo')}</span>
              {sections.map((section) => (
                <button
                  key={section}
                  type="button"
                  onClick={() => document.getElementById(`tutorial-section-${section}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  className="rounded-md border border-border/70 bg-background px-3 py-1 text-muted-foreground transition hover:border-brand/30 hover:text-foreground"
                >
                  {t(`tutorials.personalization.sections.${section}`)}
                </button>
              ))}
            </div>

            <div className="space-y-4">
              {selectedTutorial.steps.map((step, index) => {
                const sharedCount = selectedTutorial.steps.filter((x) => !x.section).length;
                const number = step.section
                  ? sharedCount + selectedTutorial.steps.filter((x, i) => i <= index && x.section === step.section).length
                  : index + 1;
                const startsSection =
                  !!step.section && selectedTutorial.steps.findIndex((x) => x.section === step.section) === index;
                return (
                <React.Fragment key={step.titleKey}>
                {startsSection && (
                  <h2 id={`tutorial-section-${step.section}`} className="scroll-mt-4 pt-4 text-base font-semibold text-foreground">
                    {t(`tutorials.personalization.sections.${step.section}`)}
                  </h2>
                )}
                <div className="rounded-lg border border-border/70 bg-card p-5">
                  <div className="mb-3 flex items-start gap-3">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand/15 text-sm font-bold text-brand">
                      {number}
                    </span>
                    <h3 className="pt-0.5 font-semibold text-foreground">{t(step.titleKey)}</h3>
                  </div>
                  <div className="ml-10 space-y-2 text-sm leading-relaxed text-muted-foreground">
                    <Trans i18nKey={step.bodyKey} components={bodyComponents} />
                  </div>
                  {step.image && (
                    <div className="mt-4">
                      <img
                        src={step.image.src}
                        alt={t(step.image.altKey)}
                        loading="lazy"
                        className="w-full rounded-md border border-border/60 object-contain"
                      />
                    </div>
                  )}
                </div>
                </React.Fragment>
                );
              })}
            </div>

            {/* Footer link back */}
            <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
              <BookOpen className="size-4" />
              <a
                href="https://besser.readthedocs.io/en/latest/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline-offset-4 hover:underline"
              >
                {t('tutorials.docsLink')}
              </a>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};
