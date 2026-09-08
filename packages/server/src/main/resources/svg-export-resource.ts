import { Request, Response } from 'express';
import { UMLModel } from '@besser/wme';
import { ConversionService } from '../services/conversion-service/conversion-service';

/**
 * Renders a UML model to SVG headlessly (jsdom + Apollon), optionally running
 * ELK auto-layout first. This is the render half of the "B-UML -> SVG" path;
 * the editor's Python backend converts B-UML to the editor JSON model and POSTs
 * it here.
 */
export class SvgExportResource {
  private readonly conversionService = new ConversionService();

  exportSvg = async (req: Request, res: Response): Promise<void> => {
    const model = req.body?.model as UMLModel | undefined;
    const autoLayout = req.body?.autoLayout !== false; // default true

    if (!model || typeof model !== 'object' || !('elements' in model)) {
      res.status(400).json({ error: 'Request body must include a "model" (UML model JSON).' });
      return;
    }

    try {
      const svg = await this.conversionService.convertToSvg(model, autoLayout);
      res.status(200).json({ svg: svg.svg, clip: svg.clip });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: `SVG export failed: ${message}` });
    }
  };
}
