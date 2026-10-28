import { useCallback } from 'react';

import type { QualityCheckResult } from '../../features/generation/types';
import type { GeneratorType } from '../shell/workspace-types';

interface KgActions {
  convertToClassDiagram: () => Promise<void>;
  openRefine: () => void;
}

interface Args {
  isKgContext: boolean;
  kg: KgActions;
  handleGenerateRequest: (type: GeneratorType, config?: Record<string, any>) => unknown;
  handleQualityCheck: () => Promise<QualityCheckResult>;
}

/**
 * Sends the two top-bar actions that mean something different on a Knowledge
 * Graph to the KG flows, and everything else to code generation / validation.
 *
 * - Generate -> "Convert to B-UML": a conversion with its own dialogs, not a
 *   code generator.
 * - Quality Check: opens Refine (static analysis, consistency, AI tabs). Refine
 *   reports its own results, so there is no verdict to hand back.
 */
export function useKgRouting({ isKgContext, kg, handleGenerateRequest, handleQualityCheck }: Args) {
  const onGenerate = useCallback(
    (type: GeneratorType, config?: Record<string, any>) => {
      if (type === 'kg_to_class') return kg.convertToClassDiagram();
      return handleGenerateRequest(type, config);
    },
    [kg.convertToClassDiagram, handleGenerateRequest],
  );

  const onQualityCheck = useCallback(async (): Promise<QualityCheckResult> => {
    if (isKgContext) {
      kg.openRefine();
      return { executed: false, passed: false };
    }
    return handleQualityCheck();
  }, [isKgContext, kg.openRefine, handleQualityCheck]);

  return { onGenerate, onQualityCheck };
}
