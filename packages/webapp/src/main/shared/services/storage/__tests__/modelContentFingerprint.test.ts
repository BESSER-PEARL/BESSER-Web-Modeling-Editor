/**
 * The real editor rewrites a model it loads. The rewrite must not read as an
 * edit, or a push asks "Keep your model?" about nothing; an edit must, or the
 * run's model replaces it silently.
 */
import { BesserEditor } from '@besser/wme';
import { expect, it } from 'vitest';

import type { BesserProject } from '../../../types/project';
import { modelContentFingerprint, modelFingerprint } from '../projectGitHubLink';

const REPO_MODEL = {
  version: '4.0.0',
  id: 'repo-model',
  title: '',
  type: 'ClassDiagram',
  nodes: [
    {
      id: 'c1',
      type: 'class',
      position: { x: 0, y: 0 },
      width: 160,
      height: 100,
      data: { name: 'Book', methods: [], attributes: [{ id: 'a1', name: '+ title: str' }] },
    },
  ],
  edges: [],
  assessments: {},
};

const project = (model: unknown) => ({ diagrams: { ClassDiagram: [{ model }] } }) as unknown as BesserProject;

it('tells the editor rewriting a model from someone editing it', async () => {
  // React Flow observes its viewport; jsdom has no ResizeObserver.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  Object.assign(window.SVGElement.prototype, {
    getBBox: () => ({ x: 0, y: 0, width: 80, height: 14 }),
    getComputedTextLength: () => 80,
  });
  const host = document.createElement('div');
  document.body.appendChild(host);
  const editor = new BesserEditor(host, { type: 'ClassDiagram' } as never);
  await editor.nextRender;
  editor.model = JSON.parse(JSON.stringify(REPO_MODEL));
  await editor.nextRender;
  const rewritten = JSON.parse(JSON.stringify(editor.model));

  expect(modelFingerprint(project(rewritten))).not.toBe(modelFingerprint(project(REPO_MODEL)));
  expect(modelContentFingerprint(project(rewritten))).toBe(modelContentFingerprint(project(REPO_MODEL)));

  rewritten.nodes[0].data.name = 'Novel';
  expect(modelContentFingerprint(project(rewritten))).not.toBe(modelContentFingerprint(project(REPO_MODEL)));
  host.remove();
});
