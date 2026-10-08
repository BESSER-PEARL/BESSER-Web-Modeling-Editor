/**
 * The project preview used to be a hand-rolled portal: Escape did nothing, its
 * z-index sat below the assistant pill/robot, and it ignored the app theme. It
 * now runs on the shared Radix Dialog; these tests pin that behaviour.
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import i18n from '../../../i18n';
import { JsonViewerModal } from '../json-viewer-modal';

const JSON_DATA = JSON.stringify({ name: 'Library', diagrams: { ClassDiagram: [{ id: 'd1' }] } }, null, 2);

const renderModal = (overrides: Partial<React.ComponentProps<typeof JsonViewerModal>> = {}) => {
  const props = {
    isVisible: true,
    jsonData: JSON_DATA,
    diagramType: 'Class Diagram',
    onClose: vi.fn(),
    onCopy: vi.fn(),
    onDownload: vi.fn(),
    ...overrides,
  };
  render(<JsonViewerModal {...props} />);
  return props;
};

afterEach(cleanup);

describe('JsonViewerModal', () => {
  it('closes on Escape', () => {
    const { onClose } = renderModal();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes from the standard dialog close button', () => {
    const { onClose } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when hidden', () => {
    renderModal({ isVisible: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('labels the dialog with the title and diagram type', () => {
    renderModal();
    const dialog = screen.getByRole('dialog', { name: i18n.t('shared.jsonViewer.jsonTitle') });
    expect(dialog).toHaveAccessibleDescription('Class Diagram');
  });

  it('renders a collapsible JSON tree', () => {
    renderModal();
    expect(screen.getByText('"Library"')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Collapse diagrams' }));
    expect(screen.queryByText('"d1"')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Expand diagrams' }));
    expect(screen.getByText('"d1"')).toBeInTheDocument();
  });

  it('wires Download JSON and Copy JSON', () => {
    const { onCopy, onDownload } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: i18n.t('shared.jsonViewer.downloadJson') }));
    fireEvent.click(screen.getByRole('button', { name: i18n.t('shared.jsonViewer.copyJson') }));
    expect(onDownload).toHaveBeenCalledTimes(1);
    expect(onCopy).toHaveBeenCalledTimes(1);
  });

  it('switches to the B-UML tab and requests the preview once', () => {
    const onRequestBuml = vi.fn();
    renderModal({ enableBumlView: true, onRequestBuml, onCopyBuml: vi.fn() });

    const jsonTab = screen.getByRole('tab', { name: 'JSON' });
    const bumlTab = screen.getByRole('tab', { name: 'B-UML' });
    expect(jsonTab).toHaveAttribute('aria-selected', 'true');
    expect(jsonTab.className).toContain('bg-brand');

    fireEvent.click(bumlTab);
    expect(bumlTab).toHaveAttribute('aria-selected', 'true');
    expect(onRequestBuml).toHaveBeenCalledTimes(1);
    expect(screen.getByText(i18n.t('shared.jsonViewer.noBumlPreview'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: i18n.t('shared.jsonViewer.copyBuml') })).toBeDisabled();
  });

  it('shows generated B-UML code', () => {
    renderModal({ enableBumlView: true, bumlData: 'library = DomainModel("Library")' });
    fireEvent.click(screen.getByRole('tab', { name: 'B-UML' }));
    expect(screen.getByRole('dialog').querySelector('pre code')?.textContent).toContain('DomainModel');
  });
});
