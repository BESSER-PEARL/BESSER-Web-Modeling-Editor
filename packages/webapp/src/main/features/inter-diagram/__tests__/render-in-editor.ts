import { ApollonEditor } from '@besser/wme';
import type { UMLDiagramType, UMLModel } from '@besser/wme';

/**
 * Load `model` into a real ApollonEditor (jsdom) and return the model as the
 * editor laid it out. The layouter routes relationships in a saga that yields
 * between elements, so this waits until every relationship has been re-routed
 * (a routed path is stored relative to its bounds: its smallest x and y are 0).
 *
 * jsdom has no SVG layout: the caller stubs `SVGElement.prototype.getBBox`.
 */
export async function renderInEditor(type: UMLDiagramType, model: UMLModel, timeoutMs = 5000): Promise<UMLModel> {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const editor = new ApollonEditor(container, { type, model });
  try {
    await editor.nextRender;
    const routed = (m: UMLModel) =>
      Object.values(m.relationships).every(
        (r) => Math.min(...r.path.map((p) => p.x)) === 0 && Math.min(...r.path.map((p) => p.y)) === 0,
      );
    const deadline = Date.now() + timeoutMs;
    while (!routed(editor.model) && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    return editor.model;
  } finally {
    editor.destroy();
    container.remove();
  }
}
