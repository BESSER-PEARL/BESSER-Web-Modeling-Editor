import { afterEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'react-toastify';
import i18n from '../../../shared/i18n';
import {
  describeDerivationWarning,
  formatDerivationWarnings,
  reportDerivationWarnings,
  type AnyDerivationWarning,
} from '../derivation-warnings';
import enWebapp from '../../../../../../i18n/en/webapp.json';
import caWebapp from '../../../../../../i18n/ca/webapp.json';
import deWebapp from '../../../../../../i18n/de/webapp.json';
import esWebapp from '../../../../../../i18n/es/webapp.json';
import frWebapp from '../../../../../../i18n/fr/webapp.json';
import lbWebapp from '../../../../../../i18n/lb/webapp.json';

vi.mock('react-toastify', () => ({ toast: { warning: vi.fn() } }));

const t = i18n.t.bind(i18n);

const ALL_KINDS: AnyDerivationWarning[] = [
  { kind: 'dropped-task-in-non-agentic-lane', taskId: 't1', taskName: 'Validate solution', laneName: 'Maintainer' },
  { kind: 'capability-heavy-agent', laneId: 'l1', laneName: 'AgentCoder', count: 11 },
  { kind: 'capability-heavy-zone', zone: 'Tools', count: 13 },
  { kind: 'dangling-agent-ref', taskId: 't2', taskName: 'Search' },
  { kind: 'flat-scaffold' },
  { kind: 'io-attached-to-entry', flowId: 'f1', direction: 'in', peerName: 'AgentReviewer' },
  { kind: 'io-attached-to-entry', flowId: 'f2', direction: 'out', peerName: 'Maintainer' },
  { kind: 'merge-no-producers', gatewayId: 'g1', gatewayName: 'Merge fixes' },
  { kind: 'merge-no-successors', gatewayId: 'g2', gatewayName: '' },
];

describe('describeDerivationWarning', () => {
  it('turns every warning kind into a sentence that names the elements involved', () => {
    const messages = ALL_KINDS.map((w) => describeDerivationWarning(w, t));
    expect(messages).toEqual([
      'Task “Validate solution” is in the non-agentic lane “Maintainer”, so it is not shown in the Component diagram.',
      'Agent “AgentCoder” uses 11 tools, skills and resources, so its part of the diagram may be crowded.',
      'The “Tools” group holds 13 items and may be crowded.',
      '“Search” links an Agent diagram that is no longer in this project, so its tools and skills were skipped.',
      'The Component diagram has no Subsystems, so every component was placed on one Docker Host. Add Subsystems for a richer layout.',
      'The flow from “AgentReviewer” does not reach a task in this lane, so no state receives it.',
      'The flow to “Maintainer” does not start at a task in this lane, so no state sends it.',
      'The governed merge gateway “Merge fixes” has no incoming flow, so its decision state has no inbound transition. Add one by hand.',
      'The governed merge gateway “(unnamed)” leads to no task in this lane, so its decision state has no outgoing transition. Add one by hand.',
    ]);
  });

  it.each([
    ['ca', caWebapp],
    ['de', deWebapp],
    ['es', esWebapp],
    ['fr', frWebapp],
    ['lb', lbWebapp],
  ])('has a %s translation for every warning sentence', (_locale, bundle) => {
    const keys = Object.keys(enWebapp.interDiagram.warnings);
    expect(Object.keys(bundle.interDiagram.warnings).sort()).toEqual([...keys].sort());
  });
});

describe('formatDerivationWarnings', () => {
  it('lists the warnings under the summary line, one bullet each', () => {
    const summary = t('interDiagram.derive.component.doneWithWarnings', { count: 2 });
    expect(formatDerivationWarnings(summary, ALL_KINDS.slice(0, 2), t)).toBe(
      [
        'Component diagram generated with 2 warnings:',
        '• Task “Validate solution” is in the non-agentic lane “Maintainer”, so it is not shown in the Component diagram.',
        '• Agent “AgentCoder” uses 11 tools, skills and resources, so its part of the diagram may be crowded.',
      ].join('\n'),
    );
  });

  it('caps the list at four bullets and counts the rest', () => {
    const text = formatDerivationWarnings('Summary', ALL_KINDS, t);
    const lines = text.split('\n');
    expect(lines).toHaveLength(1 + 4 + 1);
    expect(lines[5]).toBe(`• …and ${ALL_KINDS.length - 4} more`);
  });

  it('no longer sends the user to the browser console', () => {
    for (const key of [
      'interDiagram.derive.component.doneWithWarnings',
      'interDiagram.derive.deployment.doneWithWarnings',
      'interDiagram.linker.derivedWithWarnings',
    ]) {
      for (const count of [1, 2]) expect(t(key, { count })).not.toMatch(/console/i);
    }
  });
});

describe('reportDerivationWarnings', () => {
  afterEach(() => vi.restoreAllMocks());

  it('shows a multi-line warning toast and logs every message readably', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    reportDerivationWarnings(
      '[inter-diagram]',
      'Deployment diagram generated with 1 warning:',
      [{ kind: 'flat-scaffold' }],
      t,
    );

    expect(toast.warning).toHaveBeenCalledWith(
      'Deployment diagram generated with 1 warning:\n• The Component diagram has no Subsystems, so every component was placed on one Docker Host. Add Subsystems for a richer layout.',
      { style: { whiteSpace: 'pre-line' } },
    );
    expect(warn).toHaveBeenCalledTimes(1);
    const logged = warn.mock.calls[0][0] as string;
    expect(typeof logged).toBe('string');
    expect(logged).toContain('[inter-diagram] Deployment diagram generated with 1 warning:');
    expect(logged).toContain('- The Component diagram has no Subsystems');
  });

  it('does nothing without warnings', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(toast.warning).mockClear();
    reportDerivationWarnings('[inter-diagram]', 'Summary', [], t);
    expect(toast.warning).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });
});
