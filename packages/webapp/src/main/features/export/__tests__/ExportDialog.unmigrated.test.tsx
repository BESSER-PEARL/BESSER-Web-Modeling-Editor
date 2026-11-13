/**
 * A v3 diagram that could not be migrated is not drawn by the editor, so an
 * image or B-UML export of it would be empty: only its stored JSON is offered.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ExportDialog } from '../ExportDialog';

const diagrams = vi.hoisted(() => ({
  active: null as unknown,
}));
const v3Diagram = {
  id: 'd1',
  title: 'Library',
  model: { version: '3.0.0', type: 'ClassDiagram', elements: { c1: { id: 'c1', type: 'Class' } }, relationships: {} },
};
const v4Diagram = {
  id: 'd1',
  title: 'Library',
  model: { version: '4.0.0', type: 'ClassDiagram', nodes: [{ id: 'n1' }], edges: [] },
};

vi.mock('../../../shared/services/analytics/lazy-analytics', () => ({ captureEvent: vi.fn() }));
vi.mock('../useExportProjectBUML', () => ({ exportProjectAsSingleBUMLFile: vi.fn() }));
vi.mock('../useExportProjectJSON', () => ({ exportProjectById: vi.fn() }));
vi.mock('../useExportPng', () => ({ useExportPNG: () => vi.fn() }));
vi.mock('../useExportSvg', () => ({ useExportSVG: () => vi.fn() }));
vi.mock('../useExportBuml', () => ({ useExportBUML: () => vi.fn() }));
vi.mock('../useExportJson', () => ({ useExportJSON: () => vi.fn() }));
vi.mock('../../../app/hooks/useProject', () => ({
  useProject: () => ({
    currentProject: { id: 'p1', currentDiagramType: 'ClassDiagram', diagrams: { ClassDiagram: [diagrams.active] } },
  }),
}));
vi.mock('../../../app/store/hooks', () => ({ useAppSelector: () => diagrams.active }));

const button = (name: string) => screen.getByRole('button', { name });
const open = () => render(<ExportDialog open onOpenChange={() => {}} editor={{} as never} currentDiagramTitle="Library" />);

describe('ExportDialog — unmigrated diagram', () => {
  it('offers only the JSON of the current diagram and says why', () => {
    diagrams.active = v3Diagram;
    open();
    for (const name of ['Export as SVG', 'Export PNG (White)', 'Export PNG (Transparent)', 'Export Diagram as B-UML']) {
      expect(button(name)).toBeDisabled();
    }
    expect(button('Export Diagram as JSON')).not.toBeDisabled();
    expect(screen.getByTestId('export-unmigrated-notice')).toBeInTheDocument();
  });

  it('leaves every export enabled for a migrated diagram', () => {
    diagrams.active = v4Diagram;
    open();
    for (const name of ['Export as SVG', 'Export PNG (White)', 'Export Diagram as B-UML', 'Export Diagram as JSON']) {
      expect(button(name)).not.toBeDisabled();
    }
    expect(screen.queryByTestId('export-unmigrated-notice')).toBeNull();
  });
});
