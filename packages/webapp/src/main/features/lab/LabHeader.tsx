import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useMatch, useNavigate } from 'react-router-dom';
import { ChevronDown, Languages, LogOut, Moon, Settings, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { LanguageRadioItems } from '../../app/shell/LanguageSelector';
import type { LabBase, LabMeter } from '../../shared/api/lab';
import { useIsDarkTheme } from '../../shared/hooks/useIsDarkTheme';
import { toggleTheme } from '../../shared/utils/theme-switcher';
import { useLabShell } from './LabAuthGate';
import { formatAgo, formatUsd, LabAvatar } from './LabChangeList';

/** Above this share of the cap the meter turns amber (D4 "Lab header"). */
const METER_WARN_RATIO = 0.8;
/** Shown commit id length, as git's short form. */
const SHORT_SHA = 7;

/** `ok`, `warn` above 80 % of the cap, `full` at the cap. */
export function meterLevel(meter: LabMeter): 'ok' | 'warn' | 'full' {
  const ratio = meter.capUsd > 0 ? meter.spentUsd / meter.capUsd : 1;
  if (ratio >= 1) return 'full';
  return ratio > METER_WARN_RATIO ? 'warn' : 'ok';
}

const METER_BAR: Record<ReturnType<typeof meterLevel>, string> = {
  ok: 'bg-brand',
  warn: 'bg-warning',
  full: 'bg-destructive',
};

/** This month's spending of the signed-in user: "$12.40 of $75" and a 48 px bar. */
const MonthMeter: React.FC<{ meter: LabMeter }> = ({ meter }) => {
  const { t, i18n } = useTranslation();
  const level = meterLevel(meter);
  const width = Math.min(100, meter.capUsd > 0 ? (meter.spentUsd / meter.capUsd) * 100 : 100);
  const text = t('lab.app.header.meter', {
    defaultValue: '{{spent}} of {{cap}}',
    spent: formatUsd(meter.spentUsd, i18n.language),
    cap: formatUsd(meter.capUsd, i18n.language),
  });
  return (
    <span
      data-testid="lab-meter"
      data-level={level}
      className="flex items-center gap-2 font-mono text-xs tabular-nums text-muted-foreground"
      title={t('lab.app.header.meterTitle', { defaultValue: 'What your lab runs cost this month' })}
    >
      {text}
      <span aria-hidden className="h-1.5 w-12 overflow-hidden rounded-full bg-muted">
        <span data-testid="lab-meter-bar" className={cn('block h-full rounded-full', METER_BAR[level])} style={{ width: `${width}%` }} />
      </span>
    </span>
  );
};

/** The base commit of each repository, with the upstream and fetch time on hover; a fork is marked. */
const BaseChips: React.FC<{ bases: LabBase[] }> = ({ bases }) => {
  const { t, i18n } = useTranslation();
  const forks = bases.filter((base) => base.fork);
  return (
    <TooltipProvider delayDuration={200}>
      <span className="hidden min-w-0 items-center gap-2 font-mono text-xs text-muted-foreground xl:flex" data-testid="lab-bases">
        {bases.map((base, index) => (
          <React.Fragment key={base.repo}>
            {index > 0 && <span aria-hidden>·</span>}
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0} className="whitespace-nowrap rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                  {base.branch} {base.sha.slice(0, SHORT_SHA)}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {t('lab.app.header.baseTooltip', {
                  defaultValue: '{{upstream}}, fetched {{ago}}',
                  upstream: base.upstream,
                  ago: formatAgo(base.fetchedAt, i18n.language).ago,
                })}
              </TooltipContent>
            </Tooltip>
          </React.Fragment>
        ))}
      </span>
      {forks.map((base) => (
        <span
          key={`fork-${base.repo}`}
          data-testid="lab-fork-chip"
          className="hidden whitespace-nowrap rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 font-mono text-xs text-warning sm:inline"
        >
          {t('lab.app.header.fork', { defaultValue: 'fork: {{upstream}}', upstream: base.upstream })}
        </span>
      ))}
    </TooltipProvider>
  );
};

/**
 * The header of every signed-in lab screen: the lab's name, where the user is, the bases changes
 * start from, this month's spending and the account menu. No File, Generate or Deploy menus.
 */
export const LabHeader: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, home, breadcrumb, signOut } = useLabShell();
  const dark = useIsDarkTheme();
  const inChange = useMatch('/c/:changeId');
  const inSettings = useMatch('/settings');
  const crumb = inSettings
    ? t('lab.app.header.settings', { defaultValue: 'Settings and usage' })
    : inChange
      ? breadcrumb
      : null;

  return (
    <header className="relative z-20 flex shrink-0 items-center gap-2 border-b border-brand/10 bg-background/60 px-3 py-2 sm:gap-3 sm:px-6 dark:border-border/70">
      <Link
        to="/"
        className="flex shrink-0 items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {/* The editor's own logo, at its size, with the lab named beside it. */}
        <img src="/images/logo.png" alt="BESSER" width={151} height={40} className="h-8 w-auto brightness-0 dark:invert sm:h-10" />
        <span className="rounded-full border border-brand/25 bg-brand/10 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-brand-dark dark:text-brand">
          {t('lab.app.header.title', { defaultValue: 'BESSER Lab' })}
        </span>
      </Link>
      <nav aria-label={t('lab.app.header.breadcrumb', { defaultValue: 'Breadcrumb' })} className="hidden min-w-0 items-center gap-2 text-sm sm:flex">
        <span aria-hidden className="text-muted-foreground/60">/</span>
        <Link to="/" className="shrink-0 text-muted-foreground hover:text-foreground">
          {t('lab.app.header.changes', { defaultValue: 'Changes' })}
        </Link>
        {crumb && (
          <>
            <span aria-hidden className="text-muted-foreground/60">/</span>
            <span aria-current="page" className="max-w-[40ch] truncate font-medium text-foreground">
              {crumb}
            </span>
          </>
        )}
      </nav>
      <div className="ml-auto flex min-w-0 items-center gap-4">
        <BaseChips bases={home.bases} />
        <MonthMeter meter={home.meters.user} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1.5 px-1.5" aria-label={t('lab.app.header.account', { defaultValue: 'Account' })}>
              <LabAvatar login={user.login} className="size-7" />
              <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[220px]">
            <DropdownMenuLabel className="font-normal text-muted-foreground">@{user.login}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => navigate('/settings')}>
              <Settings className="size-4" aria-hidden />
              {t('lab.app.header.settings', { defaultValue: 'Settings and usage' })}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={toggleTheme}>
              {dark ? <Sun className="size-4" aria-hidden /> : <Moon className="size-4" aria-hidden />}
              {dark
                ? t('lab.app.header.lightTheme', { defaultValue: 'Light theme' })
                : t('lab.app.header.darkTheme', { defaultValue: 'Dark theme' })}
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Languages className="size-4" aria-hidden />
                {t('lab.app.header.language', { defaultValue: 'Language' })}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="min-w-[180px]">
                <LanguageRadioItems />
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={signOut}>
              <LogOut className="size-4" aria-hidden />
              {t('lab.app.header.signOut', { defaultValue: 'Sign out' })}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};
