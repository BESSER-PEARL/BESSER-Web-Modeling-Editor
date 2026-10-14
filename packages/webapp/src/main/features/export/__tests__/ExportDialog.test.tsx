import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ExportDialog } from '../ExportDialog';

const project = {
  id: 'p1',
  diagrams: { ClassDiagram: [{ id: 'd1', title: 'Classes', model: { elements: { a: {} } } }] },
};

let resolveExport: () => void = () => {};
const exportProjectAsSingleBUMLFile = vi.fn(
  () => new Promise<void>((resolve) => { resolveExport = resolve; }),
);

vi.mock('../useExportProjectBUML', () => ({
  exportProjectAsSingleBUMLFile: (...args: unknown[]) => exportProjectAsSingleBUMLFile(...(args as [])),
}));
vi.mock('../useExportProjectJSON', () => ({ exportProjectById: vi.fn() }));
vi.mock('../useExportPng', () => ({ useExportPNG: () => vi.fn() }));
vi.mock('../useExportSvg', () => ({ useExportSVG: () => vi.fn() }));
vi.mock('../useExportBuml', () => ({ useExportBUML: () => vi.fn() }));
vi.mock('../useExportJson', () => ({ useExportJSON: () => vi.fn() }));
vi.mock('../../../app/hooks/useProject', () => ({ useProject: () => ({ currentProject: project }) }));
vi.mock('../../../app/store/hooks', () => ({ useAppSelector: () => null }));
vi.mock('../../../shared/types/project', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  diagramHasContent: () => true,
}));

describe('ExportDialog — in-flight export', () => {
  it('ignores a second click while a B-UML export is still running', async () => {
    render(<ExportDialog open onOpenChange={() => {}} currentDiagramTitle="Classes" />);

    const button = screen.getByRole('button', { name: 'Export as B-UML' });
    await act(async () => {
      fireEvent.click(button);
      fireEvent.click(button);
    });

    expect(exportProjectAsSingleBUMLFile).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');

    await act(async () => resolveExport());
    expect(button).not.toBeDisabled();
  });
});
