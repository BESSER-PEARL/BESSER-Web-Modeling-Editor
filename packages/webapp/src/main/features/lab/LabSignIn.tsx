import React from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Github, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGitHubAuth } from '../../shared/hooks/useGitHubAuth';

/** The centred column of the sign-in and refusal screens; `glow` adds the hero's glow and grain. */
export const LabEntryColumn: React.FC<{ glow?: boolean; children: React.ReactNode; testId?: string }> = ({
  glow = false,
  children,
  testId,
}) => (
  <main data-testid={testId} className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-background px-6 py-12">
    {glow && (
      <>
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/4 size-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-60 blur-2xl"
          style={{ background: 'radial-gradient(circle at center, hsl(var(--brand)/0.22), transparent 62%)' }}
        />
        <div aria-hidden className="grain-overlay pointer-events-none absolute inset-0 opacity-40" />
      </>
    )}
    <div className="relative z-[1] w-full max-w-[32rem]">{children}</div>
  </main>
);

/** The lab's first screen without a GitHub session: who the lab is for, and the sign-in. */
export const LabSignIn: React.FC = () => {
  const { t } = useTranslation();
  const { login, isLoading } = useGitHubAuth();
  return (
    <LabEntryColumn glow testId="lab-sign-in">
      <p className="lab-rise lab-d1 ui-kicker text-brand">{t('lab.app.signIn.kicker', { defaultValue: 'BESSER LAB' })}</p>
      <h1
        className="lab-rise lab-d2 mt-3 font-display text-4xl leading-[1.05] tracking-tight text-foreground sm:text-5xl"
        style={{ textWrap: 'balance' }}
      >
        <Trans
          i18nKey="lab.app.signIn.heading"
          defaults="Change <em>BESSER</em> from inside BESSER."
          components={{ em: <em className="text-primary" /> }}
        />
      </h1>
      <p className="lab-rise lab-d3 mt-4 text-muted-foreground">
        {t('lab.app.signIn.body', {
          defaultValue: 'For the BESSER team. Sign in with GitHub; the lab checks that you are on its list or a member of its organization.',
        })}
      </p>
      <div className="lab-rise lab-d4 mt-7">
        <Button size="lg" onClick={() => login('lab_sign_in')} disabled={isLoading}>
          {isLoading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Github className="size-4" aria-hidden />}
          {t('lab.app.signIn.button', { defaultValue: 'Sign in with GitHub' })}
        </Button>
        <p className="mt-6 text-xs text-muted-foreground">
          {t('lab.app.signIn.note', {
            defaultValue: 'Changes are made on lab branches and opened as draft pull requests. Nothing is merged without a person.',
          })}
        </p>
      </div>
    </LabEntryColumn>
  );
};
