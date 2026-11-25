import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TableComponent } from '../widgets/TableComponent';
import { applyGuiPresentation, captureGuiFontSizes } from '../../../../shared/utils/gui-personalization';

describe('personalized table text', () => {
  it('preserves larger rendered table text while growing smaller cells', () => {
    render(<div id="large-users-table"><TableComponent title="Large title" columns={[{ field: 'name', label: 'Name' }]} data={[{ name: 'Alice' }]} /></div>);
    const title = screen.getByRole('heading', { name: 'Large title' });
    title.style.fontSize = '36px';
    const root = document.getElementById('large-users-table')!;
    const fontSizes = captureGuiFontSizes(root, 'large-users-table', true);
    const snapshot = applyGuiPresentation({ components: [{ type: 'table', attributes: { id: 'large-users-table' } }], css: [], fontSizes }, { size: 24 }, 'home');
    const rulesForTitle = snapshot.css.filter((rule) => title.matches(rule.selectorsAdd));
    expect(rulesForTitle.some((rule) => rule.style['font-size'] === '36px !important')).toBe(true);
    const style = document.createElement('style');
    style.textContent = snapshot.css.map((rule) => `${rule.selectorsAdd} { ${Object.entries(rule.style).map(([key, value]) => `${key}: ${value};`).join(' ')} }`).join('\n');
    document.head.appendChild(style);
    try {
      expect(getComputedStyle(title).fontSize).toBe('36px');
      expect(getComputedStyle(screen.getByRole('cell', { name: 'Alice' })).fontSize).toBe('24px');
    } finally {
      style.remove();
    }
  });

  it('applies font size to React-rendered headers, cells, and controls without affecting another table', () => {
    const snapshot = applyGuiPresentation({
      components: [{ type: 'table', tagName: 'div', attributes: { id: 'users-table' } }], css: [],
    }, { size: 24 }, 'home');
    const rule = snapshot.css[0];
    const style = document.createElement('style');
    style.textContent = `${rule.selectorsAdd} { ${Object.entries(rule.style).map(([key, value]) => `${key}: ${value};`).join(' ')} }`;
    document.head.appendChild(style);
    try {
      render(<>
        <div id="users-table">
          <TableComponent columns={[{ field: 'name', label: 'Name' }]} data={[{ name: 'Alice' }]} />
        </div>
        <table><tbody><tr><td style={{ fontSize: '14px' }}>Other table</td></tr></tbody></table>
      </>);
      expect(getComputedStyle(screen.getByRole('columnheader', { name: 'Name' })).fontSize).toBe('24px');
      expect(getComputedStyle(screen.getByRole('cell', { name: 'Alice' })).fontSize).toBe('24px');
      expect(getComputedStyle(screen.getByRole('cell', { name: 'Other table' })).fontSize).toBe('14px');
      expect(rule.selectorsAdd).toContain('#users-table button');
      expect(snapshot.components[0].components).toBeUndefined();
    } finally {
      style.remove();
    }
  });
});
