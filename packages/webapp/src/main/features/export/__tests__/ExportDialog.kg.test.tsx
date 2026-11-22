/* @vitest-environment jsdom */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  currentDiagramType: 'KnowledgeGraphDiagram' as string,
  resolveExport: (_ok: boolean) => {},
}));
const exportKgRdf = vi.hoisted(() => vi.fn());

vi.mock('../useExportKgRdf', () => ({ useExportKgRdf: () => exportKgRdf }));
vi.mock('../useExportProjectBUML', () => ({ exportProjectAsSingleBUMLFile: vi.fn() }));
vi.mock('../useExportProjectJSON', () => ({ exportProjectById: vi.fn() }));
vi.mock('../useExportPng', () => ({ useExportPNG: () => vi.fn() }));
vi.mock('../useExportSvg', () => ({ useExportSVG: () => vi.fn() }));
vi.mock('../useExportBuml', () => ({ useExportBUML: () => vi.fn() }));
vi.mock('../useExportJson', () => ({ useExportJSON: () => vi.fn() }));

const kgModel = {
  type: 'KnowledgeGraphDiagram',
  version: '1.0.0',
  nodes: [{ id: 'a', nodeType: 'class', label: 'A' }],
  edges: [],
};
vi.mock('../../../app/hooks/useProject', () => ({
  useProject: () => ({
    currentProject: {
      id: 'p1',
      currentDiagramType: state.currentDiagramType,
      diagrams: {
        KnowledgeGraphDiagram: [{ id: 'kg1', title: 'People', model: kgModel }],
        ClassDiagram: [{ id: 'c1', title: 'Classes', model: { elements: { a: {} } } }],
      },
    },
  }),
}));
vi.mock('../../../app/store/hooks', () => ({
  useAppSelector: () => ({ id: 'kg1', title: 'People', model: kgModel }),
}));
vi.mock('../../../shared/types/project', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  diagramHasContent: () => true,
}));

import { ExportDialog } from '../ExportDialog';

beforeEach(() => {
  vi.clearAllMocks();
  state.currentDiagramType = 'KnowledgeGraphDiagram';
  exportKgRdf.mockImplementation(() => new Promise<boolean>((resolve) => (state.resolveExport = resolve)));
});

describe('ExportDialog with a Knowledge Graph diagram', () => {
  it('offers RDF export instead of the UML image and diagram formats', () => {
    render(<ExportDialog open onOpenChange={() => {}} currentDiagramTitle="People" />);

    expect(screen.getByTestId('kg-rdf-export')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Export as SVG' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Export Diagram as B-UML' })).toBeNull();
    // The UML-only warning does not apply.
    expect(screen.queryByText(/require a UML diagram view/i)).toBeNull();
  });

  it('keeps project-level export, and labels the Knowledge Graph in it', () => {
    render(<ExportDialog open onOpenChange={() => {}} currentDiagramTitle="People" />);

    expect(screen.getByRole('button', { name: 'Export as JSON' })).toBeInTheDocument();
    expect(screen.getByText('Knowledge Graph Diagram')).toBeInTheDocument();
  });

  it('exports with the chosen options, and closes once the file is downloaded', async () => {
    const onOpenChange = vi.fn();
    render(<ExportDialog open onOpenChange={onOpenChange} currentDiagramTitle="People" />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('kg-rdf-export-button'));
    });
    expect(exportKgRdf).toHaveBeenCalledWith('ttl', 'both');
    expect(onOpenChange).not.toHaveBeenCalled();

    await act(async () => state.resolveExport(true));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('stays open when the export failed, so the user can retry', async () => {
    const onOpenChange = vi.fn();
    render(<ExportDialog open onOpenChange={onOpenChange} currentDiagramTitle="People" />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('kg-rdf-export-button'));
    });
    await act(async () => state.resolveExport(false));

    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByTestId('kg-rdf-export-button')).toBeEnabled();
  });

  it('ignores a second click while the export is running', async () => {
    render(<ExportDialog open onOpenChange={() => {}} currentDiagramTitle="People" />);
    const button = screen.getByTestId('kg-rdf-export-button');

    await act(async () => {
      fireEvent.click(button);
      fireEvent.click(button);
    });

    expect(exportKgRdf).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();
  });

  it('shows the usual UML formats for any other diagram type', () => {
    state.currentDiagramType = 'ClassDiagram';
    render(<ExportDialog open onOpenChange={() => {}} currentDiagramTitle="Classes" />);

    expect(screen.queryByTestId('kg-rdf-export')).toBeNull();
    expect(screen.getByRole('button', { name: 'Export as SVG' })).toBeInTheDocument();
  });
});
