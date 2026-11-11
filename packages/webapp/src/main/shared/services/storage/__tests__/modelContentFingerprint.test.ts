/**
 * The real editor rewrites a model it loads. The rewrite must not read as an
 * edit, or a push asks "Keep your model?" about nothing; an edit must, or the
 * run's model replaces it silently.
 */
import { ApollonEditor } from '@besser/wme';
import { expect, it } from 'vitest';

import type { BesserProject } from '../../../types/project';
import { modelContentFingerprint, modelFingerprint } from '../projectGitHubLink';

const REPO_MODEL = {
  version: '3.0.0',
  type: 'ClassDiagram',
  size: { width: 1400, height: 740 },
  interactive: { elements: {}, relationships: {} },
  elements: {
    c1: { id: 'c1', name: 'Book', type: 'Class', owner: null, bounds: { x: 0, y: 0, width: 160, height: 100 }, attributes: ['a1'], methods: [] },
    a1: { id: 'a1', name: '+ title: str', type: 'ClassAttribute', owner: 'c1', bounds: { x: 0, y: 40, width: 159, height: 30 } },
  },
  relationships: {},
  assessments: {},
};

const project = (model: unknown) => ({ diagrams: { ClassDiagram: [{ model }] } }) as unknown as BesserProject;

it('tells the editor rewriting a model from someone editing it', async () => {
  Object.assign(window.SVGElement.prototype, {
    getBBox: () => ({ x: 0, y: 0, width: 80, height: 14 }),
    getComputedTextLength: () => 80,
  });
  const host = document.createElement('div');
  document.body.appendChild(host);
  const editor = new ApollonEditor(host, { type: 'ClassDiagram' } as never);
  await editor.nextRender;
  editor.model = JSON.parse(JSON.stringify(REPO_MODEL));
  await editor.nextRender;
  const rewritten = JSON.parse(JSON.stringify(editor.model));

  expect(modelFingerprint(project(rewritten))).not.toBe(modelFingerprint(project(REPO_MODEL)));
  expect(modelContentFingerprint(project(rewritten))).toBe(modelContentFingerprint(project(REPO_MODEL)));

  rewritten.elements.c1.name = 'Novel';
  expect(modelContentFingerprint(project(rewritten))).not.toBe(modelContentFingerprint(project(REPO_MODEL)));
  host.remove();
});
