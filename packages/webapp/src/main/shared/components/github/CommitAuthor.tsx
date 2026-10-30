import React from 'react';
import { useTranslation } from 'react-i18next';
import { Bot, PenLine, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RepoCommit } from '../../api/github';

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

/** "3 hours ago" in `locale` (the UI language). */
export function formatWhen(iso: string, locale?: string): string {
  const seconds = (Date.now() - new Date(iso).getTime()) / 1000;
  if (!Number.isFinite(seconds)) return '';
  const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return format.format(-Math.round(seconds / size), unit);
  }
  return format.format(0, 'minute');
}

/** Who made a commit (the Spec-Driven Agent, the editor, or a person) and when. */
export const CommitAuthor: React.FC<{ commit: RepoCommit; className?: string }> = ({ commit, className }) => {
  const { t, i18n } = useTranslation();
  const origin =
    commit.origin === 'spec-driven-agent'
      ? { icon: Bot, label: t('github.origin.agent', { defaultValue: 'Spec-Driven Agent' }) }
      : commit.origin === 'editor'
        ? { icon: PenLine, label: t('github.origin.editor', { defaultValue: 'Editor' }) }
        : { icon: User, label: t('github.origin.person', { defaultValue: 'Person' }) };
  const Icon = origin.icon;
  return (
    <span className={cn('flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground', className)}>
      <span className="inline-flex items-center gap-1 rounded bg-background px-1.5 py-px font-medium text-foreground/80 ring-1 ring-border/70">
        <Icon className="size-3" aria-hidden />
        {origin.label}
      </span>
      <span>{commit.author}</span>
      <span aria-hidden>·</span>
      <span>{formatWhen(commit.date, i18n.language)}</span>
      {commit.html_url && (
        <a
          href={commit.html_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(event) => event.stopPropagation()}
          className="rounded bg-muted px-1 font-mono hover:bg-muted/80"
        >
          {commit.sha.slice(0, 7)}
        </a>
      )}
    </span>
  );
};
