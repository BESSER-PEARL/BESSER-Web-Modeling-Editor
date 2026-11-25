import React from 'react';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import ts from 'typescript';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';

// Exercise the actual template shipped with generated applications.
const templatePath = resolve(process.cwd(), '../../../BESSER/besser/generators/react/templates/src/components/runtime/ReadAloud.tsx');
const source = existsSync(templatePath) ? readFileSync(templatePath, 'utf8') : '';
const compiled = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true } });
const templateModule: { exports: any } = { exports: {} };
new Function('require', 'module', 'exports', compiled.outputText)(createRequire(resolve(process.cwd(), 'package.json')), templateModule, templateModule.exports);
const ReadAloud = templateModule.exports.ReadAloud;

describe.skipIf(!existsSync(templatePath))('exported read-aloud controls (BESSER integration)', () => {
  const playing = new WeakSet<HTMLMediaElement>();
  beforeEach(() => {
    vi.spyOn(HTMLMediaElement.prototype, 'paused', 'get').mockImplementation(function(this: HTMLMediaElement) { return !playing.has(this); });
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function(this: HTMLMediaElement) { playing.add(this); this.dispatchEvent(new Event('play')); return Promise.resolve(); });
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function(this: HTMLMediaElement) { playing.delete(this); this.dispatchEvent(new Event('pause')); });
  });
  afterEach(() => vi.restoreAllMocks());

  it('starts only on request and supports pause, resume, and stop', () => {
    render(<ReadAloud src="/audio/test.wav"><p>Full text</p></ReadAloud>);
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Listen to full text' }));
    expect(screen.getByRole('button', { name: 'Pause' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(screen.getByRole('button', { name: 'Listen to full text' })).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Listen to full text' }));
    const audio = document.querySelector('audio')!;
    audio.currentTime = 10;
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(audio.currentTime).toBe(0);
    expect(audio.paused).toBe(true);
  });

  it('keeps summary and full text separate and permits only one active reader', () => {
    render(<><ReadAloud src="/audio/summary.wav" summary><p>Summary</p></ReadAloud><ReadAloud src="/audio/full.wav"><p>Full text</p></ReadAloud></>);
    const summary = within(screen.getByRole('group', { name: 'Listen to summary' }));
    const full = within(screen.getByRole('group', { name: 'Listen to full text' }));
    fireEvent.click(summary.getByRole('button', { name: 'Listen to summary' }));
    fireEvent.click(full.getByRole('button', { name: 'Listen to full text' }));
    expect(summary.getByRole('button', { name: 'Listen to summary' })).toHaveAttribute('aria-pressed', 'false');
    expect(full.getByRole('button', { name: 'Pause' })).toHaveAttribute('aria-pressed', 'true');
  });
});
