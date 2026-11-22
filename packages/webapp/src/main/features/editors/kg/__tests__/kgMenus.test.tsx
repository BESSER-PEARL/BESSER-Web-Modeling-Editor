/* @vitest-environment jsdom */
/**
 * The two popover menus of the KG inspector were hand-rolled: no Escape, no
 * keyboard navigation, no focus handling. They now use the shared dropdown
 * (Radix), which provides all three; these tests pin that down.
 */
import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { KnowledgeGraphInspector } from '../KnowledgeGraphInspector';
import type { KgSelection } from '../types';
import { SpecsListEditor } from '../SpecsListEditor';
import type { KnowledgeGraphData } from '../types';

const RDFS_DOMAIN = 'http://www.w3.org/2000/01/rdf-schema#domain';

const MODEL: KnowledgeGraphData = {
  type: 'KnowledgeGraphDiagram',
  version: '1.0.0',
  nodes: [
    { id: 'person', nodeType: 'class', label: 'Person' },
    { id: 'name', nodeType: 'property', label: 'name' },
    { id: 'age', nodeType: 'property', label: 'age' },
    { id: 'orphan', nodeType: 'property', label: 'unrelated' },
  ],
  edges: [
    { id: 'e1', source: 'name', target: 'person', iri: RDFS_DOMAIN, label: 'domain' },
    { id: 'e2', source: 'age', target: 'person', iri: RDFS_DOMAIN, label: 'domain' },
  ],
};

const openMenu = (trigger: HTMLElement) => fireEvent.keyDown(trigger, { key: 'ArrowDown' });

function renderInspector(selection: KgSelection, model = MODEL) {
  const onChange = vi.fn();
  render(
    <KnowledgeGraphInspector
      model={model}
      selection={selection}
      onChange={onChange}
      onHideNode={vi.fn()}
      onBulkHideNodes={vi.fn()}
      onRequestSelection={vi.fn()}
      onClearSelection={vi.fn()}
    />,
  );
  return { onChange };
}

describe('Inspector: adding a constraint to a class', () => {
  it('opens from the keyboard, with focus on the first item', () => {
    renderInspector({ kind: 'node', id: 'person' });

    openMenu(screen.getByRole('button', { name: 'Add constraint' }));

    const items = screen.getAllByRole('menuitem');
    expect(items.map((i) => i.textContent)).toEqual([
      expect.stringContaining('Constrain this class'),
      'name',
      'age',
    ]);
    expect(document.activeElement).toBe(items[0]);
  });

  it('lists only the properties whose domain is this class', () => {
    renderInspector({ kind: 'node', id: 'person' });

    openMenu(screen.getByRole('button', { name: 'Add constraint' }));

    expect(screen.queryByRole('menuitem', { name: 'unrelated' })).toBeNull();
  });

  it('moves between items with the arrow keys', async () => {
    renderInspector({ kind: 'node', id: 'person' });
    openMenu(screen.getByRole('button', { name: 'Add constraint' }));
    const items = screen.getAllByRole('menuitem');

    fireEvent.keyDown(items[0], { key: 'ArrowDown' });
    await waitFor(() => expect(document.activeElement).toBe(items[1]));
    fireEvent.keyDown(items[1], { key: 'ArrowUp' });
    await waitFor(() => expect(document.activeElement).toBe(items[0]));
  });

  it('closes on Escape and gives focus back to the button', async () => {
    renderInspector({ kind: 'node', id: 'person' });
    const trigger = screen.getByRole('button', { name: 'Add constraint' });
    openMenu(trigger);
    expect(screen.getByRole('menu')).toBeInTheDocument();

    fireEvent.keyDown(screen.getAllByRole('menuitem')[0], { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });

  it('attaches a node constraint to the class when the first item is chosen', () => {
    const { onChange } = renderInspector({ kind: 'node', id: 'person' });
    openMenu(screen.getByRole('button', { name: 'Add constraint' }));

    fireEvent.click(screen.getAllByRole('menuitem')[0]);

    expect(onChange).toHaveBeenCalledTimes(1);
    const next: KnowledgeGraphData = onChange.mock.calls[0][0];
    expect(next.nodes.some((n) => n.nodeType === 'nodeConstraint')).toBe(true);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('attaches a property constraint to the chosen property', () => {
    const { onChange } = renderInspector({ kind: 'node', id: 'person' });
    openMenu(screen.getByRole('button', { name: 'Add constraint' }));

    fireEvent.click(screen.getByRole('menuitem', { name: 'age' }));

    const next: KnowledgeGraphData = onChange.mock.calls[0][0];
    const constraint = next.nodes.find((n) => n.nodeType === 'propertyConstraint');
    expect(constraint).toBeDefined();
    expect(next.edges.some((e) => e.source === constraint!.id && e.target === 'age')).toBe(true);
  });

  it('says so when the class has no properties yet', () => {
    renderInspector(
      { kind: 'node', id: 'person' },
      { ...MODEL, edges: [] },
    );
    openMenu(screen.getByRole('button', { name: 'Add constraint' }));

    expect(screen.getByText(/No properties in this class's domain yet/)).toBeInTheDocument();
  });
});

describe('Inspector: adding a constraint to a property', () => {
  it('needs no menu: one click attaches it', () => {
    const { onChange } = renderInspector({ kind: 'node', id: 'name' });

    fireEvent.click(screen.getByRole('button', { name: 'Add constraint' }));

    expect(screen.queryByRole('menu')).toBeNull();
    expect(onChange).toHaveBeenCalledTimes(1);
    const next: KnowledgeGraphData = onChange.mock.calls[0][0];
    expect(next.nodes.some((n) => n.nodeType === 'propertyConstraint')).toBe(true);
  });
});

describe('the constraint picker', () => {
  function renderPicker() {
    const onChange = vi.fn();
    render(
      <SpecsListEditor
        specs={[]}
        onChange={onChange}
        nodeType="propertyConstraint"
        ownerNodeId="shape"
        model={MODEL}
        depth={0}
      />,
    );
    const trigger = screen.getByRole('button', { name: 'Add constraint' });
    return { onChange, trigger };
  }
  const search = () => screen.getByPlaceholderText('Search constraints…') as HTMLInputElement;

  it('focuses the search field as soon as it opens', async () => {
    const { trigger } = renderPicker();

    openMenu(trigger);

    await waitFor(() => expect(search()).toHaveFocus());
  });

  it('lists constraints grouped by category', () => {
    const { trigger } = renderPicker();

    openMenu(trigger);

    const menu = screen.getByRole('menu');
    expect(within(menu).getAllByRole('menuitem').length).toBeGreaterThan(5);
    expect(within(menu).getAllByRole('group').length).toBeGreaterThan(1);
  });

  it('filters while typing, without the menu eating the letters', async () => {
    const { trigger } = renderPicker();
    openMenu(trigger);
    const before = screen.getAllByRole('menuitem').length;
    await waitFor(() => expect(search()).toHaveFocus());

    // "a" would move menu focus to an item starting with "a" ("At least N
    // values") if the menu saw the key.
    fireEvent.keyDown(search(), { key: 'a' });
    expect(search()).toHaveFocus();
    fireEvent.change(search(), { target: { value: 'least' } });

    expect(search()).toHaveFocus();
    expect(search().value).toBe('least');
    const after = screen.getAllByRole('menuitem');
    expect(after.length).toBeGreaterThan(0);
    expect(after.length).toBeLessThan(before);
    expect(after.map((i) => i.textContent)).toEqual(
      expect.arrayContaining([expect.stringContaining('At least N values')]),
    );
  });

  it('says so when nothing matches', async () => {
    const { trigger } = renderPicker();
    openMenu(trigger);

    fireEvent.change(search(), { target: { value: 'zzzzzz' } });

    expect(screen.queryAllByRole('menuitem')).toHaveLength(0);
    expect(screen.getByText('No constraints match your search.')).toBeInTheDocument();
  });

  it('moves from the search field into the list with ArrowDown', async () => {
    const { trigger } = renderPicker();
    openMenu(trigger);
    await waitFor(() => expect(search()).toHaveFocus());

    fireEvent.keyDown(search(), { key: 'ArrowDown' });

    expect(document.activeElement).toBe(screen.getAllByRole('menuitem')[0]);
  });

  it('closes on Escape from the search field and forgets the search', async () => {
    const { trigger } = renderPicker();
    openMenu(trigger);
    fireEvent.change(search(), { target: { value: 'min' } });

    fireEvent.keyDown(search(), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());

    openMenu(trigger);
    expect(search().value).toBe('');
  });

  it('adds the chosen constraint and closes', async () => {
    const { trigger, onChange } = renderPicker();
    openMenu(trigger);
    fireEvent.change(search(), { target: { value: 'least' } });

    const first = screen.getAllByRole('menuitem')[0];
    await act(async () => {
      fireEvent.click(first);
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toHaveLength(1);
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
  });
});
