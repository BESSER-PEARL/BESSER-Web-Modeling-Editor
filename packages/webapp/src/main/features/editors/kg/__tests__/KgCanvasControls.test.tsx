/* @vitest-environment jsdom */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { CytoscapeCanvasHandle } from '../CytoscapeCanvas';
import { KgCanvasControls } from '../KgCanvasControls';
import { KG_MAX_ZOOM, KG_MIN_ZOOM } from '../types';

/** A canvas handle whose zoom the test sets, notifying subscribers like the real one. */
const fakeCanvas = (initialZoom = 1) => {
  let zoom = initialZoom;
  const listeners = new Set<() => void>();
  const handle = {
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    fit: vi.fn(),
    resetZoom: vi.fn(),
    relayout: vi.fn(),
    getZoom: () => zoom,
    subscribeZoom: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  const setZoom = (next: number) => {
    zoom = next;
    listeners.forEach((listener) => listener());
  };
  return { ref: { current: handle as unknown as CytoscapeCanvasHandle }, handle, setZoom };
};

const renderControls = (props: Partial<React.ComponentProps<typeof KgCanvasControls>> = {}, canvas = fakeCanvas()) => {
  const handlers = {
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    onConnectModeChange: vi.fn(),
    onExportHtml: vi.fn(),
  };
  render(<KgCanvasControls canvasRef={canvas.ref} canUndo canRedo connectMode="off" {...handlers} {...props} />);
  return { ...handlers, canvas };
};

describe('KgCanvasControls', () => {
  it('uses the React Flow controls bar classes', () => {
    renderControls();

    expect(screen.getByRole('toolbar')).toHaveClass('besser-canvas-controls');
    expect(screen.getByRole('button', { name: 'Zoom in' })).toHaveClass('control-button');
  });

  it('drives the canvas viewport', () => {
    const { canvas } = renderControls();

    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
    fireEvent.click(screen.getByRole('button', { name: 'Fit to view' }));
    fireEvent.click(screen.getByRole('button', { name: 'Auto layout' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset zoom to 100%' }));

    expect(canvas.handle.zoomIn).toHaveBeenCalledTimes(1);
    expect(canvas.handle.zoomOut).toHaveBeenCalledTimes(1);
    expect(canvas.handle.fit).toHaveBeenCalledTimes(1);
    expect(canvas.handle.relayout).toHaveBeenCalledTimes(1);
    expect(canvas.handle.resetZoom).toHaveBeenCalledTimes(1);
  });

  it('follows the canvas zoom level', () => {
    const canvas = fakeCanvas(0.734);
    renderControls({}, canvas);

    const readout = screen.getByRole('button', { name: 'Reset zoom to 100%' });
    expect(readout).toHaveTextContent('73%');
    act(() => canvas.setZoom(1.5));
    expect(readout).toHaveTextContent('150%');
  });

  it('disables zooming past the canvas limits', () => {
    const canvas = fakeCanvas(KG_MAX_ZOOM);
    renderControls({}, canvas);

    expect(screen.getByRole('button', { name: 'Zoom in' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Zoom out' })).toBeEnabled();
    act(() => canvas.setZoom(KG_MIN_ZOOM));
    expect(screen.getByRole('button', { name: 'Zoom out' })).toBeDisabled();
  });

  it('undo and redo call their handlers', () => {
    const { onUndo, onRedo } = renderControls();

    fireEvent.click(screen.getByRole('button', { name: 'Undo (Ctrl+Z)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Redo (Ctrl+Y)' }));

    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(onRedo).toHaveBeenCalledTimes(1);
  });

  it('disables undo and redo independently when there is nothing to undo or redo', () => {
    const { onUndo } = renderControls({ canUndo: false, canRedo: true });

    const undo = screen.getByRole('button', { name: 'Undo (Ctrl+Z)' });
    expect(undo).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Redo (Ctrl+Y)' })).toBeEnabled();
    fireEvent.click(undo);
    expect(onUndo).not.toHaveBeenCalled();
  });

  it('toggles relation mode and shows it as pressed', () => {
    const { onConnectModeChange } = renderControls();

    const addRelation = screen.getByRole('button', { name: 'Add relation' });
    expect(addRelation).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(addRelation);
    expect(onConnectModeChange).toHaveBeenCalledWith('connect');
  });

  it('leaves relation mode when pressed again', () => {
    const { onConnectModeChange } = renderControls({ connectMode: 'connect' });

    const addRelation = screen.getByRole('button', { name: 'Add relation' });
    expect(addRelation).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(addRelation);
    expect(onConnectModeChange).toHaveBeenCalledWith('off');
  });

  it('exports HTML', () => {
    const { onExportHtml } = renderControls();

    fireEvent.click(screen.getByRole('button', { name: 'Export HTML' }));
    expect(onExportHtml).toHaveBeenCalledTimes(1);
  });
});
