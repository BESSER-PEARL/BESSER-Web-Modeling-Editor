/**
 * buildIssueReport — assembles a privacy-safe "Report an issue" payload from
 * the current assistant session.
 *
 * Requested after a hackathon: when a user hits a problem they should be able
 * to export the conversation + workspace context in one click and send it to
 * the team, instead of describing the issue from scratch.
 *
 * HARD PRIVACY CONSTRAINT: the report MUST NEVER contain the user's BYOK API
 * key. BYOK keys live in the smart-generation Redux state / localStorage and
 * are deliberately not read here. Only the conversation text, per-message
 * metadata, and non-secret workspace context (diagram types, project name,
 * counts) are included. Diagram *models* are intentionally excluded — they can
 * be large and are not needed to triage an assistant issue.
 */

import type { Message as ChatKitMessage } from '@/components/chatbot-kit/ui/chat-message';
import type { MessageMeta, ConnectionStatus } from './useAssistantLogic';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

/** Non-secret workspace context block included in the report. */
export interface IssueReportContext {
  /** The diagram type that was active when the report was generated. */
  activeDiagramType?: string;
  /** Human-friendly project name. */
  projectName?: string;
  /** Distinct diagram types present in the project (e.g. ["ClassDiagram"]). */
  diagramTypes?: string[];
  /** Total number of diagrams across all types. */
  totalDiagrams?: number;
  /** Per-type diagram counts, e.g. { ClassDiagram: 2 }. */
  diagramCounts?: Record<string, number>;
}

export interface BuildIssueReportInput {
  messages: ChatKitMessage[];
  messageMeta: Record<string, MessageMeta>;
  connectionStatus: ConnectionStatus;
  context: IssueReportContext;
  /** App version, if resolvable (non-secret). */
  appVersion?: string;
}

/** A single conversation turn as serialised into the report. */
export interface IssueReportMessage {
  index: number;
  id: string;
  role: string;
  content: string;
  createdAt?: string;
  /** True for progress/status messages. */
  isProgress?: boolean;
  /** True for error messages. */
  isError?: boolean;
  /** Names of any attachments (filenames only — no file contents). */
  attachments?: string[];
  /** Per-message badge metadata, if present. */
  badge?: MessageMeta['badge'];
  badgeLabel?: string;
}

export interface IssueReport {
  reportType: 'besser-assistant-issue';
  schemaVersion: 1;
  generatedAt: string;
  appVersion?: string;
  connectionStatus: ConnectionStatus;
  context: IssueReportContext;
  messageCount: number;
  messages: IssueReportMessage[];
}

/* ------------------------------------------------------------------ */
/*  JSON report                                                        */
/* ------------------------------------------------------------------ */

/**
 * Build the structured JSON report. Pure & side-effect free so it is trivial
 * to unit test. NOTHING secret is read here — only the inputs handed in.
 */
export function buildIssueReport(input: BuildIssueReportInput): IssueReport {
  const { messages, messageMeta, connectionStatus, context, appVersion } = input;

  const reportMessages: IssueReportMessage[] = messages.map((m, index) => {
    const meta = messageMeta[m.id];
    const attachments = m.experimental_attachments
      ?.map((a) => a.name)
      .filter((name): name is string => typeof name === 'string' && name.length > 0);

    const entry: IssueReportMessage = {
      index: index + 1,
      id: m.id,
      role: m.role,
      content: m.content ?? '',
    };
    if (m.createdAt instanceof Date) entry.createdAt = m.createdAt.toISOString();
    if (m.isProgress) entry.isProgress = true;
    if (m.isError) entry.isError = true;
    if (attachments && attachments.length > 0) entry.attachments = attachments;
    if (meta?.badge) {
      entry.badge = meta.badge;
      if (meta.badgeLabel) entry.badgeLabel = meta.badgeLabel;
    }
    return entry;
  });

  return {
    reportType: 'besser-assistant-issue',
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    appVersion,
    connectionStatus,
    context,
    messageCount: messages.length,
    messages: reportMessages,
  };
}

/* ------------------------------------------------------------------ */
/*  Markdown transcript                                                */
/* ------------------------------------------------------------------ */

const roleLabel = (role: string): string => {
  if (role === 'user') return 'User';
  if (role === 'assistant') return 'Assistant';
  return role.charAt(0).toUpperCase() + role.slice(1);
};

/**
 * Render the same report as a human-readable Markdown transcript — easier for
 * a teammate to skim than raw JSON. Built from the already-assembled
 * `IssueReport` so the two surfaces never drift.
 */
export function buildIssueReportMarkdown(report: IssueReport): string {
  const lines: string[] = [];

  lines.push('# BESSER Assistant — Issue Report');
  lines.push('');
  lines.push(`- **Generated:** ${report.generatedAt}`);
  if (report.appVersion) lines.push(`- **App version:** ${report.appVersion}`);
  lines.push(`- **Connection status:** ${report.connectionStatus}`);

  const ctx = report.context;
  if (ctx.projectName) lines.push(`- **Project:** ${ctx.projectName}`);
  if (ctx.activeDiagramType) lines.push(`- **Active diagram:** ${ctx.activeDiagramType}`);
  if (ctx.diagramTypes && ctx.diagramTypes.length > 0) {
    lines.push(`- **Diagram types present:** ${ctx.diagramTypes.join(', ')}`);
  }
  if (typeof ctx.totalDiagrams === 'number') {
    lines.push(`- **Total diagrams:** ${ctx.totalDiagrams}`);
  }
  lines.push(`- **Messages:** ${report.messageCount}`);
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## Conversation');
  lines.push('');

  if (report.messages.length === 0) {
    lines.push('_No messages in this conversation._');
  } else {
    for (const m of report.messages) {
      const tags: string[] = [];
      if (m.isProgress) tags.push('progress');
      if (m.isError) tags.push('error');
      if (m.badge) tags.push(m.badgeLabel ? `${m.badge}: ${m.badgeLabel}` : m.badge);
      const tagSuffix = tags.length > 0 ? ` _(${tags.join(', ')})_` : '';

      lines.push(`### ${m.index}. ${roleLabel(m.role)}${tagSuffix}`);
      lines.push('');
      lines.push(m.content && m.content.trim().length > 0 ? m.content : '_(empty message)_');
      if (m.attachments && m.attachments.length > 0) {
        lines.push('');
        lines.push(`> Attachments: ${m.attachments.join(', ')}`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

/* ------------------------------------------------------------------ */
/*  Filename helper                                                    */
/* ------------------------------------------------------------------ */

/**
 * Build a filesystem-safe, timestamped report filename, e.g.
 * `besser-assistant-report-2026-06-22T13-45-09.json`.
 */
export function issueReportFilename(extension: 'json' | 'md', date: Date = new Date()): string {
  const stamp = date.toISOString().replace(/[:.]/g, '-').replace(/Z$/, '');
  return `besser-assistant-report-${stamp}.${extension}`;
}
