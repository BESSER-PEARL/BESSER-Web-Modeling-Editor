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

import { authorColor, ModelAttributionBanner, ModelAttributionLayer } from '../ModelAttributionLayer';
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
  ({
    id: PROJECT_ID,
    attribution,
    currentDiagramType: 'ClassDiagram',
    diagrams: { ClassDiagram: [{ id: 'cd1', model: MODEL }] },
  }) as unknown as BesserProject;

const renderBoth = () =>
  render(
    <>
      <ModelAttributionLayer />
      <ModelAttributionBanner />
    </>,
  );

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

    renderBoth();

    // One tint for the class: its new attribute is part of it.
    await waitFor(() => expect(screen.getAllByTestId('new-element-tint')).toHaveLength(1));
    expect(screen.getByText('@ben')).toBeTruthy();
    expect(screen.getByRole('region').textContent).toContain('Loan');
    expect(screen.getByTestId('new-element-tint').style.boxShadow).toContain(authorColor('ben'));
  });

  it('marks a new attribute of an existing class on its own', async () => {
    state.project = project({ c1: ANA, a1: BEN });
    state.link = { ...LINK, newFromRepo: ['a1'] };

    renderBoth();

    await waitFor(() => expect(screen.getAllByTestId('new-element-tint')).toHaveLength(1));
    expect(screen.getByRole('region').textContent).toContain('Book.title');
  });

  it('shows no mark in a project without records, even with stale marks', () => {
    state.project = project(undefined);
    state.link = { ...LINK, newFromRepo: ['c2'] };

    renderBoth();

    expect(screen.queryByTestId('new-element-tint')).toBeNull();
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('drops the mark of an element that is gone', () => {
    state.project = project({ c1: ANA });
    state.link = { ...LINK, newFromRepo: ['deleted'] };

    renderBoth();

    expect(screen.queryByRole('region')).toBeNull();
  });

  it('clears the marks from the link and leaves the project alone', () => {
    const current = project({ c2: BEN });
    state.project = current;
    state.link = { ...LINK, newFromRepo: ['c2'] };
    setProjectGitHubLink(PROJECT_ID, state.link as never);
    const before = JSON.stringify(current);

    renderBoth();
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

  // Review 2026-11-04: a repository's file reaches this render, and the only boundary is the whole app's.
  it('ignores records that are not text instead of crashing', () => {
    const forged = { c1: { addedBy: 5, addedAt: 7 }, c2: 'x', a1: null } as unknown as BesserProject['attribution'];
    state.project = project(forged);
    state.link = { ...LINK, newFromRepo: ['c1', 'c2', 'a1'] };

    expect(() => renderBoth()).not.toThrow();
    expect(screen.queryByTestId('new-element-tint')).toBeNull();
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('does not take a name every object has for a record', async () => {
    state.project = project({ c1: ANA });
    state.link = LINK;
    canvas.innerHTML = '<svg data-id="constructor"><text>x</text></svg>';

    render(<ModelAttributionLayer />);
    act(() => {
      fireEvent.mouseOver(canvas.querySelector('text') as Element);
    });

    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('finds an element whose id holds characters a selector cannot', async () => {
    const id = 'a"b\nc';
    state.project = {
      ...project({ [id]: BEN }),
      diagrams: { ClassDiagram: [{ id: 'cd1', model: { elements: { [id]: { id, type: 'Class', name: 'Odd' } } } }] },
    } as unknown as BesserProject;
    state.link = { ...LINK, newFromRepo: [id] };
    const node = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    node.setAttribute('data-id', id);
    canvas.appendChild(node);

    expect(() => render(<ModelAttributionLayer />)).not.toThrow();
    await waitFor(() => expect(screen.getAllByTestId('new-element-tint')).toHaveLength(1));
  });

  // Firefox's getScreenCTM() on a nested <svg> ignores its own x and y (review 2026-11-04, measured in Firefox 153).
  it('places a tint from the element\'s content, not from the nested svg itself', async () => {
    state.project = project({ c2: BEN });
    state.link = { ...LINK, newFromRepo: ['c2'] };
    const node = canvas.querySelector('[data-id="c2"]') as Element;
    Object.assign(node, {
      getScreenCTM: () => ({ a: 1, d: 1, e: 900, f: 498 }),
      width: { baseVal: { value: 160 } },
      height: { baseVal: { value: 100 } },
    });
    Object.assign(node.firstElementChild as Element, { getScreenCTM: () => ({ a: 2, d: 2, e: 950, f: 398 }) });

    render(<ModelAttributionLayer />);

    const tint = await screen.findByTestId('new-element-tint');
    expect(tint.style.left).toBe('950px');
    expect(tint.style.top).toBe('398px');
    expect(tint.style.width).toBe('320px');
    expect(tint.style.height).toBe('200px');
  });

  it('finds each element once, not on every frame', async () => {
    state.project = project({ c2: BEN });
    state.link = { ...LINK, newFromRepo: ['c2'] };
    const query = vi.spyOn(document, 'querySelector');
    const frames: FrameRequestCallback[] = [];
    const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });

    render(<ModelAttributionLayer />);
    const firstRun = query.mock.calls.length;
    frames.splice(0).forEach((frame) => frame(0));
    frames.splice(0).forEach((frame) => frame(0));

    expect(query.mock.calls.length).toBe(firstRun);
    query.mockRestore();
    raf.mockRestore();
  });

  it('shows nothing over another editor', () => {
    state.project = { ...project({ c2: BEN }), currentDiagramType: 'GUINoCodeDiagram' };
    state.link = { ...LINK, newFromRepo: ['c2'] };

    renderBoth();

    expect(screen.queryByTestId('new-element-tint')).toBeNull();
    expect(screen.queryByRole('region')).toBeNull();
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
    expect(authorColor('ben')).toBe('#be123c');
    expect(authorColor('ana')).toBe('#1d4ed8');
  });
});
