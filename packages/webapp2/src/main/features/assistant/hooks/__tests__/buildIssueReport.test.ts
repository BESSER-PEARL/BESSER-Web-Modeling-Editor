import { describe, it, expect } from 'vitest';
import type { Message as ChatKitMessage } from '@/components/chatbot-kit/ui/chat-message';
import {
  buildIssueReport,
  buildIssueReportMarkdown,
  issueReportFilename,
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
