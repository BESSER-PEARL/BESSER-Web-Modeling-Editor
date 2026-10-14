import { describe, expect, it, vi } from 'vitest';
import { getChartConfigs } from '../configs/chartConfigs';
import { getMetricCardConfig } from '../configs/metricCardConfigs';

// react-toastify is pulled in transitively via localStorageQuota; stub it.
vi.mock('react-toastify', () => ({
  toast: { warning: vi.fn() },
}));

// The values BESSER's GUI processor (DataAggregation.parse) and the generated
// app's aggregate() both accept; '' leaves the widget unaggregated.
const BACKEND_AGGREGATIONS = ['', 'sum', 'avg', 'count', 'min', 'max', 'median', 'first', 'last'];

const aggregationTrait = (traits: { name: string }[]) => traits.find((t) => t.name === 'aggregation') as any;

describe('aggregation traits', () => {
  it('lets a line chart aggregate its series, with none by default', () => {
    const line = getChartConfigs().find((c) => c.id === 'line-chart')!;
    const trait = aggregationTrait(line.traits);
    expect(trait).toBeDefined();
    expect(trait.value).toBe('');
    expect(trait.options.map((o: { value: string }) => o.value)).toEqual(BACKEND_AGGREGATIONS);
  });

  it('lets a metric card aggregate, defaulting to none so a card without a field counts records', () => {
    const trait = aggregationTrait(getMetricCardConfig().traits);
    expect(trait).toBeDefined();
    expect(trait.value).toBe('');
    expect(trait.options.map((o: { value: string }) => o.value)).toEqual(BACKEND_AGGREGATIONS);
  });
});
