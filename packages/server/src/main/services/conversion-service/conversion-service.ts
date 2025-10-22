import 'global-jsdom/register';
import { ApollonEditor, SVG, UMLModel } from '@besser/wme';

export class ConversionService {
  convertToSvg = async (model: UMLModel): Promise<SVG> => {
    document.body.innerHTML = '<!doctype html><html lang="en"><body><div></div></body></html>';
    // JSDOM does not support getBBox so we have to mock it here
    // @ts-ignore
    window.SVGElement.prototype.getBBox = () => ({
      x: 0,
      y: 0,
      width: 10,
      height: 10,
    });
    const container = document.querySelector('div')!;
    const editor = new ApollonEditor(container, {});
    await editor.nextRender;
    editor.model = model;
    await editor.nextRender;
    return editor.exportAsSVG();
  };
}
