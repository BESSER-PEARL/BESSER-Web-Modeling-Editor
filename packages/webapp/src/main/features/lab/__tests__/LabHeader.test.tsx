import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getLabHome, type LabBase, type LabHomeResponse, type LabMeter } from '../../../shared/api/lab';
import { resetGitHubAuthForTests, signInToGitHubForTests } from '../../../shared/services/github/githubAuth';
import { LabAuthGate } from '../LabAuthGate';
import { clearLlmKey, writeLlmKey } from '../../../shared/services/llmKeyStorage';
import { LabHeader, meterLevel } from '../LabHeader';

vi.mock('../../../shared/services/labConfig', () => ({ resolveLabEnabled: vi.fn(async () => true) }));
vi.mock('../../../shared/api/lab', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../shared/api/lab')>()),
  getLabHome: vi.fn(),
}));

const NOW = Date.now() / 1000;

const base = (repo: string, upstream: string, branch: string, fork = false): LabBase => ({
  repo,
  upstream,
  branch,
  sha: 'a1fe9e6b0c1d2e3f',
  fetchedAt: NOW - 12 * 60,
  fork,
});

function home(user: LabMeter, bases: LabBase[]): LabHomeResponse {
  return {
    user: { login: 'ana', isAdmin: false },
    bases,
    runs: { inProgress: [], cap: 2 },
    meters: { month: '2026-11', user, instance: { spentUsd: 0, reservedUsd: 0, capUsd: 300 } },
    previewSlots: 1,
    linkMode: 'reflink',
    memory: { enabled: true, reason: '', count: 0, max: 60 },
    labKey: true,
  };
}

const UPSTREAM_BASES = [
  base('besser', 'BESSER-PEARL/BESSER', 'development'),
  base('frontend', 'BESSER-PEARL/BESSER-Web-Modeling-Editor', 'develop'),
  base('modeling_agent', 'BESSER-PEARL/modeling-agent', 'develop'),
];

async function renderHeader(value: LabHomeResponse, path = '/') {
  vi.mocked(getLabHome).mockResolvedValue(value);
  render(
    <MemoryRouter initialEntries={[path]}>
      <LabAuthGate>
        <LabHeader />
      </LabAuthGate>
    </MemoryRouter>,
  );
  return screen.findByTestId('lab-meter');
}

beforeEach(() => {
  resetGitHubAuthForTests();
  signInToGitHubForTests('gh-session-0123456789', 'ana');
});
afterEach(cleanup);

describe('LabHeader key chip', () => {
  afterEach(() => clearLlmKey());

  it("says whose key pays the next run: the lab's, the user's own once saved, or none yet", async () => {
    await renderHeader(home({ spentUsd: 0, reservedUsd: 0, capUsd: 75 }, UPSTREAM_BASES));
    const chip = screen.getByTestId('lab-key-chip');
    expect(chip).toHaveTextContent("Lab's key");
    act(() => {
      writeLlmKey('anthropic', 'sk-ant-test-0123456789');
    });
    expect(chip).toHaveTextContent('Your key: Anthropic');
    expect(chip.textContent).not.toContain('sk-ant');
    act(() => clearLlmKey());
    expect(chip).toHaveTextContent("Lab's key");
  });

  it('asks for a key on a lab that has none of its own', async () => {
    await renderHeader({ ...home({ spentUsd: 0, reservedUsd: 0, capUsd: 75 }, UPSTREAM_BASES), labKey: false });
    expect(screen.getByTestId('lab-key-chip')).toHaveTextContent('Add your API key');
  });
});

describe('LabHeader', () => {
  it("shows the lab's name, the base commits and no fork chip for the BESSER-PEARL repositories", async () => {
    await renderHeader(home({ spentUsd: 12.4, reservedUsd: 0, capUsd: 75 }, UPSTREAM_BASES));
    expect(screen.getByText('BESSER Lab')).toBeInTheDocument();
    expect(screen.getByTestId('lab-bases')).toHaveTextContent('development a1fe9e6·develop a1fe9e6·develop a1fe9e6');
    expect(screen.queryByTestId('lab-fork-chip')).not.toBeInTheDocument();
  });

  it('marks a repository that is a fork with an amber chip naming it', async () => {
    await renderHeader(
      home({ spentUsd: 0, reservedUsd: 0, capUsd: 75 }, [base('besser', 'armen/BESSER', 'development', true), ...UPSTREAM_BASES.slice(1)]),
    );
    const chips = screen.getAllByTestId('lab-fork-chip');
    expect(chips).toHaveLength(1);
    expect(chips[0]).toHaveTextContent('fork: armen/BESSER');
    expect(chips[0].className).toContain('text-warning');
  });

  it.each([
    [{ spentUsd: 12.4, reservedUsd: 0, capUsd: 75 }, 'ok', 'bg-brand', '$12.40 of $75'],
    [{ spentUsd: 61, reservedUsd: 0, capUsd: 75 }, 'warn', 'bg-warning', '$61 of $75'],
    [{ spentUsd: 75, reservedUsd: 0, capUsd: 75 }, 'full', 'bg-destructive', '$75 of $75'],
  ])('colours the month meter %o as %s', async (meter, level, colour, text) => {
    const shown = await renderHeader(home(meter, UPSTREAM_BASES));
    expect(shown).toHaveAttribute('data-level', level);
    expect(shown).toHaveTextContent(text);
    expect(screen.getByTestId('lab-meter-bar').className).toContain(colour);
  });

  it('turns amber only above 80 % of the cap', () => {
    expect(meterLevel({ spentUsd: 60, reservedUsd: 0, capUsd: 75 })).toBe('ok');
    expect(meterLevel({ spentUsd: 60.01, reservedUsd: 0, capUsd: 75 })).toBe('warn');
  });

  it('names the settings page in the breadcrumb', async () => {
    await renderHeader(home({ spentUsd: 0, reservedUsd: 0, capUsd: 75 }, UPSTREAM_BASES), '/settings');
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toHaveTextContent('Changes/Settings and usage');
  });
});
