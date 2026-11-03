import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ExportDialog } from '../ExportDialog';
import { ApiError } from '../../../shared/api/api-client';
import type { ExportOutcome } from '../exportOutcome';

const project = {
  id: 'p1',
  diagrams: { ClassDiagram: [{ id: 'd1', title: 'Classes', model: { elements: { a: {} } } }] },
};

let resolveExport: (outcome?: ExportOutcome) => void = () => {};
const exportProjectAsSingleBUMLFile = vi.fn(
  () => new Promise<ExportOutcome>((resolve) => { resolveExport = (outcome = { ok: true }) => resolve(outcome); }),
);
const captureEvent = vi.hoisted(() => vi.fn());
vi.mock('../../../shared/services/analytics/lazy-analytics', () => ({ captureEvent }));

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

describe('ExportDialog — analytics', () => {
  const exportEvents = () => captureEvent.mock.calls.filter(([event]) => event.startsWith('diagram_export'));

  it('reports a finished B-UML export', async () => {
    captureEvent.mockClear();
    render(<ExportDialog open onOpenChange={() => {}} currentDiagramTitle="Classes" />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Export as B-UML' })));
    await act(async () => resolveExport({ ok: true }));

    expect(exportEvents()).toEqual([
      ['diagram_exported', { format: 'BUML', diagram_count: 1, diagram_type: undefined, source: 'dialog' }],
    ]);
  });

  it('reports a B-UML export the exporter could not finish as a failure, not an export', async () => {
    captureEvent.mockClear();
    render(<ExportDialog open onOpenChange={() => {}} currentDiagramTitle="Classes" />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Export as B-UML' })));
    await act(async () => resolveExport({ ok: false, reason: 'request', error: new ApiError(500, 'boom') }));

    expect(exportEvents()).toEqual([
      [
        'diagram_export_failed',
        { format: 'BUML', reason: 'request', source: 'dialog', error_type: 'ApiError', http_status: 500, network_error: false },
      ],
    ]);
  });
});
