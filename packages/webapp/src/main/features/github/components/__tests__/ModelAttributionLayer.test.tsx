import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BesserProject } from '../../../../shared/types/project';

const PROJECT_ID = 'p1';
const ANA = { addedBy: 'ana', addedAt: '2026-11-04T12:00:00Z' };
const BEN = { addedBy: 'ben', addedAt: '2026-11-04T13:00:00Z' };

const state = vi.hoisted(() => ({ project: null as unknown, link: null as unknown }));
vi.mock('../../../../app/hooks/useProject', () => ({ useProject: () => ({ currentProject: state.project }) }));
vi.mock('../../hooks/useRepoSync', () => ({ useRepoSync: () => ({ link: state.link }) }));

import { authorColor, ModelAttributionLayer } from '../ModelAttributionLayer';
import { getProjectGitHubLink, setProjectGitHubLink } from '../../../../shared/services/storage/projectGitHubLink';

const MODEL = {
  elements: {
    c1: { id: 'c1', type: 'Class', name: 'Book', owner: null, fillColor: '#ff0000' },
    c2: { id: 'c2', type: 'Class', name: 'Loan', owner: null },
    a2: { id: 'a2', type: 'ClassAttribute', name: '+ due: date', owner: 'c2' },
    a1: { id: 'a1', type: 'ClassAttribute', name: '+ title: str', owner: 'c1' },
  },
};

const project = (attribution?: BesserProject['attribution']) =>
  ({ id: PROJECT_ID, attribution, diagrams: { ClassDiagram: [{ id: 'cd1', model: MODEL }] } }) as unknown as BesserProject;

const LINK = { owner: 'ana', repo: 'shop', branch: 'main' };

/** The canvas: the elements the editor draws, each with its `data-id`. */
function drawCanvas() {
  const canvas = document.createElement('div');
  canvas.innerHTML = ['c1', 'c2', 'a1', 'a2'].map((id) => `<svg data-id="${id}"><text>${id}</text></svg>`).join('');
  document.body.appendChild(canvas);
  return canvas;
}

let canvas: HTMLElement;

beforeEach(() => {
  localStorage.clear();
  canvas = drawCanvas();
});

afterEach(() => {
  cleanup();
  canvas.remove();
});

describe('ModelAttributionLayer', () => {
  it('tints a new class in its author\'s colour, names the author and lists it', async () => {
    state.project = project({ c1: ANA, c2: BEN, a2: BEN });
    state.link = { ...LINK, newFromRepo: ['c2', 'a2'] };

    render(<ModelAttributionLayer />);

    // One tint for the class: its new attribute is part of it.
    await waitFor(() => expect(screen.getAllByTestId('new-element-tint')).toHaveLength(1));
    expect(screen.getByText('@ben')).toBeTruthy();
    expect(screen.getByRole('region').textContent).toContain('Loan');
    expect(screen.getByTestId('new-element-tint').style.boxShadow).toContain(authorColor('ben'));
  });

  it('marks a new attribute of an existing class on its own', async () => {
    state.project = project({ c1: ANA, a1: BEN });
    state.link = { ...LINK, newFromRepo: ['a1'] };

    render(<ModelAttributionLayer />);

    await waitFor(() => expect(screen.getAllByTestId('new-element-tint')).toHaveLength(1));
    expect(screen.getByRole('region').textContent).toContain('Book.title');
  });

  it('shows no mark in a project without records, even with stale marks', () => {
    state.project = project(undefined);
    state.link = { ...LINK, newFromRepo: ['c2'] };

    render(<ModelAttributionLayer />);

    expect(screen.queryByTestId('new-element-tint')).toBeNull();
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('drops the mark of an element that is gone', () => {
    state.project = project({ c1: ANA });
    state.link = { ...LINK, newFromRepo: ['deleted'] };

    render(<ModelAttributionLayer />);

    expect(screen.queryByRole('region')).toBeNull();
  });

  it('clears the marks from the link and leaves the project alone', () => {
    const current = project({ c2: BEN });
    state.project = current;
    state.link = { ...LINK, newFromRepo: ['c2'] };
    setProjectGitHubLink(PROJECT_ID, state.link as never);
    const before = JSON.stringify(current);

    render(<ModelAttributionLayer />);
    fireEvent.click(screen.getByRole('button'));

    expect(getProjectGitHubLink(PROJECT_ID)?.newFromRepo).toBeUndefined();
    expect(JSON.stringify(current)).toBe(before);
  });

  it('says who added an element under the pointer, new or not', async () => {
    state.project = project({ c1: ANA });
    state.link = LINK;

    render(<ModelAttributionLayer />);
    act(() => {
      fireEvent.mouseOver(canvas.querySelector('[data-id="c1"] text') as Element);
    });

    await waitFor(() => expect(screen.getByRole('tooltip').textContent).toContain('@ana'));
    expect(screen.queryByTestId('new-element-tint')).toBeNull();

    act(() => {
      fireEvent.mouseOver(canvas.querySelector('[data-id="c2"] text') as Element);
    });
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull());
  });

  it('draws nothing for a project without a link', () => {
    state.project = project({ c1: ANA });
    state.link = null;

    const { container } = render(<ModelAttributionLayer />);

    expect(container.firstChild).toBeNull();
  });
});

describe('authorColor', () => {
  it('gives a login the same colour every time', () => {
    expect(authorColor('ben')).toBe(authorColor('ben'));
  });
});
