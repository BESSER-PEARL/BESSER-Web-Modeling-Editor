// MUST stay the first import: `@besser/wme` touches `document` / `window`
// while its modules evaluate (MUI styles, text measurement), and this is the
// first module in the server's import graph that loads it. Registering the
// jsdom globals only in ConversionService (imported below) is too late — the
// bundled server crashed on start with "ReferenceError: document is not
// defined".
import 'global-jsdom/register';
// Evaluate the library's palette constants before its public entry. The
// library has an import cycle `constants` → `@/components` barrel →
// `Sidebar` → `constants`; entered through the barrel first (which is what
// `@besser/wme` does in this bundle), `constants` evaluated before the SVG
// components and every palette `svg` was undefined, so rendering crashed
// ("Element type is invalid … check the render method of `Sidebar`").
// Entering through `constants` gives the order the editor and the library
// tests use. `@/` is the webpack alias for `packages/library/lib`.
import '@/constants';
import { Request, Response } from 'express';
import { importDiagram, isV3Format, isV4Format } from '@besser/wme';
import { ConversionService } from '../services/conversion-service/conversion-service';

/**
 * Renders a UML model to SVG headlessly (jsdom + BesserEditor), optionally
 * running ELK auto-layout first. This is the render half of the "B-UML -> SVG"
 * path; the editor's Python backend converts B-UML to the editor JSON model and
 * POSTs it here. Both the current v4 model format and legacy v3 payloads are
 * accepted — v3 models are lifted to v4 before rendering.
 */
export class SvgExportResource {
  private readonly conversionService = new ConversionService();

  exportSvg = async (req: Request, res: Response): Promise<void> => {
    const rawModel = req.body?.model as unknown;
    const autoLayout = req.body?.autoLayout !== false; // default true

    if (!rawModel || typeof rawModel !== 'object' || !(isV4Format(rawModel) || isV3Format(rawModel))) {
      res.status(400).json({ error: 'Request body must include a "model" (UML model JSON).' });
      return;
    }

    try {
      const model = importDiagram(rawModel);
      const svg = await this.conversionService.convertToSvg(model, autoLayout);
      res.status(200).json({ svg: svg.svg, clip: svg.clip });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: `SVG export failed: ${message}` });
    }
  };
}
