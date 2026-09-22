import 'global-jsdom/register';
import { ApollonEditor, layoutModel, SVG, UMLModel } from '@besser/wme';

export class ConversionService {
  /**
   * @param model the UML model to render
   * @param autoLayout when true (default), runs ELK auto-layout on the model
   *   before rendering, so imported/headless models get a clean layout instead
   *   of whatever positions they arrived with.
   */
  convertToSvg = async (model: UMLModel, autoLayout = true): Promise<SVG> => {
    document.body.innerHTML = '<!doctype html><html lang="en"><body><div></div></body></html>';
    // JSDOM does not support getBBox so we have to mock it here
    // @ts-ignore
    window.SVGElement.prototype.getBBox = () => ({
      x: 0,
      y: 0,
      width: 10,
      height: 10,
    });
    const layoutedModel = autoLayout ? await layoutModel(model) : model;
    const container = document.querySelector('div')!;
    const editor = new ApollonEditor(container, {});
    await editor.nextRender;
    editor.model = layoutedModel;
    await editor.nextRender;
    return editor.exportAsSVG();
  };
}
