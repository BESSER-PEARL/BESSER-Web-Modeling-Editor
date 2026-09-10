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
