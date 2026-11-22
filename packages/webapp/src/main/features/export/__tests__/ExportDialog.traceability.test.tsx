import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ExportDialog } from '../ExportDialog';

const project = {
  id: 'p1',
  diagrams: { ClassDiagram: [{ id: 'd1', title: 'Classes', model: { elements: { a: {} } } }] },
};

let operations: unknown[] = [];
const exportProjectById = vi.fn();
const exportProjectAsSingleBUMLFile = vi.fn();

vi.mock('../useExportProjectJSON', () => ({ exportProjectById: (...args: unknown[]) => exportProjectById(...args) }));
vi.mock('../useExportProjectBUML', () => ({
  exportProjectAsSingleBUMLFile: (...args: unknown[]) => exportProjectAsSingleBUMLFile(...args),
}));
vi.mock('../useExportPng', () => ({ useExportPNG: () => vi.fn() }));
vi.mock('../useExportSvg', () => ({ useExportSVG: () => vi.fn() }));
vi.mock('../useExportBuml', () => ({ useExportBUML: () => vi.fn() }));
vi.mock('../useExportJson', () => ({ useExportJSON: () => vi.fn() }));
vi.mock('../../../app/hooks/useProject', () => ({ useProject: () => ({ currentProject: project }) }));
vi.mock('../../../app/store/hooks', () => ({ useAppSelector: () => null }));
vi.mock('../../../shared/traceability/traceStore', () => ({ useProjectTrace: () => ({ operations }) }));
vi.mock('../../../shared/types/project', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  diagramHasContent: () => true,
}));

describe('ExportDialog — traceability', () => {
  beforeEach(() => {
    exportProjectById.mockClear();
    exportProjectAsSingleBUMLFile.mockClear();
  });

  it('does not offer the trace when nothing was recorded', () => {
    operations = [];
    render(<ExportDialog open onOpenChange={() => {}} currentDiagramTitle="Classes" />);
    expect(screen.queryByText('Traceability')).toBeNull();
  });

  it('exports the trace only when ticked', async () => {
    operations = [{}, {}];
    render(<ExportDialog open onOpenChange={() => {}} currentDiagramTitle="Classes" />);
    expect(screen.getByText('The project trace (2 recorded operations)')).toBeTruthy();

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Export as JSON' })));
    expect(exportProjectById).toHaveBeenLastCalledWith(project, ['ClassDiagram'], false);

    fireEvent.click(screen.getByText('Traceability'));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Export as B-UML' })));
    expect(exportProjectAsSingleBUMLFile).toHaveBeenLastCalledWith(project, ['ClassDiagram'], true);
  });
});
