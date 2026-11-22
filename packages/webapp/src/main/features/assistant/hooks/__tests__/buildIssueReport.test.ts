import { describe, it, expect } from 'vitest';
import type { Message as ChatKitMessage } from '@/components/chatbot-kit/ui/chat-message';
import {
  buildIssueReport,
  buildIssueReportMarkdown,
  buildGithubIssueTitle,
  buildGithubIssueUrl,
  issueReportFilename,
  GITHUB_ISSUE_URL_MAX_LENGTH,
  type BuildIssueReportInput,
} from '../buildIssueReport';
import type { MessageMeta } from '../useAssistantLogic';

const msg = (over: Partial<ChatKitMessage> & Pick<ChatKitMessage, 'id' | 'role' | 'content'>): ChatKitMessage => ({
  createdAt: new Date('2026-06-22T10:00:00.000Z'),
  ...over,
});

const baseInput = (over: Partial<BuildIssueReportInput> = {}): BuildIssueReportInput => ({
  messages: [
    msg({ id: 'm1', role: 'user', content: 'Create a Payment class' }),
    msg({ id: 'm2', role: 'assistant', content: 'Added Payment.' }),
  ],
  messageMeta: {},
  connectionStatus: 'connected',
  context: {
    activeDiagramType: 'ClassDiagram',
    projectName: 'My_Project',
    diagramTypes: ['ClassDiagram'],
    totalDiagrams: 1,
    diagramCounts: { ClassDiagram: 1 },
  },
  appVersion: '7.4.0',
  ...over,
});

describe('buildIssueReport', () => {
  it('captures conversation, metadata and non-secret context', () => {
    const meta: Record<string, MessageMeta> = {
      m2: { badge: 'injection', badgeLabel: 'Applied to ClassDiagram' },
    };
    const report = buildIssueReport(baseInput({ messageMeta: meta }));

    expect(report.reportType).toBe('besser-assistant-issue');
    expect(report.messageCount).toBe(2);
    expect(report.messages[0]).toMatchObject({ index: 1, role: 'user', content: 'Create a Payment class' });
    expect(report.messages[1]).toMatchObject({ badge: 'injection', badgeLabel: 'Applied to ClassDiagram' });
    expect(report.context.projectName).toBe('My_Project');
    expect(report.appVersion).toBe('7.4.0');
    expect(report.connectionStatus).toBe('connected');
  });

  it('records attachment filenames only — never file contents', () => {
    const report = buildIssueReport(
      baseInput({
        messages: [
          msg({
            id: 'm1',
            role: 'user',
            content: 'Convert this',
            experimental_attachments: [
              { name: 'diagram.png', contentType: 'image/png', url: 'data:image/png;base64,SECRETBYTES' },
            ],
          }),
        ],
      }),
    );
    expect(report.messages[0].attachments).toEqual(['diagram.png']);
    // The base64 data URL must not leak into the serialised report.
    expect(JSON.stringify(report)).not.toContain('SECRETBYTES');
    expect(JSON.stringify(report)).not.toContain('data:image');
  });

  it('does not leak anything resembling an API key', () => {
    // Nothing in the input carries a key; assert the serialised output is clean.
    const report = buildIssueReport(baseInput());
    const serialised = JSON.stringify(report).toLowerCase();
    expect(serialised).not.toContain('sk-');
    expect(serialised).not.toContain('apikey');
    expect(serialised).not.toContain('api_key');
  });

  it('renders a readable Markdown transcript', () => {
    const md = buildIssueReportMarkdown(buildIssueReport(baseInput()));
    expect(md).toContain('# BESSER Assistant — Issue Report');
    expect(md).toContain('**Project:** My_Project');
    expect(md).toContain('**Active diagram:** ClassDiagram');
    expect(md).toContain('### 1. User');
    expect(md).toContain('Create a Payment class');
    expect(md).toContain('### 2. Assistant');
  });

  it('handles an empty conversation gracefully', () => {
    const report = buildIssueReport(baseInput({ messages: [] }));
    expect(report.messageCount).toBe(0);
    expect(buildIssueReportMarkdown(report)).toContain('_No messages in this conversation._');
  });

  it('builds a filesystem-safe timestamped filename', () => {
    const name = issueReportFilename('md', new Date('2026-06-22T13:45:09.123Z'));
    expect(name).toBe('besser-assistant-report-2026-06-22T13-45-09-123.md');
    expect(name).not.toMatch(/[:]/);
  });
});

describe('buildGithubIssueTitle', () => {
  it('prefers the first error line over the last user message', () => {
    const report = buildIssueReport(
      baseInput({
        messages: [
          msg({ id: 'm1', role: 'user', content: 'Generate the app' }),
          msg({ id: 'm2', role: 'assistant', content: 'Generation failed: backend unreachable\nDetails follow.', isError: true }),
          msg({ id: 'm3', role: 'user', content: 'Why did that fail?' }),
        ],
      }),
    );
    expect(buildGithubIssueTitle(report)).toBe('[Web Editor] Generation failed: backend unreachable');
  });

  it('falls back to the last user message, then to a neutral default', () => {
    const withUser = buildIssueReport(baseInput());
    expect(buildGithubIssueTitle(withUser)).toBe('[Web Editor] Create a Payment class');

    const empty = buildIssueReport(baseInput({ messages: [] }));
    expect(buildGithubIssueTitle(empty)).toBe('[Web Editor] Issue report from the modeling assistant');
  });
});

describe('buildGithubIssueUrl', () => {
  const environment = {
    pageUrl: 'https://editor.besser-pearl.org/project',
    userAgent: 'TestBrowser/1.0',
    appVersion: '7.4.0',
    runId: 'run-1234',
    provider: 'openai',
    model: 'gpt-test',
  };

  it('targets the given repo and prefills title, environment and logs', () => {
    const { url, logsTruncated } = buildGithubIssueUrl({
      repoSlug: 'BESSER-PEARL/BESSER',
      title: '[Web Editor] Something broke',
      environment,
      logs: 'line one\nline two',
    });
    expect(logsTruncated).toBe(false);
    expect(url.startsWith('https://github.com/BESSER-PEARL/BESSER/issues/new?title=')).toBe(true);

    const parsed = new URL(url);
    expect(parsed.searchParams.get('title')).toBe('[Web Editor] Something broke');
    const body = parsed.searchParams.get('body') ?? '';
    expect(body).toContain('## Environment');
    expect(body).toContain('https://editor.besser-pearl.org/project');
    expect(body).toContain('TestBrowser/1.0');
    expect(body).toContain('7.4.0');
    expect(body).toContain('run-1234');
    expect(body).toContain('provider: openai, model: gpt-test');
    expect(body).toContain('<details>');
    expect(body).toContain('line one\nline two');
    expect(body).not.toContain('older log lines truncated');
  });

  it('caps the ENCODED url length and keeps the log tail when truncating', () => {
    const oldLines = Array.from({ length: 1500 }, (_, i) => `old line ${i}`).join('\n');
    const logs = `${oldLines}\nNEWEST LINE — must survive truncation`;
    const { url, logsTruncated } = buildGithubIssueUrl({
      repoSlug: 'BESSER-PEARL/BESSER',
      title: '[Web Editor] Big log',
      environment,
      logs,
    });
    expect(logsTruncated).toBe(true);
    expect(url.length).toBeLessThanOrEqual(GITHUB_ISSUE_URL_MAX_LENGTH);

    const body = new URL(url).searchParams.get('body') ?? '';
    expect(body).toContain('older log lines truncated');
    expect(body).toContain('NEWEST LINE — must survive truncation');
    expect(body).not.toContain('old line 0');
  });

  it('accounts for multi-byte characters against the encoded length', () => {
    // Each '€' encodes to 9 characters (%E2%82%AC) — raw length is a poor proxy.
    const logs = '€'.repeat(4000);
    const { url, logsTruncated } = buildGithubIssueUrl({
      repoSlug: 'BESSER-PEARL/BESSER',
      title: '[Web Editor] Unicode log',
      environment,
      logs,
    });
    expect(logsTruncated).toBe(true);
    expect(url.length).toBeLessThanOrEqual(GITHUB_ISSUE_URL_MAX_LENGTH);
  });

  it('honours a custom maxUrlLength', () => {
    const { url } = buildGithubIssueUrl({
      repoSlug: 'BESSER-PEARL/BESSER',
      title: '[Web Editor] Custom cap',
      environment,
      logs: 'x'.repeat(5000),
      maxUrlLength: 2000,
    });
    expect(url.length).toBeLessThanOrEqual(2000);
  });
});
