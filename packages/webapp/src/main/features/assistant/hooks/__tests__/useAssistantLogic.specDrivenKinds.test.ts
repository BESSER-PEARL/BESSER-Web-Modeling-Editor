import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('useAssistantLogic SpecDriven primary-kind whitelist', () => {
  it.each(['bpmn', 'nn'] as const)('forwards the %s primary kind', (kind) => {
    const source = readFileSync(resolve(__dirname, '..', 'useAssistantLogic.ts'), 'utf-8');
    const whitelist = source.match(
      /primaryKindOverride:\s*[\s\S]*?\?\s*payload\.primaryKindOverride\s*:\s*undefined,/,
    );

    expect(whitelist).not.toBeNull();
    expect(whitelist?.[0]).toContain(`payload.primaryKindOverride === '${kind}'`);
  });

  it('does not trust a skip-deterministic attestation from the agent payload', () => {
    const source = readFileSync(resolve(__dirname, '..', 'useAssistantLogic.ts'), 'utf-8');
    const start = source.indexOf('const smartPayload: TriggerSpecDrivenPayload');
    const end = source.indexOf('if (!smartPayload.instructions)', start);
    const smartPayloadBuilder = source.slice(start, end);

    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(smartPayloadBuilder).not.toContain('skipDeterministicGenerator');
  });
});
