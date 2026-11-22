import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useKgRouting } from '../useKgRouting';

const setup = (isKgContext: boolean) => {
  const kg = { convertToClassDiagram: vi.fn().mockResolvedValue(undefined), openRefine: vi.fn() };
  const handleGenerateRequest = vi.fn();
  const handleQualityCheck = vi.fn().mockResolvedValue({ executed: true, passed: true });
  const { result } = renderHook(() =>
    useKgRouting({ isKgContext, kg, handleGenerateRequest, handleQualityCheck }),
  );
  return { kg, handleGenerateRequest, handleQualityCheck, ...result.current };
};

describe('Generate menu', () => {
  it('sends "Convert to class diagram" to the KG flow, not to code generation', async () => {
    const { onGenerate, kg, handleGenerateRequest } = setup(true);

    await onGenerate('kg_to_class');

    expect(kg.convertToClassDiagram).toHaveBeenCalledTimes(1);
    expect(handleGenerateRequest).not.toHaveBeenCalled();
  });

  it.each(['django', 'sql', 'web_app'] as const)('leaves the %s generator to code generation', (type) => {
    const { onGenerate, kg, handleGenerateRequest } = setup(false);

    onGenerate(type, { a: 1 });

    expect(handleGenerateRequest).toHaveBeenCalledWith(type, { a: 1 });
    expect(kg.convertToClassDiagram).not.toHaveBeenCalled();
  });
});

describe('Quality Check', () => {
  it('opens Refine on a Knowledge Graph and reports that there is no verdict', async () => {
    const { onQualityCheck, kg, handleQualityCheck } = setup(true);

    await expect(onQualityCheck()).resolves.toEqual({ executed: false, passed: false });

    expect(kg.openRefine).toHaveBeenCalledTimes(1);
    expect(handleQualityCheck).not.toHaveBeenCalled();
  });

  it('validates the diagram everywhere else', async () => {
    const { onQualityCheck, kg, handleQualityCheck } = setup(false);

    await expect(onQualityCheck()).resolves.toEqual({ executed: true, passed: true });

    expect(handleQualityCheck).toHaveBeenCalledTimes(1);
    expect(kg.openRefine).not.toHaveBeenCalled();
  });
});
